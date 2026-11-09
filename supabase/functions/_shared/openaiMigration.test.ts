import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { aiModelMap } from './aiCore.mjs';
import { buildOpenAiGenerateContentParams } from './aiClientRequest.ts';

Deno.test('uses affordable OpenAI models for generation, grading and images', () => {
  assertEquals(aiModelMap.default, 'gpt-5.4-mini');
  assertEquals(aiModelMap.guide, 'gpt-5.4-mini');
  assertEquals(aiModelMap.exam, 'gpt-5.4-mini');
  assertEquals(aiModelMap.grading, 'gpt-5.4-mini');
  assertEquals(aiModelMap.blueprint, 'gpt-5.4-mini');
});

Deno.test('preserves output limits and JSON format in OpenAI requests', () => {
  assertEquals(buildOpenAiGenerateContentParams({ model: 'gpt-5.4-mini', messages: [{ role: 'user', content: 'Return JSON' }], maxTokens: 400, responseFormat: 'json_object' }), {
    model: 'gpt-5.4-mini', messages: [{ role: 'user', content: 'Return JSON' }], max_completion_tokens: 400, response_format: { type: 'json_object' },
  });
});

Deno.test('OpenAI adapter sends bounded JSON requests and returns content', async () => {
  const { createAiClient } = await import('./aiClient.ts');
  let request: Request | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    request = new Request(input, init);
    return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
  };
  const client = createAiClient('test-key', fakeFetch);
  const result = await client.generateContent({ model: 'gpt-5.4-mini', messages: [{ role: 'user', content: 'Return JSON' }], maxTokens: 400, responseFormat: 'json_object' });
  assertEquals(result, '{"ok":true}');
  assertEquals(new URL(request!.url).hostname, 'api.openai.com');
  const body = await request!.json();
  assertEquals(body.max_completion_tokens, 400);
  assertEquals(body.response_format, { type: 'json_object' });
});

Deno.test('bounds output even when callers omit a token limit', () => {
  const params = buildOpenAiGenerateContentParams({ model: 'gpt-5.4-mini', messages: [{ role: 'user', content: 'Hello' }] });
  assertEquals(params.max_completion_tokens, 8192);
});

Deno.test('OpenAI streaming emits text deltas', async () => {
  const { createAiClient } = await import('./aiClient.ts');
  const fakeFetch: typeof fetch = async () => new Response(
    'data: {"choices":[{"delta":{"content":"hello"}}]}\n\ndata: [DONE]\n\n',
    { headers: { 'content-type': 'text/event-stream' } },
  );
  const chunks = [];
  for await (const chunk of createAiClient('test-key', fakeFetch).streamContent({ model: 'gpt-5.4-mini', messages: [{ role: 'user', content: 'Hi' }], maxTokens: 30 })) chunks.push(chunk.text);
  assertEquals(chunks, ['hello']);
});

Deno.test('OpenAI audio transcription retains segment timestamps', async () => {
  const { createAiClient } = await import('./aiClient.ts');
  let url = '';
  const fakeFetch: typeof fetch = async (input) => {
    url = String(input);
    return Response.json({ text: 'hello', segments: [{ id: 0, start: 0, end: 1, text: 'hello' }] });
  };
  const result = await createAiClient('test-key', fakeFetch).transcribeAudioWithSegments(new Blob(['audio'], { type: 'audio/wav' }), 'sample.wav');
  assertEquals(new URL(url).pathname, '/v1/audio/transcriptions');
  assertEquals(result.segments[0], { id: 0, start: 0, end: 1, text: 'hello' });
});

Deno.test('old provider model overrides cannot leak into OpenAI requests', async () => {
  const { resolveOpenAiModel } = await import('./aiClientRequest.ts');
  assertEquals(resolveOpenAiModel('openai/gpt-oss-120b', 'gpt-5.4-mini'), 'gpt-5.4-mini');
  assertEquals(resolveOpenAiModel('meta-llama/llama-4-scout-17b-16e-instruct', 'gpt-5.4-mini'), 'gpt-5.4-mini');
  assertEquals(resolveOpenAiModel('gpt-5.4-mini', 'fallback'), 'gpt-5.4-mini');
});
