import {
  buildDeepgramCallbackUrl,
  normalizeDeepgramCallback,
  submitDeepgramRecordingForCallback,
} from './deepgramCallbackCore.mjs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test('submits ordered recording audio for asynchronous Deepgram transcription', async () => {
  let request: Request | null = null;
  const audio = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode('ordered-webm'));
      controller.close();
    },
  });

  const result = await submitDeepgramRecordingForCallback({
    apiKey: 'server-key',
    audio,
    mimeType: 'audio/webm;codecs=opus',
    callbackUrl: 'https://example.test/callback?jobId=job-1&token=secret',
    fetchFn: async (input: RequestInfo | URL, init?: RequestInit) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ request_id: 'dg-request-1' }), { status: 202 });
    },
  });

  assert(result.requestId === 'dg-request-1', 'Expected the accepted Deepgram request id');
  const capturedRequest = request as Request | null;
  assert(capturedRequest?.headers.get('authorization') === 'Token server-key', 'Expected server-side authentication');
  assert(new URL(capturedRequest?.url || '').searchParams.get('callback')?.includes('jobId=job-1'), 'Expected an encoded callback URL');
  assert(await capturedRequest?.text() === 'ordered-webm', 'Expected the recording stream to remain ordered');
});

Deno.test('normalizes callback utterances without storing an empty transcript', () => {
  const result = normalizeDeepgramCallback({
    metadata: { request_id: 'dg-request-1' },
    results: {
      utterances: [{ start: 5, end: 7.25, transcript: 'The lecture begins.', confidence: 0.98, speaker: 0 }],
    },
  });

  assert(result.requestId === 'dg-request-1', 'Expected callback request id');
  assert(result.segments.length === 1, 'Expected one normalized segment');
  assert(result.segments[0].startMs === 5000, 'Expected timestamp preservation');
  assert(result.segments[0].text === 'The lecture begins.', 'Expected transcript text');
});

Deno.test('builds callback URLs without leaking the API key', () => {
  const url = buildDeepgramCallbackUrl({
    callbackUrl: 'https://example.test/hook?token=callback-token',
    languages: ['en'],
    keyterms: ['mitosis'],
  });
  assert(url.includes('callback='), 'Expected callback query parameter');
  assert(url.includes('keyterm=mitosis'), 'Expected classroom keyterms');
  assert(!url.includes('server-key'), 'API credentials must not appear in URLs');
});
