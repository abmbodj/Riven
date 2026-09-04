import { expect, it } from 'vitest';

import {
  buildAiJobRetrySchedule,
  isRetryableProviderError,
} from '../../supabase/functions/_shared/aiJobRetryCore.mjs';

it('retries transient provider and network failures but not bad requests', () => {
  expect(isRetryableProviderError({ status: 429 })).toBe(true);
  expect(isRetryableProviderError({ provider_status: 503 })).toBe(true);
  expect(isRetryableProviderError(new Error('fetch failed: connection reset'))).toBe(true);
  expect(isRetryableProviderError({ status: 400, message: 'invalid audio' })).toBe(false);
  expect(isRetryableProviderError({ status: 401, message: 'bad API key' })).toBe(false);
});

test('uses capped exponential backoff within a 24-hour retry window', () => {
  const now = new Date('2026-09-04T12:00:00.000Z');
  const first = buildAiJobRetrySchedule({
    createdAt: '2026-09-04T11:59:00.000Z',
    attemptCount: 0,
    now,
  });
  expect(first).toEqual({
    attemptCount: 1,
    nextAttemptAt: '2026-09-04T12:00:30.000Z',
    retryUntil: '2026-09-05T11:59:00.000Z',
  });

  const capped = buildAiJobRetrySchedule({
    createdAt: '2026-09-04T11:00:00.000Z',
    attemptCount: 20,
    now,
  });
  expect(capped.nextAttemptAt).toBe('2026-09-04T12:30:00.000Z');

  expect(buildAiJobRetrySchedule({
    createdAt: '2026-09-03T11:59:59.000Z',
    attemptCount: 3,
    now,
  })).toBeNull();
});
