import { MarkdownBlock } from './MarkdownBlock';

type Props = { text: string };

export function StreamingText({ text }: Props) {
  if (!text) return null;
  return (
    <div className="message-bubble assistant streaming">
      <div className="bubble-role">Assistant</div>
      <div className="bubble-content">
        <MarkdownBlock text={text} />
        <span className="cursor-blink" />
      </div>
    </div>
  );
}
