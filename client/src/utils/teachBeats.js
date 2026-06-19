/**
 * Block-aware beat segmenter for tutor "explain" sections.
 *
 * The AI's `teaching.explain` string may contain fenced code blocks, GFM tables,
 * and block-math ($$…$$) in addition to prose paragraphs. These block elements
 * must never be split by the sentence-chunker — each becomes its own atomic reveal
 * "beat." Prose runs continue to chunk at the same 150/240/320 char thresholds as
 * before, so existing guides (no fences) produce pixel-identical output.
 *
 * Beat shapes
 *   { kind: 'text',    id: string, text: string }
 *   { kind: 'block',   id: string, blockType: 'code'|'mermaid'|'plot'|'chart'|'table'|'math', raw: string }
 *   { kind: 'predict', id: string, prompt: string, answer: string }    — injected by buildTeachBeats
 */

const CHUNK_MIN_CHARS = 150;
const CHUNK_TARGET_CHARS = 240;
const CHUNK_MAX_CHARS = 320;

/** Re-exported so callers that only need the text chunker can import it here. */
export const chunkExplain = (raw) => {
  if (!raw || typeof raw !== 'string') return [];
  const paragraphs = raw.split('\n\n').map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const para of paragraphs) {
    if (para.length <= CHUNK_MAX_CHARS) {
      out.push(para);
      continue;
    }
    const sentences = (para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [para])
      .map((s) => s.trim())
      .filter(Boolean);
    let buf = '';
    for (const s of sentences) {
      if (!buf) { buf = s; continue; }
      if ((`${buf} ${s}`).length > CHUNK_TARGET_CHARS && buf.length >= CHUNK_MIN_CHARS) {
        out.push(buf);
        buf = s;
      } else {
        buf = `${buf} ${s}`;
      }
    }
    if (buf) out.push(buf);
  }
  return out;
};

// Patterns that mark the START of an atomic block (captured as a whole).
// Order matters: fences first (greedy), then tables, then block math.
const FENCED_BLOCK_RE = /^```([\w-]*)\n([\s\S]*?)^```\s*$/m;
const BLOCK_MATH_RE = /^\$\$([\s\S]+?)\$\$/m;
// A GFM table row: | …cells… |
const TABLE_ROW_RE = /^\|.+\|/;

const LANG_TO_BLOCK_TYPE = { mermaid: 'mermaid', plot: 'plot', chart: 'chart' };

let _idCounter = 0;
const nextId = (prefix) => `${prefix}-${++_idCounter}`;

/**
 * Splits a markdown string into an ordered list of segments that are either
 * "prose" (string) or "block" objects. Does not sentence-chunk prose yet.
 */
const splitSegments = (text) => {
  const segments = [];
  let remaining = text;

  while (remaining.length > 0) {
    // Try to find the first occurrence of any block pattern
    const fenceMatch = FENCED_BLOCK_RE.exec(remaining);
    const mathMatch = BLOCK_MATH_RE.exec(remaining);

    // Detect a table block: consecutive lines starting with |
    let tableStart = -1;
    let tableEnd = -1;
    const lines = remaining.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (TABLE_ROW_RE.test(lines[i])) {
        if (tableStart === -1) tableStart = i;
        tableEnd = i;
      } else if (tableStart !== -1) break;
    }
    let tableOffset = -1;
    let tableRaw = '';
    if (tableStart !== -1) {
      // Compute byte offset of that line block in `remaining`
      let off = 0;
      for (let i = 0; i < tableStart; i++) off += lines[i].length + 1;
      tableOffset = off;
      tableRaw = lines.slice(tableStart, tableEnd + 1).join('\n');
    }

    // Pick whichever block type appears first
    const candidates = [
      fenceMatch ? { type: 'fence', offset: fenceMatch.index, match: fenceMatch } : null,
      mathMatch ? { type: 'math', offset: mathMatch.index, match: mathMatch } : null,
      tableOffset >= 0 ? { type: 'table', offset: tableOffset, raw: tableRaw } : null,
    ].filter(Boolean);

    if (candidates.length === 0) {
      // No more blocks — remainder is pure prose
      if (remaining.trim()) segments.push({ type: 'prose', text: remaining });
      break;
    }

    // Sort by position to get the earliest block
    candidates.sort((a, b) => a.offset - b.offset);
    const first = candidates[0];

    // Push prose before this block (if any)
    if (first.offset > 0) {
      const prose = remaining.slice(0, first.offset).trim();
      if (prose) segments.push({ type: 'prose', text: prose });
    }

    if (first.type === 'fence') {
      const lang = (first.match[1] || '').toLowerCase();
      const blockType = LANG_TO_BLOCK_TYPE[lang] || 'code';
      segments.push({ type: 'block', blockType, raw: first.match[0] });
      remaining = remaining.slice(first.offset + first.match[0].length).replace(/^\n/, '');
    } else if (first.type === 'math') {
      segments.push({ type: 'block', blockType: 'math', raw: first.match[0] });
      remaining = remaining.slice(first.offset + first.match[0].length).replace(/^\n/, '');
    } else {
      // table
      segments.push({ type: 'block', blockType: 'table', raw: first.raw });
      remaining = remaining.slice(first.offset + first.raw.length).replace(/^\n/, '');
    }
  }
  return segments;
};

/**
 * Converts a `teaching` card (or a raw explain string) into an ordered array of
 * beats. Old guides that have no blocks yield all-text beats → unchanged behavior.
 *
 * Optionally injects `predict` beats from `card.teaching.predicts` between beats.
 */
export const buildTeachBeats = (card) => {
  const teaching = card?.teaching;
  if (!teaching) return [];

  // If the AI emitted pre-segmented beats (v5+ schema), use them directly.
  if (Array.isArray(teaching.explain_beats) && teaching.explain_beats.length > 0) {
    const beats = teaching.explain_beats
      .map((b) => {
        if (!b || typeof b !== 'object') return null;
        if (b.kind === 'text') return { kind: 'text', id: nextId('t'), text: String(b.text || '') };
        if (b.kind === 'block') return { kind: 'block', id: nextId('bl'), blockType: String(b.blockType || 'code'), raw: String(b.raw || '') };
        if (b.kind === 'predict') return { kind: 'predict', id: nextId('p'), prompt: String(b.prompt || ''), answer: String(b.answer || '') };
        return null;
      })
      .filter(Boolean);
    return injectPredicts(beats, teaching.predicts);
  }

  // Legacy path: segment the explain string
  const explain = teaching.explain;
  if (!explain || typeof explain !== 'string') return [];

  const segments = splitSegments(explain);
  const beats = [];
  for (const seg of segments) {
    if (seg.type === 'block') {
      beats.push({ kind: 'block', id: nextId('bl'), blockType: seg.blockType, raw: seg.raw });
    } else {
      // Prose: run through the existing text chunker
      const chunks = chunkExplain(seg.text);
      for (const chunk of chunks) {
        beats.push({ kind: 'text', id: nextId('t'), text: chunk });
      }
    }
  }

  return injectPredicts(beats, teaching.predicts);
};

const injectPredicts = (beats, predicts) => {
  if (!Array.isArray(predicts) || predicts.length === 0) return beats;
  const result = [...beats];
  // Insert in reverse order to preserve indices
  const sorted = [...predicts].sort((a, b) => (b.after_beat ?? Infinity) - (a.after_beat ?? Infinity));
  for (const p of sorted) {
    if (!p.prompt || !p.answer) continue;
    const insertAt = p.after_beat != null
      ? Math.min(Math.max(0, p.after_beat), result.length)
      : Math.max(0, result.length - 1);
    result.splice(insertAt, 0, { kind: 'predict', id: nextId('p'), prompt: p.prompt, answer: p.answer });
  }
  return result;
};
