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

/**
 * Rich-text tokenizer for study surfaces (math, code, bold).
 */
const RICH_TEXT_TOKEN_RE = /(\$\$[\s\S]+?\$\$|(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)|```(\w*)\n?([\s\S]*?)```|`([^`\n]+)`|\*\*([^*]+)\*\*)/g;

export const tokenizeRichText = (content) => {
  if (!content || typeof content !== 'string') {
    return [{ type: 'text', value: content || '' }];
  }

  const tokens = [];
  let lastIndex = 0;

  for (const match of content.matchAll(RICH_TEXT_TOKEN_RE)) {
    const fullMatch = match[0];
    const index = match.index ?? 0;

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
