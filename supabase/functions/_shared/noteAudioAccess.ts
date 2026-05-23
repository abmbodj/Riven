import { createHttpError } from './aiCore.mjs';

const AUDIO_ACCESS_DENIED_MESSAGE = 'Audio file not found or access denied.';

const getSafePathSegments = (audioPath: unknown) => {
  if (typeof audioPath !== 'string') return null;

  const trimmedPath = audioPath.trim();
  if (!trimmedPath || trimmedPath.includes('\\')) return null;

  const segments = trimmedPath.split('/');
  if (segments.length < 2) return null;
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return null;
  }

  return segments;
};

export const isUserOwnedNoteAudioPath = (audioPath: unknown, userId: unknown) => {
  if (typeof userId !== 'string' || !userId) return false;

  const segments = getSafePathSegments(audioPath);
  return segments?.[0] === userId;
};

export const assertUserOwnsNoteAudioPath = (audioPath: unknown, userId: unknown) => {
  if (!isUserOwnedNoteAudioPath(audioPath, userId)) {
    throw createHttpError(AUDIO_ACCESS_DENIED_MESSAGE, 403);
  }
};
