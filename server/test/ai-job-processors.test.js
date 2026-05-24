import { describe, expect, it } from 'vitest';

import {
  buildMergePrompt,
  buildNoteDraftPrompt,
  buildNoteEnrichPrompt,
  buildSectionNotePrompt,
  buildYoutubeSourcePrompt,
} from '../../supabase/functions/_shared/notePrompts.mjs';
import { resolveNoteStrategy } from '../../supabase/functions/_shared/subjectStrategies.mjs';
import { validateNoteDoc } from '../../supabase/functions/_shared/noteValidator.mjs';

const paragraph = (text) => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

const heading = (text) => ({
  type: 'heading',
  attrs: { level: 2 },
  content: [{ type: 'text', text }],
});

const doc = (...content) => ({ type: 'doc', content });

describe('note prompts', () => {
  it('builds biology drafts as process and diagram notes without exam-question filler', () => {
    const prompt = buildNoteDraftPrompt('Student note line', 'Biology 101', 'Biology');

    expect(prompt).toContain('college student');
    expect(prompt).toContain('Note method: Process and diagram notes.');
    expect(prompt).toContain('Process map');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('builds math enrichment as worked-example notes with LaTeX expectations', () => {
    const prompt = buildNoteEnrichPrompt('Student note line', 'Calculus II', { type: 'doc', content: [] }, 'Mathematics');

    expect(prompt).toContain('college student');
    expect(prompt).toContain('Note method: Worked-example notes.');
    expect(prompt).toContain('worked example');
    expect(prompt).toContain('Use LaTeX notation throughout');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('uses source text hints for ambiguous section prompts', () => {
    const prompt = buildSectionNotePrompt(
      0,
      3,
      'Student note line',
      'Study Hall',
      null,
      'Rolle theorem formula derivative solve equation',
    );

    expect(prompt).toContain('Note method: Worked-example notes.');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('falls back to Cornell notes for general complete notes', () => {
    const prompt = buildMergePrompt('Student note line', 'Study Skills', [{ type: 'doc', content: [] }], 'General');

    expect(prompt).toContain('Note method: Cornell notes.');
    expect(prompt).toContain('Cue questions');
    expect(prompt).toContain('Review Summary');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps YouTube source note prompts aligned with subject-aware natural notes', () => {
    const prompt = buildYoutubeSourcePrompt('Biology 101', 'Biology', 'cell cycle phase mitosis diagram');

    expect(prompt).toContain('college student');
    expect(prompt).toContain('Note method: Process and diagram notes.');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });
});

describe('note strategy resolution', () => {
  it('lets explicit subject beat class-name inference', () => {
    const strategy = resolveNoteStrategy({ className: 'MATH 251', subject: 'Biology' });

    expect(strategy.subject).toBe('Biology');
    expect(strategy.noteMethod).toBe('process_diagram');
  });

  it.each([
    ['Mathematics', 'worked_examples'],
    ['Biology', 'process_diagram'],
    ['Chemistry', 'worked_examples'],
    ['Physics', 'worked_examples'],
    ['History', 'chronological_causal'],
    ['Literature', 'evidence_analysis'],
    ['Computer Science', 'outline'],
    ['General', 'cornell'],
  ])('maps %s to %s notes', (subject, noteMethod) => {
    expect(resolveNoteStrategy({ subject }).noteMethod).toBe(noteMethod);
  });

  it('uses source text when the class subject is unknown', () => {
    expect(resolveNoteStrategy({
      className: 'Seminar',
      sourceText: 'Find the derivative and solve the equation using the theorem.',
    }).noteMethod).toBe('worked_examples');
  });
});

describe('note validation', () => {
  it('allows Cornell Review Summary but still rejects generic summaries', () => {
    const cornellDoc = doc(
      heading('Cell Cycle'),
      paragraph('Cue questions: What happens during interphase?'),
      paragraph('Interphase is when the cell grows, copies DNA, and prepares for division.'),
      heading('Review Summary'),
      paragraph('The cell cycle moves from growth and copying into division so cells can reproduce accurately.'),
    );
    const genericSummaryDoc = doc(
      heading('Cell Cycle'),
      paragraph('Cue questions: What happens during interphase?'),
      paragraph('Interphase is when the cell grows, copies DNA, and prepares for division.'),
      heading('Summary'),
      paragraph('This is a generic recap.'),
    );

    expect(validateNoteDoc(cornellDoc, { noteMethod: 'cornell' }).ok).toBe(true);
    expect(validateNoteDoc(genericSummaryDoc, { noteMethod: 'cornell' }).issues.join(' ')).toContain('Remove the recap/summary section');
  });

  it('flags worked-example notes that have enough structure but no example or solving pattern', () => {
    const weakMathDoc = doc(
      heading('Derivatives'),
      paragraph('Derivatives describe rate of change.'),
      paragraph('Limits support the definition of derivatives.'),
      paragraph('Functions can increase or decrease over intervals.'),
      paragraph('Notation matters in calculus.'),
    );

    expect(validateNoteDoc(weakMathDoc, { noteMethod: 'worked_examples' }).issues.join(' ')).toContain('Worked-example notes need');
  });
});
