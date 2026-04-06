import { useRef, useState } from 'react';
import type { AttachmentPayload } from '../types';
import { useFileUpload } from '../hooks/useFileUpload';
import { AttachmentPreview } from './AttachmentPreview';

type Props = {
  onSubmit: (text: string, attachments?: AttachmentPayload[]) => void;
  disabled: boolean;
};

export function ChatInput({ onSubmit, disabled }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const {
    attachments,
    fileInputRef,
    removeAttachment,
    clearAttachments,
    openFilePicker,
    handleFileInputChange,
    handleDrop,
    handleDragOver,
    handlePaste,
  } = useFileUpload();

  const [dragActive, setDragActive] = useState(false);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    onSubmit(trimmed, attachments.length > 0 ? attachments : undefined);
    setText('');
    clearAttachments();
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!disabled) handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    // Auto-grow
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px';
  };

  return (
    <div
      className={`chat-input-container ${dragActive ? 'drag-active' : ''}`}
      onDrop={(e) => {
        handleDrop(e);
        setDragActive(false);
      }}
      onDragOver={(e) => {
        handleDragOver(e);
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
    >
      <AttachmentPreview attachments={attachments} onRemove={removeAttachment} />
      <div className="input-row">
        <button
          className="attach-btn"
          onClick={openFilePicker}
          title="Attach files (images, markdown)"
          disabled={disabled}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
        </button>
        <textarea
          ref={textareaRef}
          className="chat-textarea"
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={disabled ? 'Waiting for response...' : 'Type a message... (Enter to send, Shift+Enter for newline)'}
          disabled={disabled}
          rows={1}
        />
        <button
          className="send-btn"
          onClick={handleSubmit}
          disabled={disabled || (!text.trim() && attachments.length === 0)}
          title="Send message"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,.md,.markdown,text/markdown"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      {dragActive && (
        <div className="drag-overlay">
          <div className="drag-overlay-text">Drop files here</div>
        </div>
      )}
    </div>
  );
}
