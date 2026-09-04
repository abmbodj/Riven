export function collectExpiredRecordingPaths({ sessionId, userId, chunks = [] }) {
  const expectedPrefix = `${userId}/${sessionId}/`;
  return [...new Set(chunks
    .filter((chunk) => String(chunk?.session_id) === String(sessionId))
    .map((chunk) => String(chunk?.storage_path || '').trim())
    .filter((path) => path.startsWith(expectedPrefix)))];
}
