import katex from 'katex';

/**
 * Matches block math ($$...$$) then inline math ($...$), same rules as SubjectRenderer.
 */
const MATH_TOKEN_RE = /(\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$))/g;

export const renderKatexHtml = (tex, displayMode = false) => {
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

/**
 * @param {string} text
 * @returns {{ start: number, end: number, tex: string, displayMode: boolean }[]}
 */
export const findMathSpans = (text) => {
  if (!text || typeof text !== 'string') return [];

  const spans = [];
  for (const match of text.matchAll(MATH_TOKEN_RE)) {
    const fullMatch = match[0];
    const index = match.index ?? 0;
    if (fullMatch.startsWith('$$')) {
      spans.push({
        start: index,
        end: index + fullMatch.length,
        tex: fullMatch.slice(2, -2).trim(),
        displayMode: true,
      });
    } else if (fullMatch.startsWith('$')) {
      spans.push({
        start: index,
        end: index + fullMatch.length,
        tex: (match[2] || '').trim(),
        displayMode: false,
      });
    }
  }

  return spans;
};

