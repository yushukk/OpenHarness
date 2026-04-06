"""WebSocket-based backend host for the browser web frontend."""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from uuid import uuid4

from aiohttp import web

from openharness.api.client import SupportsStreamingMessages
from openharness.bridge import get_bridge_manager
from openharness.engine.messages import ContentBlock, ImageBlock, TextBlock
from openharness.engine.stream_events import (
    AssistantTextDelta,
    AssistantTurnComplete,
    StreamEvent,
    ToolExecutionCompleted,
    ToolExecutionStarted,
)
from openharness.tasks import get_task_manager
from openharness.ui.backend_host import BackendHostConfig
from openharness.ui.protocol import (
    AttachmentPayload,
    BackendEvent,
    FrontendRequest,
    TranscriptItem,
)
from openharness.ui.runtime import build_runtime, close_runtime, handle_line, start_runtime

log = logging.getLogger(__name__)


def _attachments_to_content(attachments: list[AttachmentPayload]) -> list[ContentBlock]:
    """Convert frontend attachment payloads into engine content blocks."""
    blocks: list[ContentBlock] = []
    for att in attachments:
        if att.media_type.startswith("image/"):
            blocks.append(ImageBlock(media_type=att.media_type, data=att.data))
        elif att.media_type in ("text/markdown", "text/plain"):
            blocks.append(TextBlock(text=f"[File: {att.filename}]\n{att.data}"))
    return blocks


def _attachment_images(attachments: list[AttachmentPayload]) -> list[dict[str, str]] | None:
    """Extract image data from attachments for transcript display."""
    images = [
        {"media_type": att.media_type, "data": att.data}
        for att in attachments
        if att.media_type.startswith("image/")
    ]
    return images or None


class WebBackendHost:
    """Drive the OpenHarness runtime over a WebSocket connection."""

    def __init__(self, config: BackendHostConfig, ws: web.WebSocketResponse) -> None:
        self._config = config
        self._ws = ws
        self._bundle = None
        self._write_lock = asyncio.Lock()
        self._request_queue: asyncio.Queue[FrontendRequest] = asyncio.Queue()
        self._permission_requests: dict[str, asyncio.Future[bool]] = {}
        self._question_requests: dict[str, asyncio.Future[str]] = {}
        self._busy = False
        self._running = True
        self._last_tool_inputs: dict[str, dict] = {}

    async def run(self) -> int:
        try:
            self._bundle = await build_runtime(
                model=self._config.model,
                max_turns=self._config.max_turns,
                base_url=self._config.base_url,
                system_prompt=self._config.system_prompt,
                api_key=self._config.api_key,
                api_format=self._config.api_format,
                api_client=self._config.api_client,
                restore_messages=self._config.restore_messages,
                permission_prompt=self._ask_permission,
                ask_user_prompt=self._ask_question,
            )
            await start_runtime(self._bundle)
        except Exception as exc:
            log.exception("Failed to initialize runtime")
            await self._emit(BackendEvent(type="error", message=f"Initialization failed: {exc}"))
            await self._emit(BackendEvent(type="shutdown"))
            return 1
        await self._emit(
            BackendEvent.ready(
                self._bundle.app_state.get(),
                get_task_manager().list_tasks(),
                [f"/{command.name}" for command in self._bundle.commands.list_commands()],
            )
        )
        await self._emit(self._status_snapshot())

        reader = asyncio.create_task(self._read_requests())
        try:
            while self._running:
                request = await self._request_queue.get()
                if request.type == "shutdown":
                    await self._emit(BackendEvent(type="shutdown"))
                    break
                if request.type == "permission_response":
                    if request.request_id in self._permission_requests:
                        self._permission_requests[request.request_id].set_result(bool(request.allowed))
                    continue
                if request.type == "question_response":
                    if request.request_id in self._question_requests:
                        self._question_requests[request.request_id].set_result(request.answer or "")
                    continue
                if request.type == "list_sessions":
                    await self._handle_list_sessions()
                    continue
                if request.type != "submit_line":
                    await self._emit(BackendEvent(type="error", message=f"Unknown request type: {request.type}"))
                    continue
                if self._busy:
                    await self._emit(BackendEvent(type="error", message="Session is busy"))
                    continue
                line = (request.line or "").strip()
                if not line and not request.attachments:
                    continue
                self._busy = True
                try:
                    should_continue = await self._process_line(line or "", request.attachments)
                finally:
                    self._busy = False
                if not should_continue:
                    await self._emit(BackendEvent(type="shutdown"))
                    break
        finally:
            reader.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await reader
            if self._bundle is not None:
                await close_runtime(self._bundle)
        return 0

    async def _read_requests(self) -> None:
        async for msg in self._ws:
            if msg.type == web.WSMsgType.TEXT:
                try:
                    request = FrontendRequest.model_validate_json(msg.data)
                except Exception as exc:
                    await self._emit(BackendEvent(type="error", message=f"Invalid request: {exc}"))
                    continue
                await self._request_queue.put(request)
            elif msg.type in (web.WSMsgType.ERROR, web.WSMsgType.CLOSE):
                break
        await self._request_queue.put(FrontendRequest(type="shutdown"))

    async def _process_line(
        self, line: str, attachments: list[AttachmentPayload] | None = None
    ) -> bool:
        assert self._bundle is not None

        # Convert attachments to content blocks
        extra_content: list[ContentBlock] | None = None
        images: list[dict[str, str]] | None = None
        if attachments:
            extra_content = _attachments_to_content(attachments) or None
            images = _attachment_images(attachments)

        # Build display text for user transcript
        display_text = line
        if attachments:
            file_labels = [f"[{att.filename}]" for att in attachments]
            if line:
                display_text = f"{line} {' '.join(file_labels)}"
            else:
                display_text = " ".join(file_labels)

        await self._emit(
            BackendEvent(
                type="transcript_item",
                item=TranscriptItem(role="user", text=display_text, images=images),
            )
        )

        async def _print_system(message: str) -> None:
            await self._emit(
                BackendEvent(type="transcript_item", item=TranscriptItem(role="system", text=message))
            )

        async def _render_event(event: StreamEvent) -> None:
            if isinstance(event, AssistantTextDelta):
                await self._emit(BackendEvent(type="assistant_delta", message=event.text))
                return
            if isinstance(event, AssistantTurnComplete):
                await self._emit(
                    BackendEvent(
                        type="assistant_complete",
                        message=event.message.text.strip(),
                        item=TranscriptItem(role="assistant", text=event.message.text.strip()),
                    )
                )
                await self._emit(BackendEvent.tasks_snapshot(get_task_manager().list_tasks()))
                return
            if isinstance(event, ToolExecutionStarted):
                self._last_tool_inputs[event.tool_name] = event.tool_input or {}
                await self._emit(
                    BackendEvent(
                        type="tool_started",
                        tool_name=event.tool_name,
                        tool_input=event.tool_input,
                        item=TranscriptItem(
                            role="tool",
                            text=f"{event.tool_name} {json.dumps(event.tool_input, ensure_ascii=True)}",
                            tool_name=event.tool_name,
                            tool_input=event.tool_input,
                        ),
                    )
                )
                return
            if isinstance(event, ToolExecutionCompleted):
                await self._emit(
                    BackendEvent(
                        type="tool_completed",
                        tool_name=event.tool_name,
                        output=event.output,
                        is_error=event.is_error,
                        item=TranscriptItem(
                            role="tool_result",
                            text=event.output,
                            tool_name=event.tool_name,
                            is_error=event.is_error,
                        ),
                    )
                )
                await self._emit(BackendEvent.tasks_snapshot(get_task_manager().list_tasks()))
                await self._emit(self._status_snapshot())
                if event.tool_name in ("TodoWrite", "todo_write"):
                    tool_input = self._last_tool_inputs.get(event.tool_name, {})
                    todos = tool_input.get("todos") or tool_input.get("content") or []
                    if isinstance(todos, list) and todos:
                        lines = []
                        for item in todos:
                            if isinstance(item, dict):
                                checked = item.get("status", "") in ("done", "completed", "x", True)
                                text = item.get("content") or item.get("text") or str(item)
                                lines.append(f"- [{'x' if checked else ' '}] {text}")
                        if lines:
                            await self._emit(BackendEvent(type="todo_update", todo_markdown="\n".join(lines)))
                if event.tool_name in ("set_permission_mode", "plan_mode"):
                    assert self._bundle is not None
                    new_mode = self._bundle.app_state.get().permission_mode
                    await self._emit(BackendEvent(type="plan_mode_change", plan_mode=new_mode))

        async def _clear_output() -> None:
            await self._emit(BackendEvent(type="clear_transcript"))

        should_continue = await handle_line(
            self._bundle,
            line or "(attached files)",
            print_system=_print_system,
            render_event=_render_event,
            clear_output=_clear_output,
            extra_content=extra_content,
        )
        log.info("handle_line completed, should_continue=%s", should_continue)
        await self._emit(self._status_snapshot())
        await self._emit(BackendEvent.tasks_snapshot(get_task_manager().list_tasks()))
        await self._emit(BackendEvent(type="line_complete"))
        return should_continue

    def _status_snapshot(self) -> BackendEvent:
        assert self._bundle is not None
        return BackendEvent.status_snapshot(
            state=self._bundle.app_state.get(),
            mcp_servers=self._bundle.mcp_manager.list_statuses(),
            bridge_sessions=get_bridge_manager().list_sessions(),
        )

    async def _handle_list_sessions(self) -> None:
        from openharness.services.session_storage import list_session_snapshots
        import time as _time

        assert self._bundle is not None
        sessions = list_session_snapshots(self._bundle.cwd, limit=10)
        options = []
        for s in sessions:
            ts = _time.strftime("%m/%d %H:%M", _time.localtime(s["created_at"]))
            summary = s.get("summary", "")[:50] or "(no summary)"
            options.append({
                "value": s["session_id"],
                "label": f"{ts}  {s['message_count']}msg  {summary}",
            })
        await self._emit(
            BackendEvent(
                type="select_request",
                modal={"kind": "select", "title": "Resume Session", "submit_prefix": "/resume "},
                select_options=options,
            )
        )

    async def _ask_permission(self, tool_name: str, reason: str) -> bool:
        request_id = uuid4().hex
        future: asyncio.Future[bool] = asyncio.get_running_loop().create_future()
        self._permission_requests[request_id] = future
        await self._emit(
            BackendEvent(
                type="modal_request",
                modal={
                    "kind": "permission",
                    "request_id": request_id,
                    "tool_name": tool_name,
                    "reason": reason,
                },
            )
        )
        try:
            return await asyncio.wait_for(future, timeout=300)
        except asyncio.TimeoutError:
            log.warning("Permission request %s timed out after 300s, denying", request_id)
            return False
        finally:
            self._permission_requests.pop(request_id, None)

    async def _ask_question(self, question: str) -> str:
        request_id = uuid4().hex
        future: asyncio.Future[str] = asyncio.get_running_loop().create_future()
        self._question_requests[request_id] = future
        await self._emit(
            BackendEvent(
                type="modal_request",
                modal={
                    "kind": "question",
                    "request_id": request_id,
                    "question": question,
                },
            )
        )
        try:
            return await future
        finally:
            self._question_requests.pop(request_id, None)

    async def _emit(self, event: BackendEvent) -> None:
        if self._ws.closed:
            return
        async with self._write_lock:
            try:
                await self._ws.send_str(event.model_dump_json())
            except ConnectionResetError:
                self._running = False


__all__ = ["WebBackendHost"]
