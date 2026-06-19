import { describe, expect, it } from 'vitest';
import { buildTeachBeats, chunkExplain } from './teachBeats';

describe('chunkExplain', () => {
  it('returns empty array for empty input', () => {
    expect(chunkExplain('')).toEqual([]);
    expect(chunkExplain(null)).toEqual([]);
  });

  it('returns short paragraphs intact', () => {
    const text = 'Short paragraph.';
    expect(chunkExplain(text)).toEqual(['Short paragraph.']);
  });

  it('preserves paragraph boundaries', () => {
    const text = 'First paragraph.\n\nSecond paragraph.';
    const result = chunkExplain(text);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe('First paragraph.');
    expect(result[1]).toBe('Second paragraph.');
  });
});

describe('buildTeachBeats', () => {
  it('returns empty array for card with no teaching', () => {
    expect(buildTeachBeats(null)).toEqual([]);
    expect(buildTeachBeats({})).toEqual([]);
  });

  it('converts plain prose into text beats', () => {
    const card = { teaching: { explain: 'Simple explanation here.' } };
    const beats = buildTeachBeats(card);
    expect(beats.length).toBeGreaterThan(0);
    expect(beats[0].kind).toBe('text');
    expect(beats[0].text).toContain('Simple explanation');
  });

  it('extracts a fenced code block as a block beat', () => {
    const card = {
      teaching: {
        explain: 'Some prose.\n\n```python\nprint("hello")\n```\n\nMore prose.',
      },
    };
    const beats = buildTeachBeats(card);
    const kinds = beats.map((b) => b.kind);
    expect(kinds).toContain('block');
    const blockBeat = beats.find((b) => b.kind === 'block');
    expect(blockBeat.blockType).toBe('code');
    expect(blockBeat.raw).toContain('print');
  });

  it('recognises mermaid fence as mermaid block type', () => {
    const card = {
      teaching: {
        explain: 'Prose.\n\n```mermaid\nflowchart LR\n  A-->B\n```\n\nMore.',
      },
    };
    const beats = buildTeachBeats(card);
    const blockBeat = beats.find((b) => b.kind === 'block');
    expect(blockBeat).toBeDefined();
    expect(blockBeat.blockType).toBe('mermaid');
  });

  it('injects predicts at specified after_beat position', () => {
    const card = {
      teaching: {
        explain: 'Beat one.\n\nBeat two.\n\nBeat three.',
        predicts: [{ prompt: 'Predict?', answer: 'Answer!', after_beat: 1 }],
      },
    };
    const beats = buildTeachBeats(card);
    const predictIndex = beats.findIndex((b) => b.kind === 'predict');
    expect(predictIndex).toBe(1);
    expect(beats[predictIndex].prompt).toBe('Predict?');
  });

  it('uses explain_beats when provided', () => {
    const card = {
      teaching: {
        explain: 'Old string should be ignored.',
        explain_beats: [
          { kind: 'text', text: 'Beat A' },
          { kind: 'block', blockType: 'code', raw: '```js\nconsole.log(1)\n```' },
        ],
      },
    };
    const beats = buildTeachBeats(card);
    expect(beats[0].kind).toBe('text');
    expect(beats[0].text).toBe('Beat A');
    expect(beats[1].kind).toBe('block');
  });
});
