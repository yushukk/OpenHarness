import type { TranscriptItem } from '../types';
import { MarkdownBlock } from './MarkdownBlock';
import { ToolCallCard } from './ToolCallCard';

type Props = { item: TranscriptItem };

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function MessageBubble({ item }: Props) {
  // Tool calls and tool results get a special card
  if (item.role === 'tool' || item.role === 'tool_result') {
    return <ToolCallCard item={item} />;
  }

  // System/log messages
  if (item.role === 'system' || item.role === 'log') {
    return (
      <div className="message-bubble system">
        <div className="bubble-content system-text">{item.text}</div>
      </div>
    );
  }

  const isUser = item.role === 'user';
  const hasImages = item.images && item.images.length > 0;

  return (
    <div className={`message-bubble ${isUser ? 'user' : 'assistant'}`}>
      <div className="bubble-role">{isUser ? 'You' : 'Assistant'}</div>
      <div className="bubble-content">
        {hasImages && (
          <div className="bubble-images">
            {item.images!.map((img, i) =>
              IMAGE_TYPES.includes(img.media_type) ? (
                <img
                  key={i}
                  className="bubble-image"
                  src={`data:${img.media_type};base64,${img.data}`}
                  alt={`attachment ${i + 1}`}
                />
              ) : null,
            )}
          </div>
        )}
        {isUser ? (
          <div className="user-text">{item.text}</div>
        ) : (
          <MarkdownBlock text={item.text} />
        )}
      </div>
    </div>
  );
}
