export const AUDIO_RECOVERY_VERSION = 1;
export const AUDIO_WORKER_STALE_MS = 5 * 60 * 1000;
export const AUDIO_CALLBACK_WAIT_MS = 20 * 60 * 1000;

const toRecord = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const toTime = (value) => {
  const parsed = Date.parse(String(value || ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * @param {{
 * stage?: string, sessionId?: string | null, verifiedChunkCount?: number,
 * expectedChunkCount?: number, streamedBytes?: number, providerRequestId?: string | null,
 * callbackTokenHash?: string | null, callbackDeadlineAt?: string | null,
 * completedSections?: unknown[], totalSections?: number, submissionAttempt?: number,
 * heartbeatAt?: string
 * }} [options]
 */
export function buildRecoveryCheckpoint({
  stage = 'verifying',
  sessionId = null,
  verifiedChunkCount = 0,
  expectedChunkCount = 0,
  streamedBytes = 0,
  providerRequestId = null,
  callbackTokenHash = null,
  callbackDeadlineAt = null,
  completedSections = [],
  totalSections = 0,
  submissionAttempt = 0,
  heartbeatAt = new Date().toISOString(),
} = {}) {
  return {
    version: AUDIO_RECOVERY_VERSION,
    stage,
    session_id: sessionId,
    verified_chunk_count: Math.max(0, Number(verifiedChunkCount) || 0),
    expected_chunk_count: Math.max(0, Number(expectedChunkCount) || 0),
    streamed_bytes: Math.max(0, Number(streamedBytes) || 0),
    provider_request_id: providerRequestId,
    callback_token_hash: callbackTokenHash,
    callback_deadline_at: callbackDeadlineAt,
    completed_sections: Array.isArray(completedSections) ? completedSections : [],
    total_sections: Math.max(0, Number(totalSections) || 0),
    submission_attempt: Math.max(0, Number(submissionAttempt) || 0),
    heartbeat_at: heartbeatAt,
  };
}

export async function hashCallbackToken(token) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(token || '')));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function isCallbackTokenValid(token, expectedHash, expiresAt, now = new Date()) {
  if (!token || !expectedHash || toTime(expiresAt) <= now.getTime()) return false;
  const actualHash = await hashCallbackToken(token);
  if (actualHash.length !== String(expectedHash).length) return false;
  let difference = 0;
  for (let index = 0; index < actualHash.length; index += 1) {
    difference |= actualHash.charCodeAt(index) ^ String(expectedHash).charCodeAt(index);
  }
  return difference === 0;
}

export function shouldReclaimAudioJob(job, now = new Date()) {
  if (!job || !['running', 'streaming', 'saving'].includes(job.status)) {
    return { reclaim: false, reason: null };
  }
  const result = toRecord(job.result_payload);
  const recovery = toRecord(result.recovery);
  const updatedAt = toTime(recovery.heartbeat_at) || toTime(job.updated_at);
  if (recovery.stage === 'awaiting_callback') {
    if (toTime(recovery.callback_deadline_at) > now.getTime()) return { reclaim: false, reason: null };
    return { reclaim: true, reason: 'callback_deadline_expired' };
  }
  if (now.getTime() - updatedAt < AUDIO_WORKER_STALE_MS) return { reclaim: false, reason: null };
  if (Number(recovery.version) !== AUDIO_RECOVERY_VERSION) {
    return { reclaim: true, reason: 'legacy_worker_stale' };
  }
  return { reclaim: true, reason: 'worker_heartbeat_stale' };
}

export function createCallbackToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function calculateVerifiedChunkCoverage(expectedChunkCount, chunks = [], minimumRatio = 0.98) {
  const verifiedSequences = new Set(
    chunks
      .map((chunk) => Number(chunk?.sequence))
      .filter((sequence) => Number.isInteger(sequence) && sequence >= 0),
  );
  const expected = Math.max(0, Math.floor(Number(expectedChunkCount) || 0));
  const denominator = expected || verifiedSequences.size;
  const ratio = denominator > 0 ? Math.min(1, verifiedSequences.size / denominator) : 0;
  const missingSequences = expected > 0
    ? Array.from({ length: expected }, (_, sequence) => sequence).filter((sequence) => !verifiedSequences.has(sequence))
    : [];
  return {
    ready: denominator > 0 && ratio >= minimumRatio,
    ratio,
    expectedChunkCount: denominator,
    verifiedChunkCount: verifiedSequences.size,
    missingSequences,
  };
}

export function getNextSectionBatch(sections = [], completedSections = [], batchSize = 4) {
  const completedIndexes = new Set(completedSections.map((entry) => Number(entry?.index)));
  return sections
    .filter((section) => !completedIndexes.has(Number(section?.index)))
    .slice(0, Math.max(1, Number(batchSize) || 4));
}

export function mergeCompletedSections(existing = [], additions = []) {
  const byIndex = new Map();
  [...existing, ...additions].forEach((entry) => {
    const index = Number(entry?.index);
    if (Number.isInteger(index) && index >= 0) byIndex.set(index, entry);
  });
  return [...byIndex.values()].sort((left, right) => Number(left.index) - Number(right.index));
}
