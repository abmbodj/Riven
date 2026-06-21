import Groq from 'npm:groq-sdk@0.24.0';

import { buildGroqGenerateContentParams, type AiResponseFormat, type AiContentPart } from './aiClientRequest.ts';

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string | AiContentPart[];
};

export type AiStreamChunk = {
  text: string;
};

export type TranscribeOptions = {
  /** Vocabulary-biasing prompt (class/subject/known terms) to improve proper-noun + jargon accuracy. */
  prompt?: string;
  /** ISO-639-1 language hint, e.g. 'en'. */
  language?: string;
  temperature?: number;
};

export type { AiResponseFormat, AiContentPart };

export const createAiClient = (apiKey: string) => {
  const groq = new Groq({ apiKey, timeout: 45_000, maxRetries: 1 });

  return {
    async *streamContent({
      model,
      messages,
      maxTokens,
      temperature = 0,
    }: {
      model: string;
      messages: AiMessage[];
      maxTokens: number;
      temperature?: number;
    }): AsyncGenerator<AiStreamChunk> {
      const stream = await groq.chat.completions.create({
        model,
        // Cast covers multimodal (image) content parts, which the SDK accepts for vision models.
        messages: messages as unknown as Groq.Chat.Completions.ChatCompletionMessageParam[],
        max_tokens: maxTokens,
        temperature,
        stream: true,
      });

      for await (const chunk of stream) {
        const text = chunk.choices?.[0]?.delta?.content ?? '';
        if (text) yield { text };
      }
    },

    async generateContent({
      model,
      messages,
      maxTokens,
      temperature = 0,
      responseFormat,
    }: {
      model: string;
      messages: AiMessage[];
      maxTokens?: number;
      temperature?: number;
      responseFormat?: AiResponseFormat;
    }): Promise<string> {
      const params = buildGroqGenerateContentParams({
        model,
        messages,
        maxTokens,
        temperature,
        responseFormat,
      });
      const response = await groq.chat.completions.create({
        ...params,
        // Cast covers multimodal (image) content parts, which the SDK accepts for vision models.
        messages: params.messages as unknown as Groq.Chat.Completions.ChatCompletionMessageParam[],
      });

      return response.choices?.[0]?.message?.content ?? '';
    },

    async transcribeAudio(
      audioBlob: Blob,
      filename: string,
      options: TranscribeOptions = {},
    ): Promise<string> {
      const file = new File([audioBlob], filename, { type: audioBlob.type });
      const transcription = await groq.audio.transcriptions.create({
        model: 'whisper-large-v3',
        file,
        // Bias decoding toward the lecture's domain vocabulary / proper nouns.
        ...(options.prompt ? { prompt: options.prompt } : {}),
        ...(options.language ? { language: options.language } : {}),
        temperature: options.temperature ?? 0,
      });
      return transcription.text;
    },

    async transcribeAudioWithSegments(
      audioBlob: Blob,
      filename: string,
      options: TranscribeOptions = {},
    ): Promise<{
      text: string;
      segments: Array<{ id: number; start: number; end: number; text: string; avg_logprob?: number; no_speech_prob?: number }>;
    }> {
      const file = new File([audioBlob], filename, { type: audioBlob.type });
      const transcription = await groq.audio.transcriptions.create({
        model: 'whisper-large-v3',
        file,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
        // Bias decoding toward the lecture's domain vocabulary / proper nouns.
        ...(options.prompt ? { prompt: options.prompt } : {}),
        ...(options.language ? { language: options.language } : {}),
        temperature: options.temperature ?? 0,
      }) as { text: string; segments?: Array<{ id: number; start: number; end: number; text: string; avg_logprob?: number; no_speech_prob?: number }> };
      return {
        text: transcription.text,
        segments: (transcription.segments ?? []).map((s: any) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
          // Confidence signals used to flag low-confidence spans for review.
          ...(typeof s.avg_logprob === 'number' ? { avg_logprob: s.avg_logprob } : {}),
          ...(typeof s.no_speech_prob === 'number' ? { no_speech_prob: s.no_speech_prob } : {}),
        })),
      };
    },
  };
};

export type AiClient = ReturnType<typeof createAiClient>;

const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

/**
 * Convert Gemini-style content parts array to a Groq chat message. Text parts are joined;
 * inline IMAGE data becomes an image_url part so vision models (Llama 4) can read an
 * uploaded photo/scan. Non-image binary (e.g. PDF) is dropped here — extract its text first.
 */
export const contentsToMessages = (
  contents: Array<Record<string, unknown>>,
): AiMessage[] => {
  const textParts: string[] = [];
  const imageParts: AiContentPart[] = [];
  for (const part of contents) {
    if (typeof part.text === 'string') {
      textParts.push(part.text);
    } else if (part.inlineData && typeof part.inlineData === 'object') {
      const inline = part.inlineData as { data?: string; mimeType?: string };
      if (inline.data && inline.mimeType && IMAGE_MIME_TYPES.has(inline.mimeType)) {
        imageParts.push({
          type: 'image_url',
          image_url: { url: `data:${inline.mimeType};base64,${inline.data}` },
        });
      }
    }
  }

  const text = textParts.join('\n\n');
  if (imageParts.length === 0) {
    return [{ role: 'user', content: text }];
  }
  return [{ role: 'user', content: [{ type: 'text', text }, ...imageParts] }];
};
