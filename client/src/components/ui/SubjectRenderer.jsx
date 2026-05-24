import React, { useMemo } from 'react';
import 'katex/dist/katex.min.css';
import { renderKatexHtml, tokenizeRichText } from '../../utils/richTextMath';
import './SubjectRenderer.css';

const SubjectRenderer = ({ content, className = '', inline = false }) => {
  const tokens = useMemo(() => tokenizeRichText(content), [content]);

  if (tokens.length === 1 && tokens[0].type === 'text') {
    if (inline) return <span className={className}>{tokens[0].value}</span>;
    return <div className={`subject-renderer ${className}`.trim()}>{tokens[0].value}</div>;
  }

  const rendered = tokens.map((token, i) => {
    switch (token.type) {
      case 'block_math':
        return (
          <div
            key={i}
            className="subject-math-block"
            dangerouslySetInnerHTML={{ __html: renderKatexHtml(token.value, true) }}
          />
        );
      case 'inline_math':
        return (
          <span
            key={i}
            className="subject-math-inline"
            dangerouslySetInnerHTML={{ __html: renderKatexHtml(token.value, false) }}
          />
        );
      case 'code_block':
        return (
          <pre key={i} className="subject-code-block">
            <code className={token.lang ? `language-${token.lang}` : ''}>
              {token.value}
            </code>
          </pre>
        );
      case 'inline_code':
        return <code key={i} className="subject-code-inline">{token.value}</code>;
      case 'bold':
        return <strong key={i}>{token.value}</strong>;
      case 'text':
      default:
        return <React.Fragment key={i}>{token.value}</React.Fragment>;
    }
  });

  if (inline) {
    return <span className={`subject-renderer ${className}`}>{rendered}</span>;
  }

  return <div className={`subject-renderer ${className}`}>{rendered}</div>;
};

export default React.memo(SubjectRenderer);
