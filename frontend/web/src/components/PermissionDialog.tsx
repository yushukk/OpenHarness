import { useState } from 'react';
import type { SelectOptionPayload } from '../types';

type Props = {
  modal: Record<string, unknown>;
  onRespond: (payload: Record<string, unknown>) => void;
};

export function PermissionDialog({ modal, onRespond }: Props) {
  const [answer, setAnswer] = useState('');
  const kind = (modal.kind as string) || '';
  const requestId = (modal.request_id as string) || '';
  const toolName = (modal.tool_name as string) || '';
  const reason = (modal.reason as string) || '';
  const question = (modal.question as string) || '';
  const selectOptions = (modal.select_options as SelectOptionPayload[] | undefined) || [];

  if (kind === 'permission') {
    return (
      <div className="modal-overlay">
        <div className="modal-dialog">
          <div className="modal-title">Permission Request</div>
          <div className="modal-message">
            {toolName && <strong>{toolName}: </strong>}
            {reason}
          </div>
          <div className="modal-actions">
            <button
              className="modal-btn modal-btn-deny"
              onClick={() =>
                onRespond({ type: 'permission_response', request_id: requestId, allowed: false })
              }
            >
              Deny
            </button>
            <button
              className="modal-btn modal-btn-allow"
              onClick={() =>
                onRespond({ type: 'permission_response', request_id: requestId, allowed: true })
              }
            >
              Allow
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (kind === 'question') {
    if (selectOptions.length > 0) {
      return (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-title">Question</div>
            <div className="modal-message">{question}</div>
            <div className="modal-options">
              {selectOptions.map((opt) => (
                <button
                  key={opt.value}
                  className="modal-option-btn"
                  title={opt.description || ''}
                  onClick={() =>
                    onRespond({ type: 'question_response', request_id: requestId, answer: opt.value })
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="modal-overlay">
        <div className="modal-dialog">
          <div className="modal-title">Question</div>
          <div className="modal-message">{question}</div>
          <div className="modal-input-row">
            <input
              className="modal-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && answer.trim()) {
                  onRespond({ type: 'question_response', request_id: requestId, answer });
                  setAnswer('');
                }
              }}
              placeholder="Type your answer..."
              autoFocus
            />
            <button
              className="modal-btn modal-btn-allow"
              disabled={!answer.trim()}
              onClick={() => {
                onRespond({ type: 'question_response', request_id: requestId, answer });
                setAnswer('');
              }}
            >
              Submit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
