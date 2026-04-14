import { describe, expect, it } from 'vitest';

import {
  buildMergePrompt,
  buildNoteDraftPrompt,
  buildNoteEnrichPrompt,
  buildSectionNotePrompt,
  buildYoutubeSourcePrompt,
} from '../../supabase/functions/_shared/notePrompts.mjs';

describe('note prompts', () => {
  it('keeps the draft prompt natural and avoids exam-question or takeaway instructions', () => {
    const prompt = buildNoteDraftPrompt('Student note line', 'Biology 101', 'Biology');

    expect(prompt).toContain('college student');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps the enrich prompt focused on natural notes with a key concepts recap only', () => {
    const prompt = buildNoteEnrichPrompt('Student note line', 'Biology 101', { type: 'doc', content: [] }, 'Biology');

    expect(prompt).toContain('college student');
    expect(prompt).toContain('Key Concepts');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps section prompts natural and avoids recap or exam-question filler', () => {
    const prompt = buildSectionNotePrompt(0, 3, 'Student note line', 'Biology 101', 'Biology');

    expect(prompt).toContain('college student');
    expect(prompt).not.toContain('Key Concepts');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps merge prompts natural while allowing only the key concepts recap', () => {
    const prompt = buildMergePrompt('Student note line', 'Biology 101', [{ type: 'doc', content: [] }], 'Biology');

    expect(prompt).toContain('college student');
    expect(prompt).toContain('Key Concepts');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps YouTube source note prompts aligned with the same natural note voice', () => {
    const prompt = buildYoutubeSourcePrompt('Biology 101', 'Biology');

    expect(prompt).toContain('college student');
    expect(prompt).toContain('Key Concepts');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });
});
