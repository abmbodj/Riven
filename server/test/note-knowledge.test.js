import { describe, expect, it } from 'vitest';

import { resolveNoteStrategy } from '../../supabase/functions/_shared/subjectStrategies.mjs';
import { validateNoteDoc } from '../../supabase/functions/_shared/noteValidator.mjs';
import {
  normalizeKnowledgeLayer,
  buildKnowledgeContext,
  buildKnowledgeExtractionPrompt,
  mergeMaxTokens,
} from '../../supabase/functions/_shared/noteKnowledge.mjs';
import {
  buildNoteDraftPrompt,
  buildNoteEnrichPrompt,
  buildMergePrompt,
} from '../../supabase/functions/_shared/notePrompts.mjs';
import {
  buildDeckContents,
  buildExamContents,
  buildNaturalNoteStyleInstructions,
} from '../../supabase/functions/_shared/aiCore.mjs';

const heading = (text, level = 2) => ({ type: 'heading', attrs: { level }, content: [{ type: 'text', text }] });
const bullet = (text) => ({
  type: 'bulletList',
  content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }],
});

describe('content-type detection (resolveNoteStrategy)', () => {
  it('overrides the subject default when the transcript reads as a meeting', () => {
    const text = 'Action items: Sarah is the owner. We decided to ship Friday. Next steps: follow up. Deadline next week. Attendees agreed.';
    const strategy = resolveNoteStrategy({ className: 'Biology 101', subject: 'Biology', sourceText: text });
    expect(strategy.noteMethod).toBe('meeting_discussion');
  });

  it('overrides to procedural when the transcript reads as a how-to', () => {
    const text = 'How to deploy: Step 1, first you install the CLI. Next, configure the workflow. Make sure to run the migration. Best practice: back up. Common mistake: skipping the build.';
    const strategy = resolveNoteStrategy({ className: 'DevOps Training', subject: null, sourceText: text });
    expect(strategy.noteMethod).toBe('procedural_skills');
  });

  it('keeps the subject-mapped method for an ordinary lecture', () => {
    const strategy = resolveNoteStrategy({
      className: 'Calculus',
      subject: 'Mathematics',
      sourceText: 'Today we cover the derivative, the chain rule, and how to solve the integral.',
    });
    expect(strategy.noteMethod).toBe('worked_examples');
  });

  it('maps Languages to the language-learning method', () => {
    const strategy = resolveNoteStrategy({ className: 'Spanish 1', subject: 'Languages', sourceText: 'vocabulary and conjugation' });
    expect(strategy.noteMethod).toBe('language_learning');
  });
});

describe('validateNoteDoc — Action items handling', () => {
  it('does not flag an "Action items" section as a forbidden recap', () => {
    const doc = { type: 'doc', content: [heading('Cellular Respiration'), bullet('ATP is the energy currency'), heading('Action items'), bullet('Problem set due Friday')] };
    const result = validateNoteDoc(doc, { subject: 'Biology' });
    const recapIssue = result.issues.find((i) => /recap|summary section/i.test(i));
    expect(recapIssue).toBeUndefined();
  });

  it('still flags a generic "Summary" recap heading', () => {
    const doc = { type: 'doc', content: [heading('Topic'), bullet('a fact'), heading('Summary'), bullet('restated')] };
    const result = validateNoteDoc(doc, { subject: 'Biology' });
    const recapIssue = result.issues.find((i) => /Remove the recap\/summary/i.test(i));
    expect(recapIssue).toBeDefined();
  });

  it('does not let a single garbled-term reconstruction trip the retry threshold (4) on its own', () => {
    // A reconstructed term won't appear verbatim in the transcript; it must not alone force a retry.
    const doc = {
      type: 'doc',
      content: [
        heading('Cellular Respiration'),
        { type: 'paragraph', content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Citric acid cycle' }, { type: 'text', text: ' is the stage that harvests electrons in the mitochondria.' }] },
        bullet('It releases carbon dioxide each turn.'),
      ],
    };
    const transcript = 'the site rick acid cycle runs in the mitochondria and releases carbon dioxide';
    const result = validateNoteDoc(doc, { subject: 'Biology', transcript });
    expect(result.severity).toBeLessThan(4);
  });
});

describe('normalizeKnowledgeLayer', () => {
  it('returns null for non-object input', () => {
    expect(normalizeKnowledgeLayer(null)).toBeNull();
    expect(normalizeKnowledgeLayer('nope')).toBeNull();
  });

  it('slugifies ids, clamps enums, drops dangling refs, and guarantees arrays', () => {
    const raw = {
      content_type: 'totally-wrong',
      concepts: [
        { id: 'A B!', title: 'Alpha', difficulty: 'wat', emphasis: 'high', prerequisites: ['ghost', 'a-b', 'beta'] },
        { title: 'Beta' },
      ],
      key_terms: [{ term: 'ATP', definition: 'energy', concept_id: 'a-b' }, { definition: 'no term' }],
      action_items: 'not-an-array',
      formulas: null,
    };
    const layer = normalizeKnowledgeLayer(raw);

    expect(layer.content_type).toBe('conceptual_technical'); // clamped to a valid enum
    expect(layer.concepts[0].id).toBe('a-b'); // slugified
    expect(layer.concepts[0].difficulty).toBe('core'); // clamped
    expect(layer.concepts[0].emphasis).toBe('high'); // valid passthrough
    expect(layer.concepts[0].prerequisites).toEqual(['beta']); // ghost dropped, self-ref dropped
    expect(layer.key_terms).toHaveLength(1); // term-less entry dropped
    expect(Array.isArray(layer.action_items)).toBe(true);
    expect(Array.isArray(layer.formulas)).toBe(true);
    expect(Array.isArray(layer.emphasis_signals)).toBe(true);
  });
});

describe('buildKnowledgeContext', () => {
  it('renders concepts, terms, and emphasis; empty for no concepts', () => {
    const layer = normalizeKnowledgeLayer({
      summary: 'Energy from glucose.',
      concepts: [{ id: 'atp', title: 'ATP', learning_objective: 'Explain ATP', emphasis: 'high' }],
      key_terms: [{ term: 'ATP', definition: 'energy currency', concept_id: 'atp' }],
    });
    const ctx = buildKnowledgeContext(layer);
    expect(ctx).toContain('Structured knowledge layer');
    expect(ctx).toContain('ATP');
    expect(ctx).toContain('HIGH-EMPHASIS');
    expect(ctx).toContain('Prioritize');
    expect(buildKnowledgeContext({ concepts: [] })).toBe('');
  });
});

describe('downstream generators consume the knowledge layer', () => {
  const layer = normalizeKnowledgeLayer({
    concepts: [{ id: 'atp', title: 'ATP', learning_objective: 'Explain ATP', emphasis: 'high' }],
    key_terms: [{ term: 'ATP', definition: 'energy currency', concept_id: 'atp' }],
  });
  const knowledgeContext = buildKnowledgeContext(layer);

  it('injects knowledge context into deck contents when provided', () => {
    const withCtx = buildDeckContents({ processedNotes: 'notes', hasProcessedNotes: true, keepFile: false, className: 'Bio', subject: 'Biology', knowledgeContext });
    expect(withCtx.some((c) => (c.text || '').includes('Structured knowledge layer'))).toBe(true);

    const withoutCtx = buildDeckContents({ processedNotes: 'notes', hasProcessedNotes: true, keepFile: false, className: 'Bio', subject: 'Biology' });
    expect(withoutCtx.some((c) => (c.text || '').includes('Structured knowledge layer'))).toBe(false);
  });

  it('injects knowledge context into exam contents when provided', () => {
    const withCtx = buildExamContents({ processedNotes: 'notes', hasProcessedNotes: true, keepFile: false, className: 'Bio', subject: 'Biology', examMode: 'standard', knowledgeContext });
    expect(withCtx.some((c) => (c.text || '').includes('Structured knowledge layer'))).toBe(true);
  });
});

describe('note style instructions', () => {
  it('captures Action items and instructs garbled-term reconstruction', () => {
    const instructions = buildNaturalNoteStyleInstructions({});
    expect(instructions).toContain('Action items');
    expect(instructions).toMatch(/reconstruct the intended term/i);
    expect(instructions).toMatch(/this will be on the exam/i);
  });
});

describe('buildKnowledgeExtractionPrompt', () => {
  it('embeds the note text and transcript and asks for JSON only', () => {
    const doc = { type: 'doc', content: [heading('ATP'), bullet('energy currency')] };
    const prompt = buildKnowledgeExtractionPrompt(doc, 'transcript about ATP', 'Bio', 'Biology', 'process_diagram');
    expect(prompt).toContain('Output ONLY a valid JSON object');
    expect(prompt).toContain('transcript about ATP');
    expect(prompt).toContain('learning_objective');
  });
});

describe('prompts adapt to typed-notes presence and source kind', () => {
  it('preserves the student\'s notes when they typed something', () => {
    const withNotes = buildNoteDraftPrompt('my rough notes', 'Bio', 'Biology', 'transcript');
    expect(withNotes).toMatch(/Preserve every point the student already wrote/);
    expect(withNotes).toMatch(/Preserve the student's original wording/);
  });

  it('generates clean notes when there are no typed notes', () => {
    const noNotes = buildNoteDraftPrompt(null, 'Bio', 'Biology', 'transcript');
    expect(noNotes).toMatch(/Generate clean, usable notes directly from the lecture audio/);
    expect(noNotes).not.toMatch(/Preserve the student's original wording/);
  });

  it('uses source-appropriate wording for text vs audio', () => {
    const text = buildNoteDraftPrompt('rough notes', 'Bio', 'Biology', 'rough notes', { sourceKind: 'notes' });
    expect(text).toContain('your notes');
    expect(text).not.toContain('the lecture audio');

    const audio = buildNoteEnrichPrompt(null, 'Bio', { type: 'doc', content: [] }, 'Biology', 'transcript');
    expect(audio).toContain('the lecture audio');
  });
});

describe('length scaling', () => {
  it('every note prompt carries the length-proportionality directive', () => {
    for (const prompt of [
      buildNoteDraftPrompt('x', 'Bio', 'Biology', 't'),
      buildNoteEnrichPrompt('x', 'Bio', { type: 'doc', content: [] }, 'Biology', 't'),
      buildMergePrompt('x', 'Bio', [{ type: 'doc', content: [] }], 'Biology'),
    ]) {
      expect(prompt).toMatch(/Scale the notes to the material/);
    }
  });

  it('the merge prompt is preservation-oriented', () => {
    const merge = buildMergePrompt(null, 'Bio', [{ type: 'doc', content: [] }], 'Biology');
    expect(merge).toMatch(/Preserve ALL distinct content from every section/);
    expect(merge).toMatch(/do NOT shorten, summarize, or drop sections/i);
  });

  it('merge token budget grows with section count and caps at 32768', () => {
    expect(mergeMaxTokens(2)).toBe(8944);
    expect(mergeMaxTokens(18)).toBe(31344);
    expect(mergeMaxTokens(50)).toBe(32768); // capped
    expect(mergeMaxTokens(18)).toBeGreaterThan(mergeMaxTokens(4)); // proportional
  });
});
