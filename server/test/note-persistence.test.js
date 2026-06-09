import { describe, expect, it } from 'vitest';

import {
  assertNoteUpdatePersisted,
  assertUserOwnedAudioPath,
  isUserOwnedAudioPath,
} from '../../supabase/functions/_shared/notePersistence.ts';

describe('note persistence guards', () => {
  it('accepts audio paths scoped under the authenticated user id', () => {
    expect(isUserOwnedAudioPath('user-123/recordings/lecture.webm', 'user-123')).toBe(true);
    expect(assertUserOwnedAudioPath('42/audio.m4a', 42)).toBe('42/audio.m4a');
  });

  it('rejects cross-user or ambiguous audio paths before service-role download', () => {
    const invalidPaths = [
      'user-1234/recordings/lecture.webm',
      'other-user/recordings/lecture.webm',
      '/user-123/recordings/lecture.webm',
      'user-123/../other-user/lecture.webm',
      'user-123//lecture.webm',
      'user-123\\lecture.webm',
    ];

    for (const path of invalidPaths) {
      expect(isUserOwnedAudioPath(path, 'user-123')).toBe(false);
      expect(() => assertUserOwnedAudioPath(path, 'user-123')).toThrowError(
        expect.objectContaining({ status: 403 }),
      );
    }
  });

  it('throws when a note update returned no row', () => {
    expect(() => assertNoteUpdatePersisted(null)).toThrowError(
      expect.objectContaining({ status: 404 }),
    );
    expect(() => assertNoteUpdatePersisted({ id: 'note-1' })).not.toThrow();
  });
});
