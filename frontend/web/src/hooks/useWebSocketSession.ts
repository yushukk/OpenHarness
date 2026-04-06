import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AttachmentPayload,
  BackendEvent,
  TranscriptItem,
  TaskSnapshot,
} from '../types';

const DELTA_FLUSH_MS = 33;
const DELTA_FLUSH_CHARS = 256;

export function useWebSocketSession(wsUrl: string) {
  const [transcript, setTranscript] = useState<TranscriptItem[]>([]);
  const [assistantBuffer, setAssistantBuffer] = useState('');
  const [status, setStatus] = useState<Record<string, unknown>>({});
  const [tasks, setTasks] = useState<TaskSnapshot[]>([]);
  const [commands, setCommands] = useState<string[]>([]);
  const [modal, setModal] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [connected, setConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const bufferRef = useRef('');
  const pendingRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);

  const flushDelta = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    pendingRef.current = '';
    bufferRef.current += pending;
    setAssistantBuffer(bufferRef.current);
  }, []);

  const clearDelta = useCallback(() => {
    pendingRef.current = '';
    bufferRef.current = '';
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setAssistantBuffer('');
  }, []);

  const handleEvent = useCallback(
    (event: BackendEvent) => {
      if (event.type === 'ready') {
        setReady(true);
        setStatus(event.state ?? {});
        setTasks(event.tasks ?? []);
        setCommands(event.commands ?? []);
        return;
      }
      if (event.type === 'state_snapshot') {
        setStatus(event.state ?? {});
        return;
      }
      if (event.type === 'tasks_snapshot') {
        setTasks(event.tasks ?? []);
        return;
      }
      if (event.type === 'transcript_item' && event.item) {
        setTranscript((items) => [...items, event.item as TranscriptItem]);
        return;
      }
      if (event.type === 'assistant_delta') {
        const delta = event.message ?? '';
        if (!delta) return;
        pendingRef.current += delta;
        if (pendingRef.current.length >= DELTA_FLUSH_CHARS) {
          flushDelta();
          return;
        }
        if (!timerRef.current) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            flushDelta();
          }, DELTA_FLUSH_MS);
        }
        return;
      }
      if (event.type === 'assistant_complete') {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        flushDelta();
        const text = event.message ?? bufferRef.current;
        setTranscript((items) => [...items, { role: 'assistant', text }]);
        clearDelta();
        setBusy(false);
        return;
      }
      if (event.type === 'line_complete') {
        clearDelta();
        setBusy(false);
        return;
      }
      if (
        (event.type === 'tool_started' || event.type === 'tool_completed') &&
        event.item
      ) {
        const enrichedItem: TranscriptItem = {
          ...event.item,
          tool_name: event.item.tool_name ?? event.tool_name ?? undefined,
          tool_input:
            event.item.tool_input ?? (event.tool_input as Record<string, unknown> | undefined) ?? undefined,
          is_error: event.item.is_error ?? event.is_error ?? undefined,
        };
        setTranscript((items) => [...items, enrichedItem]);
        return;
      }
      if (event.type === 'clear_transcript') {
        setTranscript([]);
        clearDelta();
        return;
      }
      if (event.type === 'modal_request') {
        setModal(event.modal ?? null);
        return;
      }
      if (event.type === 'error') {
        setTranscript((items) => [
          ...items,
          { role: 'system', text: `Error: ${event.message ?? 'unknown error'}` },
        ]);
        clearDelta();
        setBusy(false);
        return;
      }
      if (event.type === 'plan_mode_change') {
        if (event.plan_mode != null) {
          setStatus((s) => ({ ...s, permission_mode: event.plan_mode }));
        }
        return;
      }
      if (event.type === 'shutdown') {
        reconnectAttemptRef.current = 999; // prevent reconnect after shutdown
        setConnected(false);
      }
    },
    [flushDelta, clearDelta],
  );

  const connect = useCallback(() => {
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      reconnectAttemptRef.current = 0;
    };

    ws.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as BackendEvent;
        handleEvent(event);
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setReady(false);
      // Attempt reconnect with exponential backoff
      const attempt = reconnectAttemptRef.current;
      if (attempt < 3) {
        const delay = Math.min(2000 * Math.pow(2, attempt), 8000);
        reconnectAttemptRef.current = attempt + 1;
        setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      // onclose will handle reconnection
    };
  }, [wsUrl, handleEvent]);

  useEffect(() => {
    connect();
    return () => {
      reconnectAttemptRef.current = 999; // prevent reconnect on unmount
      wsRef.current?.close();
    };
  }, [connect]);

  const sendRequest = useCallback(
    (payload: Record<string, unknown>) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify(payload));
    },
    [],
  );

  const submitMessage = useCallback(
    (text: string, attachments?: AttachmentPayload[]) => {
      const payload: Record<string, unknown> = {
        type: 'submit_line',
        line: text,
      };
      if (attachments && attachments.length > 0) {
        payload.attachments = attachments;
      }
      sendRequest(payload);
      setBusy(true);
    },
    [sendRequest],
  );

  return {
    transcript,
    assistantBuffer,
    status,
    tasks,
    commands,
    modal,
    busy,
    ready,
    connected,
    setModal,
    setBusy,
    sendRequest,
    submitMessage,
  };
}
