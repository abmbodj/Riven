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
    expect(prompt).toContain('scan faster');
    expect(prompt).toContain('Never output literal markdown markers');
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

  it('falls back to structured outline notes for general complete notes', () => {
    const prompt = buildMergePrompt('Student note line', 'Study Skills', [{ type: 'doc', content: [] }], 'General');

    expect(prompt).toContain('Note method: Structured outline notes.');
    expect(prompt).toContain('H2 topics');
    expect(prompt).toContain('Required shape:');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps YouTube source note prompts aligned with subject-aware natural notes', () => {
    const prompt = buildYoutubeSourcePrompt('Biology 101', 'Biology', 'cell cycle phase mitosis diagram');

    expect(prompt).toContain('college student');
    expect(prompt).toContain('Note method: Process and diagram notes.');
    expect(prompt).toContain('Required shape:');
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
    ['General', 'outline'],
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

  it('flags literal markdown styling leaked into note text', () => {
    const leakedMarkdownDoc = doc(
      heading('Colonial Expansion'),
      paragraph('The **British Empire** grew quickly because it controlled major trade routes.'),
      paragraph('What matters: control of ports translated into economic and military influence.'),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph('Example: naval control made it easier to move goods and troops.')] },
        ],
      },
    );

    const findings = validateNoteDoc(leakedMarkdownDoc, { noteMethod: 'chronological_causal' });

    expect(findings.ok).toBe(false);
    expect(findings.issues.join(' ')).toContain('Literal markdown styling leaked');
  });

  it('penalizes essay-shaped non-analysis notes that never chunk into note blocks', () => {
    const essayDoc = doc(
      heading('Photosynthesis'),
      paragraph('Photosynthesis is the process by which plants convert light energy into chemical energy stored in glucose, and it depends on chlorophyll, sunlight, carbon dioxide, and water working together across multiple linked reactions that occur in different parts of the chloroplast and ultimately support nearly every food web on Earth.'),
      paragraph('The light-dependent reactions capture sunlight, move electrons, and generate energy carriers, while the Calvin cycle uses those carriers to build sugar molecules, which means students need to understand not only the names of the stages but also the dependency between them and the consequences of mixing them up.'),
      paragraph('A student who only memorizes the words without tracking the inputs, outputs, and location of each stage will often confuse which molecules are produced first, which ones are recycled, and why the second stage cannot proceed without the energy collected in the first stage.'),
      paragraph('This also matters because many biology questions ask learners to explain what would happen if one input or condition were removed, which requires a chain-of-events understanding rather than a purely verbal definition of the overall process.'),
      paragraph('In addition, the process is important to ecosystems because it stores energy in a form other organisms can use and influences atmospheric gas balance over time.'),
    );

    const findings = validateNoteDoc(essayDoc, { noteMethod: 'process_diagram' });

    expect(findings.ok).toBe(false);
    expect(findings.issues.join(' ')).toContain('bullet or step clusters');
    expect(findings.issues.join(' ')).toContain('prose-only explanation');
  });

  it('allows prose-friendly analysis notes when they still keep headings and evidence structure', () => {
    const analysisDoc = doc(
      heading('Industrialization as a Social Turning Point'),
      paragraph('The Industrial Revolution changed daily life because factory labor reorganized time, family structure, and urban growth rather than simply introducing new machines.'),
      paragraph('Why it matters: the shift is historically significant because economic change also reorganized power, class identity, and political demands.'),
      {
        type: 'bulletList',
        content: [
          { type: 'listItem', content: [paragraph('Evidence: wage labor replaced many household production patterns.')] },
          { type: 'listItem', content: [paragraph('Evidence: urban crowding produced new public-health and labor conflicts.')] },
        ],
      },
      heading('Reading the Evidence'),
      paragraph('A strong analysis connects these developments to evidence instead of treating industrialization as a single-cause story.'),
      {
        type: 'blockquote',
        content: [paragraph('Factory records and reform reports show how production gains often came with steep human costs.')],
      },
    );

    expect(validateNoteDoc(analysisDoc, { noteMethod: 'evidence_analysis' }).ok).toBe(true);
  });
});
