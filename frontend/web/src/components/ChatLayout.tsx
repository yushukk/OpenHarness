import { useWebSocketSession } from '../hooks/useWebSocketSession';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { StatusBar } from './StatusBar';
import { PermissionDialog } from './PermissionDialog';

export function ChatLayout() {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

  const {
    transcript,
    assistantBuffer,
    status,
    modal,
    busy,
    ready,
    connected,
    sendRequest,
    submitMessage,
    setModal,
  } = useWebSocketSession(wsUrl);

  const handleModalRespond = (payload: Record<string, unknown>) => {
    sendRequest(payload);
    setModal(null);
  };

  return (
    <div className="chat-layout">
      <StatusBar connected={connected} ready={ready} busy={busy} status={status} />
      <MessageList transcript={transcript} assistantBuffer={assistantBuffer} />
      <ChatInput
        onSubmit={(text, attachments) => {
          submitMessage(text, attachments);
        }}
        disabled={busy || !ready}
      />
      {modal && <PermissionDialog modal={modal} onRespond={handleModalRespond} />}
    </div>
  );
}
