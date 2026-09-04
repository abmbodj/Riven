export const RECORDING_CHUNK_MS = 5_000;
export const RECORDING_WARN_SECONDS = 3 * 60 * 60;
export const RECORDING_CONTINUE_SECONDS = 4 * 60 * 60;

export const RECORDING_SESSION_STATES = Object.freeze({
  IDLE: 'idle',
  PREFLIGHT: 'preflight',
  RECORDING: 'recording',
  PAUSED: 'paused',
  RECONNECTING: 'reconnecting',
  STOPPED: 'stopped',
  TRANSCRIPT_READY: 'transcript_ready',
  ENHANCING: 'enhancing',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

const TRANSITIONS = {
  idle: { PREFLIGHT: 'preflight' },
  preflight: { START: 'recording', FAIL: 'failed' },
  recording: { PAUSE: 'paused', NETWORK_LOST: 'reconnecting', STOP: 'stopped', FAIL: 'failed' },
  paused: { RESUME: 'recording', NETWORK_LOST: 'reconnecting', STOP: 'stopped', FAIL: 'failed' },
  reconnecting: { NETWORK_RESTORED: '$resume', STOP: 'stopped', FAIL: 'failed' },
  stopped: { TRANSCRIPT_READY: 'transcript_ready', FAIL: 'failed' },
  transcript_ready: { ENHANCE: 'enhancing', FAIL: 'failed' },
  enhancing: { COMPLETE: 'complete', CANCEL: 'transcript_ready', FAIL: 'failed' },
  complete: { ENHANCE: 'enhancing' },
  failed: { RETRY: '$resume' },
};

export function applyRecordingEvent(session, event) {
  const currentState = session?.state || RECORDING_SESSION_STATES.IDLE;
  const eventType = String(event?.type || '');
  const nextStateToken = TRANSITIONS[currentState]?.[eventType];

  if (!nextStateToken) {
    throw new Error(`Cannot ${eventType || 'transition'} while recording session is ${currentState}`);
  }

  const resumeState = session.resumeState || RECORDING_SESSION_STATES.RECORDING;
  const nextState = nextStateToken === '$resume' ? resumeState : nextStateToken;
  const next = { ...session, state: nextState };

  if (eventType === 'NETWORK_LOST' || eventType === 'FAIL') {
    next.resumeState = currentState;
  } else if (eventType === 'NETWORK_RESTORED' || eventType === 'RETRY') {
    delete next.resumeState;
  }

  if (eventType === 'PAUSE') next.pausedAtMs = event.atMs ?? Date.now();
  if (eventType === 'RESUME') next.pausedAtMs = null;
  if (eventType === 'STOP') {
    next.stoppedAtMs = event.atMs ?? Date.now();
    next.pausedAtMs = null;
    delete next.resumeState;
  }

  return next;
}

export function buildChunkDescriptor({
  sessionId,
  sequence,
  startedAtMs,
  durationMs = RECORDING_CHUNK_MS,
  source = 'microphone',
  mimeType = 'audio/webm',
  byteSize = 0,
  checksum,
}) {
  if (!sessionId) throw new Error('Chunk descriptor requires a session id');
  if (!Number.isInteger(sequence) || sequence < 0) throw new Error('Chunk sequence must be a non-negative integer');
  if (!Number.isFinite(startedAtMs) || startedAtMs < 0) throw new Error('Chunk start must be non-negative');
  if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Chunk duration must be positive');

  return {
    id: `${sessionId}:${sequence}`,
    sessionId,
    sequence,
    startedAtMs,
    endedAtMs: startedAtMs + durationMs,
    durationMs,
    source,
    mimeType,
    byteSize,
    checksum,
  };
}

export function findMissingChunkSequences(chunks) {
  const sequences = [...new Set((chunks || [])
    .map((chunk) => Number(chunk?.sequence))
    .filter((sequence) => Number.isInteger(sequence) && sequence >= 0))]
    .sort((left, right) => left - right);

  if (sequences.length === 0) return [];

  const present = new Set(sequences);
  const missing = [];
  for (let sequence = sequences[0]; sequence <= sequences[sequences.length - 1]; sequence += 1) {
    if (!present.has(sequence)) missing.push(sequence);
  }
  return missing;
}

function shouldReplaceSegment(current, incoming) {
  const currentRevision = Number(current?.revision || 0);
  const incomingRevision = Number(incoming?.revision || 0);
  if (incomingRevision !== currentRevision) return incomingRevision > currentRevision;
  return Number(incoming?.confidence || 0) >= Number(current?.confidence || 0);
}

export function mergeTranscriptSegments(existing, incoming) {
  const byId = new Map();
  for (const segment of [...(existing || []), ...(incoming || [])]) {
    if (!segment?.id) continue;
    const current = byId.get(segment.id);
    if (!current || shouldReplaceSegment(current, segment)) {
      byId.set(segment.id, { ...segment });
    }
  }

  return [...byId.values()].sort((left, right) => (
    Number(left.startMs || 0) - Number(right.startMs || 0)
    || Number(left.endMs || 0) - Number(right.endMs || 0)
    || String(left.id).localeCompare(String(right.id))
  ));
}

export function resolveAudioExpiry({ enhancementCompletedAt, keepAudio }) {
  if (!enhancementCompletedAt) return null;
  const completedAt = enhancementCompletedAt instanceof Date
    ? enhancementCompletedAt
    : new Date(enhancementCompletedAt);
  if (Number.isNaN(completedAt.getTime())) return null;

  const expiresAt = new Date(completedAt);
  if (keepAudio) expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  else expiresAt.setUTCHours(expiresAt.getUTCHours() + 24);
  return expiresAt.toISOString();
}
