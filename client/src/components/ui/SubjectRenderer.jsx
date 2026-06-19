import React, { Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import 'katex/dist/katex.min.css';
import 'highlight.js/styles/atom-one-dark.css';
import './SubjectRenderer.css';
import { BlockErrorBoundary, LazyMermaid, LazyFunctionPlot, LazyDataChart } from './blocks';

// Inline mode must never emit block-level elements (it renders inside spans and
// line-clamped containers). Strip block elements, keep their inline children.
const INLINE_DISALLOWED = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'pre', 'hr', 'blockquote', 'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'];

const INLINE_REMARK = [remarkMath];
const INLINE_REHYPE = [rehypeKatex];
const BLOCK_REMARK = [remarkGfm, remarkMath];
const BLOCK_REHYPE = [rehypeKatex, [rehypeHighlight, { ignoreMissing: true, detect: false }]];

// Extract the raw text of a fenced block whose language mermaid/plot/chart hljs
// left untouched (children is the original string for unknown languages).
const childText = (children) => {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(childText).join('');
  if (children == null || typeof children !== 'object') return String(children ?? '');
  if (children.props) return childText(children.props.children);
  return '';
};

const figureFallback = (label) => (
  <div className="subject-figure-skeleton" aria-label={`Loading ${label}`} />
);

// `pre` becomes a pass-through so the `code` override owns the block container
// (avoids a nested <pre><pre>).
const PassThrough = ({ children }) => <>{children}</>;

const InlineCode = ({ children }) => <code className="subject-code-inline">{children}</code>;

const SubjectCode = ({ className, children, ...props }) => {
  const match = /language-([\w-]+)/.exec(className || '');
  const lang = match ? match[1] : '';
  const isBlock = !!match || childText(children).includes('\n');

  if (lang === 'mermaid') {
    const code = childText(children).replace(/\n$/, '');
    return (
      <BlockErrorBoundary label="Diagram" fallbackCode={code}>
        <Suspense fallback={figureFallback('diagram')}><LazyMermaid code={code} /></Suspense>
      </BlockErrorBoundary>
    );
  }
  if (lang === 'plot') {
    const spec = childText(children).replace(/\n$/, '');
    return (
      <BlockErrorBoundary label="Graph" fallbackCode={spec}>
        <Suspense fallback={figureFallback('graph')}><LazyFunctionPlot spec={spec} /></Suspense>
      </BlockErrorBoundary>
    );
  }
  if (lang === 'chart') {
    const spec = childText(children).replace(/\n$/, '');
    return (
      <BlockErrorBoundary label="Chart" fallbackCode={spec}>
        <Suspense fallback={figureFallback('chart')}><LazyDataChart spec={spec} /></Suspense>
      </BlockErrorBoundary>
    );
  }

  if (!isBlock) {
    return <code className="subject-code-inline" {...props}>{children}</code>;
  }
  return (
    <pre className="subject-code-block">
      <code className={className} {...props}>{children}</code>
    </pre>
  );
};

const BLOCK_COMPONENTS = { pre: PassThrough, code: SubjectCode };
const INLINE_COMPONENTS = { code: InlineCode };

/**
 * Renders study content as markdown: GFM tables/lists, LaTeX math (KaTeX),
 * syntax-highlighted code, and AI-drawn figures (```mermaid / ```plot / ```chart).
 *
 * `inline` keeps output strictly inline (no block tags) for MCQ options, card
 * fronts, and other in-line call sites.
 */
const SubjectRenderer = ({ content, className = '', inline = false }) => {
  const text = typeof content === 'string' ? content : (content == null ? '' : String(content));

  if (inline) {
    return (
      <span className={`subject-renderer subject-renderer--inline ${className}`.trim()}>
        <ReactMarkdown
          remarkPlugins={INLINE_REMARK}
          rehypePlugins={INLINE_REHYPE}
          disallowedElements={INLINE_DISALLOWED}
          unwrapDisallowed
          components={INLINE_COMPONENTS}
        >
          {text}
        </ReactMarkdown>
      </span>
    );
  }

  return (
    <div className={`subject-renderer ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={BLOCK_REMARK}
        rehypePlugins={BLOCK_REHYPE}
        components={BLOCK_COMPONENTS}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
};

export default React.memo(SubjectRenderer);
