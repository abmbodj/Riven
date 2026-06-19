import {
  DEFAULT_YOUTUBE_NOTES_MODEL,
  buildYoutubeNotesTokenPlan,
  createSanitizedProviderTokenLimitError,
  isProviderTokenLimitError,
} from './youtubeNotesBudget.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

Deno.test('buildYoutubeNotesTokenPlan budgets GPT OSS under the current 8k TPM tier', () => {
  const sourceChars = 32_000;
  const plan = buildYoutubeNotesTokenPlan({
    model: 'openai/gpt-oss-120b',
    sourceChars,
  });
  const compactedPlan = buildYoutubeNotesTokenPlan({
    model: 'openai/gpt-oss-120b',
    sourceChars: plan.directCharLimit,
  });

  assert(plan.shouldCompact, 'Expected GPT OSS requests with normal transcripts to compact first');
  assert(plan.directCharLimit < sourceChars, 'Expected GPT OSS direct source limit to be below the oversized source');
  assert(
    compactedPlan.estimatedRequestTokens <= compactedPlan.safeRequestTokens,
    'Expected compacted GPT OSS request estimate to fit under the safe request budget',
  );
});

Deno.test('buildYoutubeNotesTokenPlan keeps the previously failing request shape inside Scout budget', () => {
  const previousFailurePromptTokens = 11_881 - 8_192;
  const sourceChars = Math.max(0, previousFailurePromptTokens - 1_200) * 4;

  const plan = buildYoutubeNotesTokenPlan({
    model: DEFAULT_YOUTUBE_NOTES_MODEL,
    sourceChars,
  });

  assertEquals(plan.shouldCompact, false, 'Expected Scout to avoid compaction for the previously failing request size');
  assert(
    plan.estimatedRequestTokens <= plan.safeRequestTokens,
    'Expected Scout request estimate to fit under its safe budget',
  );
});

Deno.test('buildYoutubeNotesTokenPlan flags oversized transcripts for pre-generation compaction', () => {
  const plan = buildYoutubeNotesTokenPlan({
    model: DEFAULT_YOUTUBE_NOTES_MODEL,
    sourceChars: 120_000,
  });

  assert(plan.shouldCompact, 'Expected oversized transcript source to compact before notes generation');
  assert(plan.directCharLimit < 120_000, 'Expected a bounded direct source character limit');
  assertEquals(plan.compactionConcurrency, 3, 'Expected Scout to keep higher compaction concurrency');
});

Deno.test('provider token limit errors are detected and sanitized', () => {
  const providerError = Object.assign(
    new Error('413 {"error":{"message":"Request too large for model `openai/gpt-oss-120b` in organization `org_123` service tier `on_demand` on tokens per minute (TPM): Limit 8000, Requested 11881","code":"rate_limit_exceeded"}}'),
    { status: 413 },
  );

  assert(isProviderTokenLimitError(providerError), 'Expected Groq token-limit error to be detected');

  const sanitized = createSanitizedProviderTokenLimitError(providerError);
  assertEquals(sanitized.message.includes('org_123'), false, 'Expected sanitized user message to omit provider org id');
  assertEquals(sanitized.code, 'rate_limit_exceeded', 'Expected normalized rate-limit code');
  assert(
    sanitized.details?.includes('Requested 11881'),
    'Expected raw provider diagnostic details to remain available for debugging',
  );
});
