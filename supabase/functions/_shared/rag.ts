// Edge-side RAG pipeline: ingest (extract → chunk → embed → upsert) and hybrid retrieval.
// Pure logic lives in ragCore.mjs; this file owns I/O. Storage goes through ChunkStore so the eval
// harness and integration test run this exact code against a plain Postgres.
import { Buffer } from 'node:buffer';

import {
  buildRagContext,
  chunkBlocks,
  contentHash,
  estimateTokens,
  pagesToBlocks,
  plainTextToBlocks,
  segmentsToBlocks,
  tiptapToBlocks,
  uploadSourceId,
} from './ragCore.mjs';
import { embed } from './embed.ts';
import type { LlmTelemetry } from './llmTelemetry.ts';

export type Block = { text: string; meta: Record<string, unknown> };

export type ChunkRow = {
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: Record<string, unknown>;
  embedding: number[];
};

export type RetrievedChunk = {
  id: string;
  source_id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: Record<string, any>;
  similarity: number;
  text_rank: number;
  rrf_score: number;
};

export interface ChunkStore {
  sourceHash(sourceId: string): Promise<string | null>;
  /** Upsert rows on (source_id, chunk_index) and drop indexes ≥ rows.length. */
  replaceChunks(userId: number, sourceId: string, rows: ChunkRow[]): Promise<void>;
  listChunks(userId: number, sourceIds: string[]): Promise<Omit<RetrievedChunk, 'similarity' | 'text_rank' | 'rrf_score'>[]>;
  match(args: { userId: number; sourceIds: string[] | null; embedding: number[]; query: string; k: number }): Promise<RetrievedChunk[]>;
}

export const toPgVector = (v: number[]) => `[${v.join(',')}]`;

/** ChunkStore over the Supabase service-role client (edge functions). */
export const supabaseChunkStore = (admin: any): ChunkStore => ({
  async sourceHash(sourceId) {
    const { data, error } = await admin.from('source_chunks')
      .select('metadata').eq('source_id', sourceId).eq('chunk_index', 0).maybeSingle();
    if (error) throw error;
    return data?.metadata?.source_hash ?? null;
  },
  async replaceChunks(userId, sourceId, rows) {
    if (rows.length) {
      const { error } = await admin.from('source_chunks').upsert(
        rows.map((r) => ({ ...r, user_id: userId, source_id: sourceId, embedding: toPgVector(r.embedding) })),
        { onConflict: 'source_id,chunk_index' },
      );
      if (error) throw error;
    }
    const { error } = await admin.from('source_chunks').delete().eq('source_id', sourceId).gte('chunk_index', rows.length);
    if (error) throw error;
  },
  async listChunks(userId, sourceIds) {
    const { data, error } = await admin.from('source_chunks')
      .select('id, source_id, chunk_index, content, token_count, metadata')
      .eq('user_id', userId).in('source_id', sourceIds)
      .order('source_id').order('chunk_index');
    if (error) throw error;
    return data ?? [];
  },
  async match({ userId, sourceIds, embedding, query, k }) {
    const { data, error } = await admin.rpc('match_source_chunks', {
      p_user_id: userId,
      p_source_ids: sourceIds,
      p_query_embedding: toPgVector(embedding),
      p_query_text: query,
      p_match_count: k,
    });
    if (error) throw error;
    return data ?? [];
  },
});

// ── Feature flag ─────────────────────────────────────────────────────────────
export type RagMode = 'rag' | 'full_context';
/** RAG_MODE=full_context rolls every feature back to the old whole-document prompts. */
export const ragMode = (override?: unknown): RagMode => {
  const v = typeof override === 'string' ? override : Deno.env.get('RAG_MODE');
  return v === 'full_context' ? 'full_context' : 'rag';
};
/** Below this many source tokens, generators keep the whole document (retrieval buys nothing). */
export const ragFullContextMaxTokens = () => Number(Deno.env.get('RAG_FULL_CONTEXT_MAX_TOKENS') ?? 6000);
/**
 * Best cosine similarity below this = weak retrieval → tutor refuses without calling the LLM.
 * 0.60 = just under the lowest best-match similarity of any answerable eval question (0.607, first
 * eval run 2026-11-12). Unanswerable-but-on-topic questions scored up to 0.73, so similarity alone
 * can't separate them; the prompt's refusal rule handles those.
 */
export const ragMinSimilarity = () => Number(Deno.env.get('RAG_MIN_SIMILARITY') ?? 0.6);

// ── Extraction ───────────────────────────────────────────────────────────────
export const pdfToBlocks = async (bytes: Uint8Array): Promise<Block[]> => {
  // Lazy: keeps rag.ts importable from Node unit tests (npm: specifiers are Deno-only).
  const { extractText, getDocumentProxy } = await import('npm:unpdf@1.9.1');
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: false });
  return pagesToBlocks(text as string[]);
};

/** Note row → blocks: Tiptap structure, plus timestamped transcript segments for audio notes. */
export const noteToBlocks = async (admin: any, note: { id: string; content: unknown; source_type?: string }): Promise<Block[]> => {
  const blocks: Block[] = tiptapToBlocks(note.content);
  if (note.source_type === 'audio') {
    const { data: sessions } = await admin.from('recording_sessions').select('id').eq('note_id', note.id);
    const ids = (sessions ?? []).map((s: { id: string }) => s.id);
    if (ids.length) {
      const { data: segs } = await admin.from('transcript_segments')
        .select('started_at_ms, ended_at_ms, original_text, corrected_text')
        .in('session_id', ids).eq('is_deleted', false).order('started_at_ms');
      blocks.push(...segmentsToBlocks((segs ?? []).map((s: any) => ({
        text: s.corrected_text || s.original_text, start_ms: s.started_at_ms, end_ms: s.ended_at_ms,
      }))));
    }
  }
  return blocks;
};

// ── Ingest ───────────────────────────────────────────────────────────────────
export type IngestResult = { sourceId: string; skipped: boolean; chunks: number; tokens: number };

/**
 * Idempotent: same content hash → no-op; otherwise re-chunk, re-embed, upsert on
 * (source_id, chunk_index) and drop stale trailing chunks.
 */
export const ingestSource = async ({
  store, userId, sourceId, title, kind, blocks, telemetry,
}: {
  store: ChunkStore;
  userId: number;
  sourceId: string;
  title: string;
  kind: string;
  blocks: Block[];
  telemetry?: Partial<LlmTelemetry>;
}): Promise<IngestResult> => {
  const hash = await contentHash(`${title}\n${JSON.stringify(blocks)}`);
  if (await store.sourceHash(sourceId) === hash) {
    return { sourceId, skipped: true, chunks: 0, tokens: 0 };
  }
  const chunks = chunkBlocks(blocks);
  const vectors = await embed(chunks.map((c: { content: string }) => c.content), {
    kind: 'document',
    titles: chunks.map(() => title),
    telemetry: { ...telemetry, userId },
  });
  const rows: ChunkRow[] = chunks.map((c: Omit<ChunkRow, 'embedding'>, i: number) => ({
    ...c,
    metadata: { ...c.metadata, source_title: title, source_kind: kind, source_hash: hash },
    embedding: vectors[i],
  }));
  await store.replaceChunks(userId, sourceId, rows);
  return { sourceId, skipped: false, chunks: rows.length, tokens: rows.reduce((n, r) => n + r.token_count, 0) };
};

// ── Retrieval ────────────────────────────────────────────────────────────────
export const retrieve = async ({
  store, userId, sourceIds, query, k = 8, telemetry,
}: {
  store: ChunkStore;
  userId: number;
  sourceIds: string[] | null;
  query: string;
  k?: number;
  telemetry?: Partial<LlmTelemetry>;
}): Promise<{ chunks: RetrievedChunk[]; retrievalMs: number }> => {
  const started = performance.now();
  const [embedding] = await embed([query], { kind: 'query', telemetry: { ...telemetry, userId } });
  const chunks = await store.match({ userId, sourceIds, embedding, query, k });
  return { chunks, retrievalMs: Math.round(performance.now() - started) };
};

/**
 * Generators: pick chunks by topic/section instead of sending the whole document.
 * One hybrid query per topic (user focus topics + the source's own headings/pages), merged in
 * document order under a token budget. With no topics at all, falls back to an even spread of
 * chunks across the document so coverage doesn't collapse onto its first pages.
 */
export const selectChunksForGeneration = async ({
  store, userId, sourceIds, topics = [], budgetTokens, perTopic = 3, telemetry,
}: {
  store: ChunkStore;
  userId: number;
  sourceIds: string[];
  topics?: string[];
  budgetTokens: number;
  perTopic?: number;
  telemetry?: Partial<LlmTelemetry>;
}): Promise<{ chunks: Array<Omit<RetrievedChunk, 'similarity' | 'text_rank' | 'rrf_score'>>; retrievalMs: number }> => {
  const started = performance.now();
  const all = await store.listChunks(userId, sourceIds);
  // Headings are the document's own section titles; pages without headings are covered by the spread below.
  const sections = [...new Set(all.map((c) => c.metadata?.heading).filter(Boolean))] as string[];
  const queries = [...new Set([...topics, ...sections])].slice(0, 16);

  const picked = new Map<string, (typeof all)[number]>();
  let used = 0;
  const take = (c: (typeof all)[number]) => {
    if (picked.has(c.id) || used + c.token_count > budgetTokens) return;
    picked.set(c.id, c);
    used += c.token_count;
  };

  if (queries.length) {
    const vectors = await embed(queries, { kind: 'query', telemetry: { ...telemetry, userId } });
    const results = await Promise.all(queries.map((q, i) => store.match({ userId, sourceIds, embedding: vectors[i], query: q, k: perTopic })));
    // Round-robin across topics so every topic gets its best chunk before any gets its third.
    for (let rank = 0; rank < perTopic; rank++) for (const r of results) if (r[rank]) take(r[rank] as any);
  }
  // Fill (or, with no topics, build) the remainder with an even spread across the document.
  if (used < budgetTokens && all.length) {
    const avg = all.reduce((n, c) => n + c.token_count, 0) / all.length || 1;
    const slots = Math.max(1, Math.floor((budgetTokens - used) / avg));
    const step = Math.max(1, all.length / slots);
    for (let i = 0; i < all.length; i += step) take(all[Math.floor(i)]);
  }
  const chunks = [...picked.values()].sort((a, b) => a.source_id.localeCompare(b.source_id) || a.chunk_index - b.chunk_index);
  return { chunks, retrievalMs: Math.round(performance.now() - started) };
};

/**
 * Generators (deck / exam / guide): index the incoming source, then — if it's bigger than
 * RAG_FULL_CONTEXT_MAX_TOKENS — replace the whole document with topic-selected excerpts.
 * Returns the source ids so a tutor session can retrieve from them later.
 * Never fails the generation: on any RAG error it falls back to the full-context inputs.
 */
export const applyRagToSource = async ({
  admin, store = supabaseChunkStore(admin), userId, processedNotes, keepFile, file, topics = [], telemetry,
}: {
  admin: any;
  store?: ChunkStore;
  userId: number;
  processedNotes: string;
  keepFile: boolean;
  file?: { data?: string; mimeType?: string; name?: string } | null;
  topics?: string[];
  telemetry?: Partial<LlmTelemetry>;
}): Promise<{ processedNotes: string; keepFile: boolean; sourceIds: string[]; retrieval: { ms: number; chunks: number } | null }> => {
  const passthrough = { processedNotes, keepFile, sourceIds: [] as string[], retrieval: null };
  if (ragMode() === 'full_context') return passthrough;
  try {
    const sources: Array<{ id: string; title: string; kind: string; blocks: Block[]; pdf?: boolean }> = [];
    if (processedNotes.trim()) {
      const title = processedNotes.match(/^-{2,}\s*(.+?)\s*-{2,}$/m)?.[1] ?? 'Notes';
      sources.push({ id: await uploadSourceId(userId, processedNotes), title, kind: 'upload:text', blocks: plainTextToBlocks(processedNotes) });
    }
    if (keepFile && file?.data && file.mimeType === 'application/pdf') {
      const bytes = new Uint8Array(Buffer.from(file.data, 'base64'));
      const blocks = await pdfToBlocks(bytes);
      // Scanned PDFs have no text layer: keep sending the file itself.
      if (blocks.length) sources.push({ id: await uploadSourceId(userId, bytes), title: file.name || 'Uploaded PDF', kind: 'upload:pdf', blocks, pdf: true });
    }
    if (!sources.length) return passthrough;

    await Promise.all(sources.map((src) => ingestSource({
      store, userId, sourceId: src.id, title: src.title, kind: src.kind, blocks: src.blocks, telemetry,
    })));
    const sourceIds = sources.map((src) => src.id);
    const totalTokens = sources.reduce((n, src) => n + src.blocks.reduce((m, b) => m + estimateTokens(b.text), 0), 0);
    if (totalTokens <= ragFullContextMaxTokens()) {
      // Small enough to send whole; indexing still lets the tutor cite it later.
      return { processedNotes, keepFile, sourceIds, retrieval: null };
    }
    const { chunks, retrievalMs } = await selectChunksForGeneration({
      store, userId, sourceIds, topics: topics.filter(Boolean), budgetTokens: ragFullContextMaxTokens(), telemetry,
    });
    return {
      processedNotes: `Source excerpts (selected by topic and section from a longer source; labels show where each came from):\n\n${buildRagContext(chunks)}`,
      keepFile: keepFile && !sources.some((src) => src.pdf),
      sourceIds,
      retrieval: { ms: retrievalMs, chunks: chunks.length },
    };
  } catch (error) {
    console.error('[rag] falling back to full context', error);
    return passthrough;
  }
};

export { estimateTokens };
