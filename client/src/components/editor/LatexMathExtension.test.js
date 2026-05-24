import { describe, expect, it } from 'vitest';
import { Schema } from '@tiptap/pm/model';
import { DecorationSet } from '@tiptap/pm/view';

import { buildLatexMathDecorations } from './LatexMathExtension';

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    text: { group: 'inline' },
  },
  marks: {
    code: {},
  },
});

describe('buildLatexMathDecorations', () => {
  it('creates decorations for inline LaTeX in a paragraph', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('Solve $x^2 = 4$')]),
    ]);

    const set = buildLatexMathDecorations(doc);
    expect(set).toBeInstanceOf(DecorationSet);
    expect(set.find().length).toBeGreaterThan(0);
  });

  it('skips text with code marks', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [
        schema.text('$x^2$', [schema.mark('code')]),
      ]),
    ]);

    const set = buildLatexMathDecorations(doc);
    expect(set.find().length).toBe(0);
  });

  it('returns empty set when there is no math', () => {
    const doc = schema.node('doc', null, [
      schema.node('paragraph', null, [schema.text('plain notes')]),
    ]);

    const set = buildLatexMathDecorations(doc);
    expect(set.find().length).toBe(0);
  });
});
