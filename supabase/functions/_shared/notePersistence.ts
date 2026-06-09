import { createHttpError } from './aiCore.mjs';

const toNonEmptyString = (value: unknown) => (
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim()
    : ''
);

export const isUserOwnedAudioPath = (audioPath: unknown, userId: unknown) => {
  const path = toNonEmptyString(audioPath);
  const ownerId = toNonEmptyString(userId);
  if (!path || !ownerId) return false;
  if (path.startsWith('/') || path.includes('\\')) return false;

  const segments = path.split('/');
  if (segments.length < 2 || segments[0] !== ownerId) return false;
  return segments.every((segment) => segment.length > 0 && segment !== '..');
};

export const assertUserOwnedAudioPath = (audioPath: unknown, userId: unknown) => {
  if (!isUserOwnedAudioPath(audioPath, userId)) {
    throw createHttpError('Invalid audio path.', 403);
  }
  return String(audioPath).trim();
};

export const assertNoteUpdatePersisted = (updatedNote: unknown) => {
  if (!updatedNote) {
    throw createHttpError('Note not found.', 404);
  }
};
