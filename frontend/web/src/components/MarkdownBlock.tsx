import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

type Props = { text: string };

export function MarkdownBlock({ text }: Props) {
  return (
    <ReactMarkdown
      components={{
        code({ className, children, ...rest }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');

          if (match) {
            return (
              <div className="code-block">
                <div className="code-block-header">
                  <span className="code-lang">{match[1]}</span>
                  <button
                    className="copy-btn"
                    onClick={() => navigator.clipboard.writeText(codeString)}
                  >
                    Copy
                  </button>
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: '0 0 6px 6px' }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className={className} {...rest}>
              {children}
            </code>
          );
        },
      }}
    >
      {text}
    </ReactMarkdown>
  );
}
