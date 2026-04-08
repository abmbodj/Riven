import Groq from 'npm:groq-sdk@0.24.0';

export type AiMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type AiStreamChunk = {
  text: string;
};

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
      jsonMode = false,
    }: {
      model: string;
      messages: AiMessage[];
      maxTokens?: number;
      temperature?: number;
      jsonMode?: boolean;
    }): Promise<string> {
      const response = await groq.chat.completions.create({
        model,
        messages,
        max_tokens: maxTokens,
        temperature,
        ...(jsonMode ? { response_format: { type: 'json_object' as const } } : {}),
      });

      return response.choices?.[0]?.message?.content ?? '';
    },

    async transcribeAudio(audioBlob: Blob, filename: string): Promise<string> {
      const file = new File([audioBlob], filename, { type: audioBlob.type });
      const transcription = await groq.audio.transcriptions.create({
        model: 'whisper-large-v3',
        file,
      });
      return transcription.text;
    },

    async transcribeAudioWithSegments(audioBlob: Blob, filename: string): Promise<{
      text: string;
      segments: Array<{ id: number; start: number; end: number; text: string }>;
    }> {
      const file = new File([audioBlob], filename, { type: audioBlob.type });
      const transcription = await groq.audio.transcriptions.create({
        model: 'whisper-large-v3',
        file,
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });
      return {
        text: transcription.text,
        segments: (transcription.segments ?? []).map((s: any) => ({
          id: s.id,
          start: s.start,
          end: s.end,
          text: s.text,
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
