import { isRetryableAiJobError } from './aiJobRetryCore.mjs';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

Deno.test('retries malformed AI output as note-format recovery', () => {
  assert(isRetryableAiJobError({ code: 'AI_OUTPUT_INVALID' }), 'Malformed AI output should be retried');
});

Deno.test('does not classify unrelated client errors as retryable AI failures', () => {
  assert(!isRetryableAiJobError({ status: 422, code: 'INVALID_INPUT' }), 'Invalid input should not be retried');
});
