import Groq from 'npm:groq-sdk@0.24.0';

import { buildGroqGenerateContentParams, type AiResponseFormat } from './aiClientRequest.ts';

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
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

export type { AiResponseFormat };

export const createAiClient = (apiKey: string) => {
  const groq = new Groq({ apiKey });

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
        messages,
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
      const response = await groq.chat.completions.create(buildGroqGenerateContentParams({
        model,
        messages,
        maxTokens,
        temperature,
        responseFormat,
      }));

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

/** Convert Gemini-style content parts array to Groq chat messages */
export const contentsToMessages = (
  contents: Array<Record<string, unknown>>,
): AiMessage[] => {
  const textParts: string[] = [];
  for (const part of contents) {
    if (typeof part.text === 'string') {
      textParts.push(part.text);
    }
  }

  return [{ role: 'user', content: textParts.join('\n\n') }];
};
