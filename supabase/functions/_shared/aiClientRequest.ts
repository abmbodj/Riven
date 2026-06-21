export type AiResponseFormat = 'json_object';

// A multimodal content part. Image parts let vision-capable models (Llama 4) read an
// uploaded photo/scan of a past exam or source document.
export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export type AiRequestMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
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
