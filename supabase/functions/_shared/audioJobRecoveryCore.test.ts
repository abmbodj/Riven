import {
  buildRecoveryCheckpoint,
  calculateVerifiedChunkCoverage,
  isCallbackTokenValid,
  getNextSectionBatch,
  mergeCompletedSections,
  shouldReclaimAudioJob,
} from './audioJobRecoveryCore.mjs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test('reclaims legacy audio jobs that died without a checkpoint', () => {
  const reclaim = shouldReclaimAudioJob({
    status: 'running',
    phase: 'processing_media',
    updated_at: '2026-09-04T17:16:58.000Z',
    result_payload: {},
  }, new Date('2026-09-04T17:23:00.000Z'));
  assert(reclaim.reason === 'legacy_worker_stale', 'Expected stale legacy recovery');
});

Deno.test('checkpoints long-note sections in deterministic batches of four', () => {
  const sections = Array.from({ length: 9 }, (_, index) => ({ index, text: `section-${index}` }));
  const completed = [{ index: 0, doc: { type: 'doc', content: [] } }];
  const batch = getNextSectionBatch(sections, completed, 4);
  assert(batch.map((section: { index: number }) => section.index).join(',') === '1,2,3,4', 'Expected the next four missing sections');
  const merged = mergeCompletedSections(completed, [
    { index: 2, doc: { value: 'two' } },
    { index: 1, doc: { value: 'one' } },
  ]);
  assert(merged.map((entry: { index: number }) => entry.index).join(',') === '0,1,2', 'Expected stable section ordering');
});

Deno.test('waits for a valid callback deadline and reclaims it after expiry', () => {
  const job = {
    status: 'running',
    phase: 'processing_media',
    updated_at: '2026-09-04T17:16:58.000Z',
    result_payload: {
      recovery: buildRecoveryCheckpoint({
        stage: 'awaiting_callback',
        callbackDeadlineAt: '2026-09-04T17:40:00.000Z',
      }),
    },
  };
  assert(shouldReclaimAudioJob(job, new Date('2026-09-04T17:30:00.000Z')).reclaim === false, 'Must wait for callback');
  assert(shouldReclaimAudioJob(job, new Date('2026-09-04T17:41:00.000Z')).reason === 'callback_deadline_expired', 'Must reclaim expired callback');
});

Deno.test('validates callback tokens from their hash and rejects expired tokens', async () => {
  const token = 'callback-token';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hash = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  assert(await isCallbackTokenValid(token, hash, '2026-09-04T17:40:00.000Z', new Date('2026-09-04T17:30:00.000Z')), 'Expected valid token');
  assert(!await isCallbackTokenValid(token, hash, '2026-09-04T17:20:00.000Z', new Date('2026-09-04T17:30:00.000Z')), 'Expected expired token rejection');
  assert(!await isCallbackTokenValid('wrong', hash, '2026-09-04T17:40:00.000Z', new Date('2026-09-04T17:30:00.000Z')), 'Expected invalid token rejection');
});

Deno.test('requires 98 percent of the saved chunk manifest before transcription', () => {
  const enough = calculateVerifiedChunkCoverage(100, Array.from({ length: 98 }, (_, sequence) => ({ sequence })));
  const incomplete = calculateVerifiedChunkCoverage(100, Array.from({ length: 97 }, (_, sequence) => ({ sequence })));
  assert(enough.ready && enough.ratio === 0.98, 'Expected 98 percent coverage to be usable');
  assert(!incomplete.ready && incomplete.missingSequences.length === 3, 'Expected missing chunks to remain retryable');
});
