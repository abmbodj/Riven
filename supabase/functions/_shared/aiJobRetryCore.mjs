const RETRYABLE_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504]);
const NETWORK_ERROR_PATTERN = /fetch failed|network|connection|socket|timed?\s*out|timeout|temporar|overload|rate.?limit|econnreset|unavailable/i;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_BACKOFF_MS = 30 * 60 * 1000;

const finiteStatus = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export function isRetryableProviderError(error) {
  const status = finiteStatus(
    error?.provider_status
      ?? error?.providerStatus
      ?? error?.status
      ?? error?.statusCode,
  );
  if (status != null) return RETRYABLE_STATUSES.has(status);
  const code = String(error?.code || '');
  if (/^(ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN)$/i.test(code)) return true;
  return NETWORK_ERROR_PATTERN.test(String(error?.message || error || ''));
}

export function isRetryableAiJobError(error) {
  if (String(error?.code || '') === 'AI_OUTPUT_INVALID') return true;
  return isRetryableProviderError(error);
}

export function buildAiJobRetrySchedule({ createdAt, retryUntil, attemptCount = 0, now = new Date() }) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const createdMs = new Date(createdAt).getTime();
  if (!Number.isFinite(nowMs) || !Number.isFinite(createdMs)) return null;

  const retryUntilMs = retryUntil ? new Date(retryUntil).getTime() : createdMs + DAY_MS;
  if (!Number.isFinite(retryUntilMs) || nowMs >= retryUntilMs) return null;

  const safeAttemptCount = Math.max(0, Math.floor(Number(attemptCount) || 0));
  const delayMs = Math.min(30_000 * (2 ** Math.min(safeAttemptCount, 16)), MAX_BACKOFF_MS);
  return {
    attemptCount: safeAttemptCount + 1,
    nextAttemptAt: new Date(Math.min(nowMs + delayMs, retryUntilMs)).toISOString(),
    retryUntil: new Date(retryUntilMs).toISOString(),
  };
}
