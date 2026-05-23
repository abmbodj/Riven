import { describe, expect, it } from 'vitest';

import {
  buildMergePrompt,
  buildNoteDraftPrompt,
  buildNoteEnrichPrompt,
  buildSectionNotePrompt,
  buildYoutubeSourcePrompt,
} from '../../supabase/functions/_shared/notePrompts.mjs';
import {
  assertUserOwnsNoteAudioPath,
  isUserOwnedNoteAudioPath,
} from '../../supabase/functions/_shared/noteAudioAccess.ts';

describe('note prompts', () => {
  it('keeps the draft prompt natural and avoids exam-question or takeaway instructions', () => {
    const prompt = buildNoteDraftPrompt('Student note line', 'Biology 101', 'Biology');

    expect(prompt).toContain('study material a student could actually learn from');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps the enrich prompt focused on natural notes with a key concepts recap only', () => {
    const prompt = buildNoteEnrichPrompt('Student note line', 'Biology 101', { type: 'doc', content: [] }, 'Biology');

    expect(prompt).toContain('study material a student could actually learn from');
    expect(prompt).toContain('Key Concepts');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps section prompts natural and avoids recap or exam-question filler', () => {
    const prompt = buildSectionNotePrompt(0, 3, 'Student note line', 'Biology 101', 'Biology');

    expect(prompt).toContain('study material a student could actually learn from');
    expect(prompt).toContain('Recap / "Key Concepts" / "Summary" / "Conclusion" sections');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps merge prompts natural while allowing only the key concepts recap', () => {
    const prompt = buildMergePrompt('Student note line', 'Biology 101', [{ type: 'doc', content: [] }], 'Biology');

    expect(prompt).toContain('study material a student could actually learn from');
    expect(prompt).toContain('Key Concepts');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });

  it('keeps YouTube source note prompts aligned with the same natural note voice', () => {
    const prompt = buildYoutubeSourcePrompt('Biology 101', 'Biology');

    expect(prompt).toContain('study material a student could actually learn from');
    expect(prompt).toContain('Key Concepts');
    expect(prompt).not.toContain('Potential Exam Questions');
    expect(prompt).not.toContain('takeaway');
  });
});

describe('note audio access checks', () => {
  it('allows audio objects only when the first storage path segment matches the user id', () => {
    expect(isUserOwnedNoteAudioPath('user-1/note-1.webm', 'user-1')).toBe(true);
    expect(isUserOwnedNoteAudioPath('user-2/note-1.webm', 'user-1')).toBe(false);
    expect(isUserOwnedNoteAudioPath('user-1/../user-2/note-1.webm', 'user-1')).toBe(false);
  });

  it('throws a forbidden error for cross-user audio paths', () => {
    expect(() => assertUserOwnsNoteAudioPath('user-2/note-1.webm', 'user-1')).toThrow(
      'Audio file not found or access denied.',
    );
  });
});
