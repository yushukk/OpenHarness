import { useEffect, useRef } from 'react';
import type { TranscriptItem } from '../types';
import { MessageBubble } from './MessageBubble';
import { StreamingText } from './StreamingText';

type Props = {
  transcript: TranscriptItem[];
  assistantBuffer: string;
};

export function MessageList({ transcript, assistantBuffer }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript, assistantBuffer]);

  return (
    <div className="message-list">
      {transcript.length === 0 && !assistantBuffer && (
        <div className="empty-state">
          <div className="empty-icon">&#x1F916;</div>
          <div className="empty-title">OpenHarness Web</div>
          <div className="empty-hint">Send a message to start the conversation</div>
        </div>
      )}
      {transcript.map((item, i) => (
        <MessageBubble key={i} item={item} />
      ))}
      {assistantBuffer && <StreamingText text={assistantBuffer} />}
      <div ref={bottomRef} />
    </div>
  );
}
