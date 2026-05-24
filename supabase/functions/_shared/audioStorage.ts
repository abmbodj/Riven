const createAudioPathError = (message: string, status: number) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
};

export const assertOwnedNoteAudioPath = (audioPath: unknown, appUserId: string | number) => {
  const normalizedPath = typeof audioPath === 'string' ? audioPath.trim() : '';
  const ownerId = String(appUserId);

  if (!normalizedPath || !ownerId) {
    throw createAudioPathError('Invalid audio path.', 400);
  }

  const segments = normalizedPath.split('/');
  const hasUnsafeSegment = segments.some((segment) => !segment || segment === '.' || segment === '..');
  if (
    normalizedPath.startsWith('/')
    || normalizedPath.includes('\\')
    || hasUnsafeSegment
    || segments.length < 2
  ) {
    throw createAudioPathError('Invalid audio path.', 400);
  }

  if (segments[0] !== ownerId) {
    throw createAudioPathError('Audio file does not belong to the authenticated user.', 403);
  }

  return normalizedPath;
};
