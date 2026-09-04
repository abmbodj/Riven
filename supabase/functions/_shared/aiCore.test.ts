import { parseAiJsonResponse } from './aiCore.mjs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test('marks malformed AI JSON as retryable output invalid', () => {
  let thrown: unknown;
  try {
    parseAiJsonResponse('{not-json', 'Invalid note format');
  } catch (error) {
    thrown = error;
  }

  const typedError = thrown as { code?: string; retryable?: boolean };
  assert(typedError?.code === 'AI_OUTPUT_INVALID', 'Expected the typed invalid-output code');
  assert(typedError?.retryable === true, 'Invalid AI output should be retryable');
});
