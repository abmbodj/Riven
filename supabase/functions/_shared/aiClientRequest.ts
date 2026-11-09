export type AiResponseFormat = 'json_object';

// Existing deployments may still have Groq-specific model override secrets.
export const resolveOpenAiModel = (model: string, fallback = 'gpt-5.4-mini') =>
  /^(?:openai\/gpt-oss-|meta-llama\/|llama-)/i.test(model || '') ? fallback : (model || fallback);

// A multimodal content part. Image parts let vision-capable models read an
// uploaded photo/scan of a past exam or source document.
export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type AiRequestMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
};

export const buildOpenAiGenerateContentParams = ({
  model,
  messages,
  maxTokens,
  responseFormat,
}: {
  model: string;
  messages: AiRequestMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: AiResponseFormat;
}) => ({
  model: resolveOpenAiModel(model),
  messages,
  max_completion_tokens: maxTokens ?? 8192,
  ...(responseFormat === 'json_object'
    ? { response_format: { type: 'json_object' as const } }
    : {}),
});
