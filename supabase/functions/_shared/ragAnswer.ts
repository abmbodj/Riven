// Grounded question answering shared by tutor-chat and the eval harness, so the eval measures
// the exact production prompt.
import { buildRagContext, isWeakRetrieval, RAG_ANSWER_RULES, RAG_REFUSAL } from './ragCore.mjs';
import { retrieve, ragMinSimilarity, type ChunkStore, type RagMode, type RetrievedChunk } from './rag.ts';
import type { AiClient, AiMessage } from './aiClient.ts';
import type { LlmTelemetry } from './llmTelemetry.ts';

export type AnswerResult = {
  reply: string;
  refused: boolean;
  chunks: RetrievedChunk[];
  retrievalMs: number | null;
  mode: RagMode;
};

export const answerQuestion = async ({
  ai, model, store, userId, sourceIds, question, retrievalQuery, persona, history = [],
  mode, fullContextText = '', k = 6, minSimilarity = ragMinSimilarity(), maxTokens = 500, telemetry,
}: {
  ai: AiClient;
  model: string;
  store: ChunkStore;
  userId: number;
  sourceIds: string[];
  /** What the model is asked (may be a chip instruction). */
  question: string;
  /** What retrieval searches for; defaults to the question. */
  retrievalQuery?: string;
  persona: string;
  history?: AiMessage[];
  mode: RagMode;
  /** full_context mode only: the whole source text (the old prompt-stuffing path). */
  fullContextText?: string;
  k?: number;
  minSimilarity?: number;
  maxTokens?: number;
  telemetry?: Partial<LlmTelemetry>;
}): Promise<AnswerResult> => {
  let context: string;
  let chunks: RetrievedChunk[] = [];
  let retrievalMs: number | null = null;

  if (mode === 'rag') {
    ({ chunks, retrievalMs } = await retrieve({
      store, userId, sourceIds, query: retrievalQuery || question, k, telemetry,
    }));
    if (isWeakRetrieval(chunks, minSimilarity)) {
      // Weak retrieval: refuse without spending a generation call.
      return { reply: RAG_REFUSAL, refused: true, chunks, retrievalMs, mode };
    }
    context = buildRagContext(chunks);
  } else {
    context = fullContextText;
  }

  const messages: AiMessage[] = [
    { role: 'system', content: `${persona}\n\n${RAG_ANSWER_RULES}\n\nSOURCE EXCERPTS:\n${context}` },
    ...history,
    { role: 'user', content: question },
  ];

  let reply = '';
  for await (const chunk of ai.streamContent({
    model,
    messages,
    maxTokens,
    telemetry: { ...telemetry, userId, retrievalMs, chunksUsed: chunks.length || null },
  })) {
    reply += chunk.text;
  }
  reply = reply.trim();
  // Models often swap in a typographic apostrophe (don’t); normalise before matching.
  const refused = reply.replace(/[‘’ʼ]/g, "'").toLowerCase().includes(RAG_REFUSAL.toLowerCase());
  return { reply, refused, chunks, retrievalMs, mode };
};
