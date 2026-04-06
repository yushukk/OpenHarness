"""Launch the web frontend: HTTP server + WebSocket backend."""

from __future__ import annotations

import logging
import os
import webbrowser
from pathlib import Path

from aiohttp import web

from openharness.ui.backend_host import BackendHostConfig
from openharness.ui.web_host import WebBackendHost

log = logging.getLogger(__name__)


def get_web_frontend_dir() -> Path:
    """Return the web frontend dist directory.

    Checks in order:
    1. Bundled inside the installed package (pip install)
    2. Development repo layout (source checkout)
    """
    pkg_frontend = Path(__file__).resolve().parent.parent / "_web_frontend"
    if (pkg_frontend / "index.html").exists():
        return pkg_frontend

    repo_root = Path(__file__).resolve().parents[3]
    dev_frontend = repo_root / "frontend" / "web" / "dist"
    if (dev_frontend / "index.html").exists():
        return dev_frontend

    return dev_frontend


async def _ws_handler(request: web.Request) -> web.WebSocketResponse:
    """Handle a WebSocket connection: one session per connection."""
    ws = web.WebSocketResponse(max_msg_size=50 * 1024 * 1024)  # 50MB for image uploads
    await ws.prepare(request)

    config: BackendHostConfig = request.app["backend_config"]
    host = WebBackendHost(config, ws)

    try:
        await host.run()
    except Exception:
        log.exception("WebSocket session error")
    finally:
        if not ws.closed:
            await ws.close()

    return ws


async def _index_handler(request: web.Request) -> web.Response:
    """Serve the index.html for all non-API routes (SPA fallback)."""
    frontend_dir: Path = request.app["frontend_dir"]
    index_path = frontend_dir / "index.html"
    if index_path.exists():
        return web.FileResponse(index_path)
    return web.Response(
        text="Web frontend not built. Run: cd frontend/web && npm install && npm run build",
        status=503,
    )


async def launch_web_ui(
    *,
    port: int = 8765,
    host: str = "127.0.0.1",
    model: str | None = None,
    max_turns: int | None = None,
    base_url: str | None = None,
    system_prompt: str | None = None,
    api_key: str | None = None,
    api_format: str | None = None,
    dev_mode: bool = False,
) -> None:
    """Start the web UI server."""
    if dev_mode:
        os.chdir(str(Path.cwd()))

    config = BackendHostConfig(
        model=model,
        max_turns=max_turns,
        base_url=base_url,
        system_prompt=system_prompt,
        api_key=api_key,
        api_format=api_format,
    )

    app = web.Application()
    app["backend_config"] = config

    # WebSocket endpoint
    app.router.add_get("/ws", _ws_handler)

    frontend_dir = get_web_frontend_dir()
    app["frontend_dir"] = frontend_dir

    if not dev_mode and frontend_dir.exists():
        # Serve static assets from dist/
        app.router.add_static("/assets", frontend_dir / "assets", show_index=False)
        # SPA fallback: serve index.html for all other routes
        app.router.add_get("/{path:.*}", _index_handler)
    else:
        # Dev mode or no dist: just serve a status page
        app.router.add_get("/", _index_handler)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, host, port)
    await site.start()

    url = f"http://{host}:{port}"
    if not dev_mode:
        print(f"OpenHarness Web UI running at {url}")
        print("Press Ctrl+C to stop")
        webbrowser.open(url)
    else:
        print(f"OpenHarness WebSocket backend running at ws://{host}:{port}/ws")
        print("Start Vite dev server: cd frontend/web && npm run dev")

    try:
        # Keep running until interrupted
        while True:
            await __import__("asyncio").sleep(3600)
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        await runner.cleanup()


__all__ = ["launch_web_ui", "get_web_frontend_dir"]
