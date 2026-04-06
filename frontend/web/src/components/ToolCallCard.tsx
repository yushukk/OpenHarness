import { useState } from 'react';
import type { TranscriptItem } from '../types';

type Props = { item: TranscriptItem };

export function ToolCallCard({ item }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isError = item.is_error;
  const isResult = item.role === 'tool_result';
  const toolName = item.tool_name || 'tool';

  return (
    <div className={`tool-card ${isError ? 'tool-error' : ''} ${isResult ? 'tool-result' : ''}`}>
      <button className="tool-card-header" onClick={() => setExpanded(!expanded)}>
        <span className="tool-card-icon">{isResult ? (isError ? '!' : '\u2713') : '\u25B6'}</span>
        <span className="tool-card-name">
          {isResult ? `Result: ${toolName}` : `Tool: ${toolName}`}
        </span>
        <span className={`tool-card-chevron ${expanded ? 'open' : ''}`}>{'\u25BC'}</span>
      </button>
      {expanded && (
        <div className="tool-card-body">
          {item.tool_input && (
            <pre className="tool-card-input">
              {JSON.stringify(item.tool_input, null, 2)}
            </pre>
          )}
          {item.text && <pre className="tool-card-output">{item.text}</pre>}
        </div>
      )}
    </div>
  );
}
