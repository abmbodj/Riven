export type AiResponseFormat = 'json_object';

export type AiRequestMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export const buildGroqGenerateContentParams = ({
  model,
  messages,
  maxTokens,
  temperature = 0,
  responseFormat,
}: {
  model: string;
  messages: AiRequestMessage[];
  maxTokens?: number;
  temperature?: number;
  responseFormat?: AiResponseFormat;
}) => ({
  model,
  messages,
  temperature,
  ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}),
  ...(responseFormat === 'json_object'
    ? { response_format: { type: 'json_object' as const } }
    : {}),
});
