import { describe, expect, it } from 'vitest';

import { assertOwnedNoteAudioPath } from '../../supabase/functions/_shared/audioStorage.ts';

describe('note audio storage ownership', () => {
  it('accepts private note audio paths scoped to the authenticated app user', () => {
    expect(assertOwnedNoteAudioPath('7/note-1.webm', 7)).toBe('7/note-1.webm');
    expect(assertOwnedNoteAudioPath('  7/note-1.webm  ', '7')).toBe('7/note-1.webm');
  });

  it('rejects private note audio paths outside the authenticated app user folder', () => {
    expect(() => assertOwnedNoteAudioPath('42/victim-note.webm', 7)).toThrow(/authenticated user/);
  });

  it('rejects malformed private note audio paths before service-role storage access', () => {
    expect(() => assertOwnedNoteAudioPath('/7/note-1.webm', 7)).toThrow(/Invalid audio path/);
    expect(() => assertOwnedNoteAudioPath('7/../note-1.webm', 7)).toThrow(/Invalid audio path/);
    expect(() => assertOwnedNoteAudioPath('7\\note-1.webm', 7)).toThrow(/Invalid audio path/);
  });
});
