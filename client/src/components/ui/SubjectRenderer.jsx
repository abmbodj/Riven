import React, { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import './SubjectRenderer.css';

/**
 * Tokenizer regex: matches (in order of precedence):
 * 1. Block math: $$...$$
 * 2. Inline math: $...$  (not preceded/followed by $, not containing newlines)
 * 3. Code blocks: ```lang\n...\n```
 * 4. Inline code: `...`
 * 5. Bold text: **...**
 */
const TOKEN_RE = /(\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\$)([^\$\n]+?)\$(?!\$)|```(\w*)\n?([\s\S]*?)```|`([^`\n]+)`|\*\*([^*]+)\*\*)/g;

const renderKatex = (tex, displayMode) => {
  try {
    return katex.renderToString(tex, {
      throwOnError: false,
      displayMode,
      strict: false,
    });
  } catch {
    return tex;
  }
};

const tokenize = (content) => {
  if (!content || typeof content !== 'string') return [{ type: 'text', value: content || '' }];

  const tokens = [];
  let lastIndex = 0;

  for (const match of content.matchAll(TOKEN_RE)) {
    const fullMatch = match[0];
    const index = match.index;

    if (index > lastIndex) {
      tokens.push({ type: 'text', value: content.slice(lastIndex, index) });
    }

    if (fullMatch.startsWith('$$')) {
      tokens.push({ type: 'block_math', value: fullMatch.slice(2, -2).trim() });
    } else if (fullMatch.startsWith('```')) {
      tokens.push({ type: 'code_block', lang: match[3] || '', value: match[4] || '' });
    } else if (fullMatch.startsWith('`')) {
      tokens.push({ type: 'inline_code', value: match[5] || '' });
    } else if (fullMatch.startsWith('**')) {
      tokens.push({ type: 'bold', value: match[6] || '' });
    } else if (fullMatch.startsWith('$')) {
      tokens.push({ type: 'inline_math', value: match[2] || '' });
    }

    lastIndex = index + fullMatch.length;
  }

  if (lastIndex < content.length) {
    tokens.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return tokens;
};

const SubjectRenderer = ({ content, className = '', inline = false }) => {
  const tokens = useMemo(() => tokenize(content), [content]);

  // Fast path: if there's only plain text, render directly
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
            dangerouslySetInnerHTML={{ __html: renderKatex(token.value, true) }}
          />
        );
      case 'inline_math':
        return (
          <span
            key={i}
            className="subject-math-inline"
            dangerouslySetInnerHTML={{ __html: renderKatex(token.value, false) }}
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

export default SubjectRenderer;
