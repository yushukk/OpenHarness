import type { AttachmentPayload } from '../types';

type Props = {
  attachments: AttachmentPayload[];
  onRemove: (index: number) => void;
};

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function AttachmentPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <div className="attachment-preview-bar">
      {attachments.map((att, i) => (
        <div className="attachment-chip" key={`${att.filename}-${i}`}>
          {IMAGE_TYPES.includes(att.media_type) ? (
            <img
              className="attachment-thumb"
              src={`data:${att.media_type};base64,${att.data}`}
              alt={att.filename}
            />
          ) : (
            <span className="attachment-icon">📄</span>
          )}
          <span className="attachment-name" title={att.filename}>
            {att.filename}
          </span>
          <button className="attachment-remove" onClick={() => onRemove(i)}>
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
