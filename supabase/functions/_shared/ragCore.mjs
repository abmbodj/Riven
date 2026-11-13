// Runtime-agnostic RAG core: structure extraction, chunking, RRF, citations, cost.
// Unit-tested from Node (server/test/rag-core.test.js); used by Deno edge functions.

// ponytail: ~4 chars/token heuristic instead of a tokenizer dependency. Good enough for
// chunk sizing (±15%); swap in a real tokenizer if chunk budgets ever need to be exact.
export const estimateTokens = (text) => Math.ceil(String(text || '').length / 4);

const clean = (text) => String(text || '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

// ── Structure extraction → blocks: [{ text, meta: { heading?, page?, start_ms?, end_ms? } }] ──

const tiptapText = (node) => {
  if (!node) return '';
  if (typeof node.text === 'string') return node.text;
  if (!Array.isArray(node.content)) return '';
  const sep = ['paragraph', 'heading', 'listItem', 'codeBlock', 'blockquote'].includes(node.type) ? '\n' : '';
  return node.content.map(tiptapText).join('') + sep;
};

/** Tiptap JSON doc → blocks, tracking the nearest heading for each block. */
export const tiptapToBlocks = (doc) => {
  const blocks = [];
  let heading;
  for (const node of Array.isArray(doc?.content) ? doc.content : []) {
    const text = clean(tiptapText(node));
    if (!text) continue;
    if (node.type === 'heading') { heading = text; continue; }
    blocks.push({ text, meta: heading ? { heading } : {} });
  }
  return blocks;
};

/** PDF pages (array of page strings, 1-based page numbers). */
export const pagesToBlocks = (pages) => pages
  .map((text, i) => ({ text: clean(text), meta: { page: i + 1 } }))
  .filter((b) => b.text);

/** Transcript segments [{ text, start_ms, end_ms }] (audio notes / timed YouTube). */
export const segmentsToBlocks = (segments) => segments
  .map((s) => ({ text: clean(s.text), meta: { start_ms: Number(s.start_ms) || 0, end_ms: Number(s.end_ms ?? s.start_ms) || 0 } }))
  .filter((b) => b.text);

const TS_RE = /^\s*[[(]?((?:\d{1,2}:)?\d{1,2}:\d{2})[\])]?\s*[-–]?\s*/;
const tsToMs = (ts) => ts.split(':').map(Number).reduce((acc, n) => acc * 60 + n, 0) * 1000;

/**
 * Plain text (flattened notes, pptx text, docx, plain transcripts) → blocks.
 * Recognises markdown headings, `--- Title ---` separators, `[Page N]`/`--- Slide N ---` markers,
 * and leading `[mm:ss]` timestamps.
 */
export const plainTextToBlocks = (text) => {
  const blocks = [];
  let heading;
  let page;
  let para = [];
  let paraStart;
  const flush = () => {
    const t = clean(para.join('\n'));
    if (t) {
      const meta = {};
      if (heading) meta.heading = heading;
      if (page) meta.page = page;
      if (paraStart != null) { meta.start_ms = paraStart; meta.end_ms = paraStart; }
      blocks.push({ text: t, meta });
    }
    para = [];
    paraStart = undefined;
  };
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const pageMatch = line.match(/^(?:\[\s*page\s+(\d+)\s*\]|-{2,}\s*(?:page|slide)\s+(\d+)\s*-{2,})$/i);
    if (pageMatch) { flush(); page = Number(pageMatch[1] || pageMatch[2]); continue; }
    const h = line.match(/^#{1,6}\s+(.+)$/) || line.match(/^-{2,}\s*(.+?)\s*-{2,}$/);
    if (h) { flush(); heading = h[1].trim(); continue; }
    if (!line) { flush(); continue; }
    const ts = line.match(TS_RE);
    if (ts && ts[0].length < line.length) {
      // Each timestamped line is its own unit so chunks can cite the exact moment.
      flush();
      paraStart = tsToMs(ts[1]);
      para.push(line.slice(ts[0].length));
      flush();
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
};

// ── Chunking ─────────────────────────────────────────────────────────────────

const sectionKey = (meta) => `${meta.heading ?? ''}\u0000${meta.page ?? ''}`;

const splitSentences = (text) => text.match(/[^.!?\n]+(?:[.!?]+|\n|$)\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [text];

/** Break an oversized block into sentence units (and hard-split runaway sentences). */
const toUnits = (block, maxTokens) => {
  if (estimateTokens(block.text) <= maxTokens) return [block];
  const units = [];
  for (const sentence of splitSentences(block.text)) {
    for (let i = 0; i < sentence.length; i += maxTokens * 4) {
      units.push({ text: sentence.slice(i, i + maxTokens * 4), meta: block.meta });
    }
  }
  return units;
};

const mergeMeta = (units) => {
  const meta = {};
  const first = units[0].meta;
  if (first.heading) meta.heading = first.heading;
  if (first.page != null) meta.page = first.page;
  const starts = units.map((u) => u.meta.start_ms).filter((v) => v != null);
  const ends = units.map((u) => u.meta.end_ms ?? u.meta.start_ms).filter((v) => v != null);
  if (starts.length) { meta.start_ms = Math.min(...starts); meta.end_ms = Math.max(...ends); }
  return meta;
};

/**
 * Structure first (a chunk never spans two headings or two pages), then size: pack units up to
 * `targetTokens` (hard cap `maxTokens`), carrying ~`overlap` of the previous chunk's tail forward.
 * Returns [{ chunk_index, content, token_count, metadata }].
 */
export const chunkBlocks = (blocks, { targetTokens = 650, maxTokens = 800, overlap = 0.15 } = {}) => {
  const sections = [];
  for (const block of blocks) {
    const key = sectionKey(block.meta);
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.units.push(...toUnits(block, maxTokens));
    else sections.push({ key, units: toUnits(block, maxTokens) });
  }

  const chunks = [];
  const emit = (units) => {
    const meta = mergeMeta(units);
    const body = units.map((u) => u.text).join('\n');
    const content = meta.heading ? `${meta.heading}\n${body}` : body;
    chunks.push({ chunk_index: chunks.length, content, token_count: estimateTokens(content), metadata: meta });
  };

  for (const { units } of sections) {
    let current = [];
    let tokens = 0;
    let fresh = 0; // units added since the last emit (overlap units don't count)
    for (const unit of units) {
      const t = estimateTokens(unit.text);
      if (fresh > 0 && (tokens + t > maxTokens || tokens >= targetTokens)) {
        emit(current);
        // Carry the tail (~overlap of the chunk) into the next one.
        const carry = [];
        let carried = 0;
        for (let i = current.length - 1; i > 0 && carried < tokens * overlap; i--) {
          carry.unshift(current[i]);
          carried += estimateTokens(current[i].text);
        }
        current = carry;
        tokens = carried;
        fresh = 0;
      }
      current.push(unit);
      tokens += t;
      fresh++;
    }
    if (fresh > 0) emit(current);
  }
  return chunks;
};

// ── Retrieval helpers ────────────────────────────────────────────────────────

/**
 * Reciprocal rank fusion. `lists` are arrays of ids (or objects with `.id`) in rank order.
 * score(id) = Σ 1/(k + rank), rank starting at 1. Mirrors match_source_chunks() in SQL.
 */
export const rrfMerge = (lists, k = 60) => {
  const scores = new Map();
  for (const list of lists) {
    list.forEach((item, i) => {
      const id = typeof item === 'object' ? item.id : item;
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + i + 1));
    });
  }
  return [...scores.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
};

/** Weak retrieval → the tutor should say it doesn't know. Threshold is on best cosine similarity. */
export const isWeakRetrieval = (chunks, minSimilarity) =>
  !chunks.length || Math.max(...chunks.map((c) => Number(c.similarity) || 0)) < minSimilarity;

const fmtTs = (ms) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/** "[Lecture 3, p. 4]" / "[Bio podcast, 12:05–13:40]" / "[Notes, Mitosis]". */
export const formatCitation = (title, meta = {}) => {
  const where = meta.page != null ? `p. ${meta.page}`
    : meta.start_ms != null
      ? (meta.end_ms > meta.start_ms ? `${fmtTs(meta.start_ms)}–${fmtTs(meta.end_ms)}` : fmtTs(meta.start_ms))
      : meta.heading || null;
  return `[${title || 'Source'}${where ? `, ${where}` : ''}]`;
};

/** Retrieved chunks → the context block the model sees. Each chunk is labelled with its citation. */
export const buildRagContext = (chunks) => chunks
  .map((c) => `${formatCitation(c.metadata?.source_title, c.metadata)}\n${c.content}`)
  .join('\n\n---\n\n');

export const RAG_ANSWER_RULES = `Answer ONLY from the SOURCE EXCERPTS below. Do not use outside knowledge.
After every claim, cite the excerpt it came from using its label exactly as written, e.g. [Lecture 3, p. 4] or [Podcast, 12:05].
If the excerpts do not contain the answer, reply exactly: "I don't know based on your materials." and nothing else.`;

/** The tutor's fixed refusal string; the eval counts refusals by matching it. */
export const RAG_REFUSAL = "I don't know based on your materials.";

// ── Cost ─────────────────────────────────────────────────────────────────────

/**
 * pricing: { models: { "<model>": { input_per_mtok, output_per_mtok, per_audio_minute } } }.
 * Unknown model → null (recorded as unknown cost rather than a made-up zero).
 */
export const computeCostUsd = (pricing, { model, inputTokens = 0, outputTokens = 0, audioSeconds = 0 }) => {
  const p = pricing?.models?.[model];
  if (!p) return null;
  const cost = (inputTokens / 1e6) * (p.input_per_mtok ?? 0)
    + (outputTokens / 1e6) * (p.output_per_mtok ?? 0)
    + (audioSeconds / 60) * (p.per_audio_minute ?? 0);
  return Math.round(cost * 1e8) / 1e8;
};

// ── Identity ─────────────────────────────────────────────────────────────────

/** Content-addressed uuid for an ad-hoc upload so re-uploading the same file reuses its chunks. */
export const uploadSourceId = async (userId, bytesOrText) => {
  const data = typeof bytesOrText === 'string' ? new TextEncoder().encode(bytesOrText) : bytesOrText;
  const prefix = new TextEncoder().encode(`${userId}:`);
  const buf = new Uint8Array(prefix.length + data.length);
  buf.set(prefix);
  buf.set(data, prefix.length);
  const h = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', buf)).slice(0, 16);
  h[6] = (h[6] & 0x0f) | 0x50; // version 5-style
  h[8] = (h[8] & 0x3f) | 0x80;
  const hex = [...h].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const contentHash = async (text) => {
  const h = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text)));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
};
