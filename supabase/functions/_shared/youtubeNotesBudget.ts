export const DEFAULT_YOUTUBE_NOTES_MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct';

export const YOUTUBE_PROVIDER_TOKEN_LIMIT_MESSAGE =
  'Riven hit the AI provider\'s token limit for this video. Try again in a moment or use a shorter video.';

const APPROX_CHARS_PER_TOKEN = 4;
const DEFAULT_PROMPT_OVERHEAD_TOKENS = 1_200;

type ModelBudget = {
  safeRequestTokens: number;
  preferredCompletionTokens: number;
  minCompletionTokens: number;
  compactionConcurrency: number;
};

const MODEL_BUDGETS: Array<{ match: RegExp; budget: ModelBudget }> = [
  {
    match: /^openai\/gpt-oss-(?:120b|20b)$/i,
    budget: {
      safeRequestTokens: 7_400,
      preferredCompletionTokens: 3_072,
      minCompletionTokens: 1_536,
      compactionConcurrency: 1,
    },
  },
  {
    match: /^meta-llama\/llama-4-scout/i,
    budget: {
      safeRequestTokens: 28_000,
      preferredCompletionTokens: 6_144,
      minCompletionTokens: 2_048,
      compactionConcurrency: 3,
    },
  },
  {
    match: /^llama-3\.3-70b/i,
    budget: {
      safeRequestTokens: 11_000,
      preferredCompletionTokens: 3_072,
      minCompletionTokens: 1_536,
      compactionConcurrency: 1,
    },
  },
];

export const estimateTokensFromText = (text: string) => (
  Math.ceil(String(text || '').length / APPROX_CHARS_PER_TOKEN)
);

export const getYoutubeNotesModelBudget = (model: string): ModelBudget => {
  const found = MODEL_BUDGETS.find(({ match }) => match.test(model || ''));
  return found?.budget ?? {
    safeRequestTokens: 7_400,
    preferredCompletionTokens: 3_072,
    minCompletionTokens: 1_536,
    compactionConcurrency: 1,
  };
};

export const buildYoutubeNotesTokenPlan = ({
  model,
  sourceChars,
  promptOverheadTokens = DEFAULT_PROMPT_OVERHEAD_TOKENS,
}: {
  model: string;
  sourceChars: number;
  promptOverheadTokens?: number;
}) => {
  const budget = getYoutubeNotesModelBudget(model);
  const sourceTokens = Math.ceil(Math.max(0, sourceChars) / APPROX_CHARS_PER_TOKEN);
  const estimatedPromptTokens = sourceTokens + promptOverheadTokens;
  const preferredTotal = estimatedPromptTokens + budget.preferredCompletionTokens;
  const availableCompletionTokens = budget.safeRequestTokens - estimatedPromptTokens;
  const maxCompletionTokens = Math.max(
    budget.minCompletionTokens,
    Math.min(budget.preferredCompletionTokens, availableCompletionTokens),
  );
  const directSourceTokenLimit = Math.max(
    1_500,
    budget.safeRequestTokens - promptOverheadTokens - budget.preferredCompletionTokens,
  );

  return {
    model,
    safeRequestTokens: budget.safeRequestTokens,
    estimatedPromptTokens,
    maxCompletionTokens,
    estimatedRequestTokens: estimatedPromptTokens + maxCompletionTokens,
    shouldCompact: preferredTotal > budget.safeRequestTokens,
    directCharLimit: directSourceTokenLimit * APPROX_CHARS_PER_TOKEN,
    compactionConcurrency: budget.compactionConcurrency,
  };
};

export const buildYoutubeNotesRetryTokenPlan = ({
  model,
  sourceChars,
}: {
  model: string;
  sourceChars: number;
}) => {
  const firstPlan = buildYoutubeNotesTokenPlan({ model, sourceChars });
  const retrySourceChars = Math.max(6_000, Math.floor(firstPlan.directCharLimit * 0.6));
  const retryPlan = buildYoutubeNotesTokenPlan({
    model,
    sourceChars: Math.min(sourceChars, retrySourceChars),
  });

  return {
    ...retryPlan,
    directCharLimit: retrySourceChars,
    maxCompletionTokens: Math.min(retryPlan.maxCompletionTokens, 3_072),
    compactionConcurrency: 1,
  };
};

export const isProviderTokenLimitError = (error: unknown) => {
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const status = typeof record.status === 'number'
    ? record.status
    : typeof record.statusCode === 'number'
      ? record.statusCode
      : null;
  const code = typeof record.code === 'string' ? record.code : '';
  const message = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : JSON.stringify(error ?? '');

  return status === 413
    || code.toLowerCase() === 'rate_limit_exceeded'
    || /rate_limit_exceeded|tokens per minute|request too large for model|please reduce your message size|tpm/i.test(message);
};

export const createSanitizedProviderTokenLimitError = (error: unknown) => {
  const sanitized = new Error(YOUTUBE_PROVIDER_TOKEN_LIMIT_MESSAGE) as Error & {
    status?: number;
    code?: string;
    details?: string;
  };
  const record = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  sanitized.status = typeof record.status === 'number'
    ? record.status
    : typeof record.statusCode === 'number'
      ? record.statusCode
      : 429;
  sanitized.code = 'rate_limit_exceeded';
  sanitized.details = error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : JSON.stringify(error ?? {});
  return sanitized;
};
