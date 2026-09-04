import { requestDeepgramTemporaryToken } from './transcriptionTokenCore.mjs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test('classifies Deepgram permission failures without exposing the provider body', async () => {
  let thrown: unknown;
  try {
    await requestDeepgramTemporaryToken({
      apiKey: 'member-key',
      fetchFn: async () => new Response(JSON.stringify({ message: 'secret provider details' }), { status: 403 }),
    });
  } catch (error) {
    thrown = error;
  }

  const typedError = thrown as { code?: string; provider_status?: number; retryable?: boolean; message?: string };
  assert(typedError?.code === 'DEEPGRAM_PERMISSION_DENIED', 'Expected a stable permission error code');
  assert(typedError?.provider_status === 403, 'Expected the upstream status for telemetry');
  assert(typedError?.retryable === false, 'Permission failures must not be retried automatically');
  assert(!String(typedError?.message).includes('secret provider details'), 'Provider body must not leak');
});

Deno.test('classifies Deepgram rate limits as transient', async () => {
  let thrown: unknown;
  try {
    await requestDeepgramTemporaryToken({
      apiKey: 'member-key',
      fetchFn: async () => new Response('too many requests', { status: 429 }),
    });
  } catch (error) {
    thrown = error;
  }

  const typedError = thrown as { code?: string; provider_status?: number; retryable?: boolean };
  assert(typedError?.code === 'DEEPGRAM_TRANSIENT_FAILURE', 'Expected a transient error code');
  assert(typedError?.provider_status === 429, 'Expected the upstream status for telemetry');
  assert(typedError?.retryable === true, 'Rate limits must be retryable');
});
