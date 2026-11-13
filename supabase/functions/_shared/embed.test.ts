import { assertEquals } from 'jsr:@std/assert@1.0.8';

import { embed, retryDelayMs } from './embed.ts';

Deno.test('retryDelayMs reads Google RetryInfo and caps it', () => {
  assertEquals(retryDelayMs('{"details":[{"retryDelay": "37s"}]}'), 37_000);
  assertEquals(retryDelayMs('{"retryDelay":"0.5s"}'), 500);
  assertEquals(retryDelayMs('{"retryDelay":"600s"}'), 65_000);
  assertEquals(retryDelayMs('{"error":{"code":429}}'), null);
});

Deno.test('embed waits out a 429 using the server retryDelay, then succeeds', async () => {
  const realFetch = globalThis.fetch;
  const hadKey = Deno.env.get('GEMINI_API_KEY');
  Deno.env.set('GEMINI_API_KEY', 'test-key');
  Deno.env.delete('GCP_SA_JSON');
  const calls: number[] = [];
  globalThis.fetch = (async () => {
    calls.push(Date.now());
    if (calls.length === 1) {
      return new Response('{"error":{"code":429,"details":[{"retryDelay":"0.2s"}]}}', { status: 429 });
    }
    return Response.json({ embeddings: [{ values: new Array(1536).fill(0.1) }], usageMetadata: { promptTokenCount: 5 } });
  }) as typeof fetch;
  try {
    const [vec] = await embed(['hello'], { kind: 'query' });
    assertEquals(vec.length, 1536);
    assertEquals(calls.length, 2);
    // Waited at least the server-provided 200 ms (not the 1 s first exponential step).
    const gap = calls[1] - calls[0];
    assertEquals(gap >= 200 && gap < 900, true, `gap ${gap}ms`);
  } finally {
    globalThis.fetch = realFetch;
    if (hadKey) Deno.env.set('GEMINI_API_KEY', hadKey); else Deno.env.delete('GEMINI_API_KEY');
  }
});
