type Props = {
  connected: boolean;
  ready: boolean;
  busy: boolean;
  status: Record<string, unknown>;
};

export function StatusBar({ connected, ready, busy, status }: Props) {
  const model = (status.model as string) || '';
  const permissionMode = (status.permission_mode as string) || '';

  return (
    <div className="status-bar">
      <div className="status-left">
        <span className={`status-dot ${connected && ready ? 'online' : 'offline'}`} />
        <span className="status-text">
          {!connected ? 'Disconnected' : !ready ? 'Connecting...' : busy ? 'Thinking...' : 'Ready'}
        </span>
        {model && <span className="status-model">{model}</span>}
      </div>
      <div className="status-right">
        {permissionMode && (
          <span className="status-permission">Mode: {permissionMode}</span>
        )}
      </div>
    </div>
  );
}
