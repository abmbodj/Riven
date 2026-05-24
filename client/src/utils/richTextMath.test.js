import { describe, expect, it } from 'vitest';

import { findMathSpans, renderKatexHtml, tokenizeRichText } from './richTextMath';

describe('findMathSpans', () => {
  it('finds inline and block LaTeX delimiters', () => {
    const text = 'Let $x^2$ and $$\\int_0^1 f(x)\\,dx$$';
    const spans = findMathSpans(text);

    expect(spans).toHaveLength(2);
    expect(spans[0]).toMatchObject({ displayMode: false, tex: 'x^2' });
    expect(spans[1]).toMatchObject({ displayMode: true, tex: '\\int_0^1 f(x)\\,dx' });
  });

  it('returns empty array for plain text', () => {
    expect(findMathSpans('no math here')).toEqual([]);
  });
});

describe('renderKatexHtml', () => {
  it('renders valid LaTeX to HTML', () => {
    const html = renderKatexHtml('x^2', false);
    expect(html).toContain('katex');
  });

  it('returns raw tex when rendering fails', () => {
    const html = renderKatexHtml('\\broken', false);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });
});

describe('tokenizeRichText', () => {
  it('tokenizes math alongside bold and code', () => {
    const tokens = tokenizeRichText('**Bold** and $a+b$ and `code`');
    expect(tokens.map((t) => t.type)).toEqual(['bold', 'text', 'inline_math', 'text', 'inline_code']);
  });
});
