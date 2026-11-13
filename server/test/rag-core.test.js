import { describe, expect, it } from 'vitest';

import pricing from '../../supabase/functions/_shared/llmPricing.json' with { type: 'json' };
import {
  buildRagContext,
  chunkBlocks,
  computeCostUsd,
  estimateTokens,
  formatCitation,
  isWeakRetrieval,
  pagesToBlocks,
  plainTextToBlocks,
  rrfMerge,
  segmentsToBlocks,
  tiptapToBlocks,
  uploadSourceId,
} from '../../supabase/functions/_shared/ragCore.mjs';

const sentence = (i) => `Sentence number ${i} explains one idea about cellular respiration in detail.`; // ~19 tokens
const para = (from, n) => Array.from({ length: n }, (_, i) => sentence(from + i)).join(' ');

describe('structure extraction', () => {
  it('tracks the nearest heading for tiptap blocks', () => {
    const doc = { type: 'doc', content: [
      { type: 'heading', content: [{ type: 'text', text: 'Glycolysis' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Glucose is split.' }] },
      { type: 'heading', content: [{ type: 'text', text: 'Krebs cycle' }] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Makes NADH.' }] }] }] },
    ] };
    expect(tiptapToBlocks(doc)).toEqual([
      { text: 'Glucose is split.', meta: { heading: 'Glycolysis' } },
      { text: 'Makes NADH.', meta: { heading: 'Krebs cycle' } },
    ]);
  });

  it('parses headings, page markers and timestamps from plain text', () => {
    const blocks = plainTextToBlocks('--- Lecture 4 ---\n[Page 2]\nIntro text.\n\n[03:15] The speaker defines ATP.\n[1:02:03] Later point.');
    expect(blocks).toEqual([
      { text: 'Intro text.', meta: { heading: 'Lecture 4', page: 2 } },
      { text: 'The speaker defines ATP.', meta: { heading: 'Lecture 4', page: 2, start_ms: 195000, end_ms: 195000 } },
      { text: 'Later point.', meta: { heading: 'Lecture 4', page: 2, start_ms: 3723000, end_ms: 3723000 } },
    ]);
  });

  it('numbers PDF pages from 1 and drops empty pages', () => {
    expect(pagesToBlocks(['a', '  ', 'c'])).toEqual([
      { text: 'a', meta: { page: 1 } },
      { text: 'c', meta: { page: 3 } },
    ]);
  });
});

describe('chunkBlocks', () => {
  it('never lets a chunk span two headings or two pages', () => {
    const chunks = chunkBlocks([
      { text: 'Short A.', meta: { heading: 'A' } },
      { text: 'Short B.', meta: { heading: 'B' } },
      { text: 'Page one.', meta: { page: 1 } },
      { text: 'Page two.', meta: { page: 2 } },
    ]);
    expect(chunks.map((c) => c.metadata)).toEqual([{ heading: 'A' }, { heading: 'B' }, { page: 1 }, { page: 2 }]);
    expect(chunks[0].content).toBe('A\nShort A.'); // heading is kept in the chunk text
    expect(chunks.map((c) => c.chunk_index)).toEqual([0, 1, 2, 3]);
  });

  it('splits long sections into 500–800 token chunks with ~15% overlap', () => {
    // 150 one-sentence blocks under one heading ≈ 2900 tokens.
    const blocks = Array.from({ length: 150 }, (_, i) => ({ text: sentence(i), meta: { heading: 'Respiration' } }));
    const chunks = chunkBlocks(blocks);
    expect(chunks.length).toBeGreaterThanOrEqual(4);
    for (const c of chunks.slice(0, -1)) {
      expect(c.token_count).toBeGreaterThanOrEqual(500);
      expect(c.token_count).toBeLessThanOrEqual(800);
    }
    // Overlap: the next chunk starts with sentences from the end of the previous one.
    for (let i = 1; i < chunks.length; i++) {
      const prevLast = chunks[i - 1].content.split('\n').at(-1);
      expect(chunks[i].content).toContain(prevLast);
      const overlapLines = chunks[i].content.split('\n').filter((l) => chunks[i - 1].content.includes(l) && l !== 'Respiration');
      const overlapTokens = estimateTokens(overlapLines.join('\n'));
      expect(overlapTokens / chunks[i - 1].token_count).toBeGreaterThan(0.1);
      expect(overlapTokens / chunks[i - 1].token_count).toBeLessThan(0.25);
    }
    // Every sentence survives chunking.
    const all = chunks.map((c) => c.content).join('\n');
    for (let i = 0; i < 150; i++) expect(all).toContain(sentence(i));
  });

  it('splits a single oversized paragraph by sentence', () => {
    const chunks = chunkBlocks([{ text: para(0, 120), meta: { page: 3 } }]);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((c) => c.token_count <= 800 && c.metadata.page === 3)).toBe(true);
  });

  it('carries transcript time ranges', () => {
    const segs = Array.from({ length: 80 }, (_, i) => ({ text: sentence(i), start_ms: i * 10_000, end_ms: i * 10_000 + 9_000 }));
    const chunks = chunkBlocks(segmentsToBlocks(segs));
    expect(chunks[0].metadata.start_ms).toBe(0);
    expect(chunks[0].metadata.end_ms).toBeGreaterThan(0);
    expect(chunks[1].metadata.start_ms).toBeGreaterThan(0);
    expect(chunks.at(-1).metadata.end_ms).toBe(79 * 10_000 + 9_000);
  });

  it('is deterministic (stable chunk_index for idempotent upserts)', () => {
    const blocks = Array.from({ length: 60 }, (_, i) => ({ text: sentence(i), meta: {} }));
    expect(chunkBlocks(blocks)).toEqual(chunkBlocks(blocks));
  });
});

describe('rrfMerge', () => {
  it('scores by sum of 1/(k + rank)', () => {
    const merged = rrfMerge([['a', 'b', 'c'], ['c', 'a']], 60);
    expect(merged.map((m) => m.id)).toEqual(['a', 'c', 'b']);
    expect(merged[0].score).toBeCloseTo(1 / 61 + 1 / 62, 12);
    expect(merged[1].score).toBeCloseTo(1 / 63 + 1 / 61, 12);
    expect(merged[2].score).toBeCloseTo(1 / 62, 12);
  });

  it('rewards agreement across lists over a single top rank', () => {
    const merged = rrfMerge([['solo', 'both'], ['other', 'both']]);
    expect(merged[0].id).toBe('both');
  });

  it('accepts objects with ids and handles empty lists', () => {
    expect(rrfMerge([[{ id: 1 }], []])).toEqual([{ id: 1, score: 1 / 61 }]);
    expect(rrfMerge([])).toEqual([]);
  });
});

describe('computeCostUsd', () => {
  it('prices chat tokens from the pricing config', () => {
    // gpt-5.4-mini: $0.75 in / $4.50 out per 1M tokens
    expect(computeCostUsd(pricing, { model: 'gpt-5.4-mini', inputTokens: 1_000_000, outputTokens: 0 })).toBe(0.75);
    expect(computeCostUsd(pricing, { model: 'gpt-5.4-mini', inputTokens: 2000, outputTokens: 500 })).toBeCloseTo(0.0015 + 0.00225, 10);
  });

  it('prices embeddings and audio minutes', () => {
    expect(computeCostUsd(pricing, { model: 'gemini-embedding-2', inputTokens: 500_000 })).toBe(0.1);
    expect(computeCostUsd(pricing, { model: 'whisper-1', audioSeconds: 90 })).toBeCloseTo(0.009, 10);
  });

  it('returns null for an unpriced model instead of inventing zero', () => {
    expect(computeCostUsd(pricing, { model: 'mystery-model', inputTokens: 10 })).toBeNull();
  });
});

describe('citations and weak retrieval', () => {
  it('formats page, timestamp and heading citations', () => {
    expect(formatCitation('Lecture 3', { page: 4 })).toBe('[Lecture 3, p. 4]');
    expect(formatCitation('Podcast', { start_ms: 725_000 })).toBe('[Podcast, 12:05]');
    expect(formatCitation('Podcast', { start_ms: 3_725_000 })).toBe('[Podcast, 1:02:05]');
    expect(formatCitation('Podcast', { start_ms: 0, end_ms: 790_000 })).toBe('[Podcast, 0:00–13:10]');
    expect(formatCitation('Notes', { heading: 'Mitosis' })).toBe('[Notes, Mitosis]');
    expect(buildRagContext([{ content: 'x', metadata: { source_title: 'T', page: 1 } }])).toBe('[T, p. 1]\nx');
  });

  it('flags weak retrieval on best similarity', () => {
    expect(isWeakRetrieval([], 0.5)).toBe(true);
    expect(isWeakRetrieval([{ similarity: 0.4 }, { similarity: 0.49 }], 0.5)).toBe(true);
    expect(isWeakRetrieval([{ similarity: 0.4 }, { similarity: 0.61 }], 0.5)).toBe(false);
  });

  it('derives a stable, user-scoped uuid for uploads', async () => {
    const a = await uploadSourceId(1, 'same text');
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(await uploadSourceId(1, 'same text')).toBe(a);
    expect(await uploadSourceId(2, 'same text')).not.toBe(a);
  });
});
