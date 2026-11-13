// Integration: ingest → retrieve → answer on a fixture PDF, against Postgres + pgvector with real
// gemini-embedding-2 embeddings. Generation uses a recording fake unless OPENAI_API_KEY is set.
//
//   docker run -d -p 54329:5432 -e POSTGRES_PASSWORD=postgres pgvector/pgvector:pg17
//   GEMINI_API_KEY=… deno test -A --node-modules-dir=auto supabase/tests/rag/
import { assert, assertEquals, assertMatch, assertStringIncludes } from 'jsr:@std/assert@1.0.8';

import { connectPg, migrate, pgChunkStore, pgRecorder } from './pgStore.ts';
import { ingestSource, pdfToBlocks, retrieve } from '../../functions/_shared/rag.ts';
import { answerQuestion } from '../../functions/_shared/ragAnswer.ts';
import { createAiClient, type AiClient, type AiMessage } from '../../functions/_shared/aiClient.ts';
import { newTraceId, setDefaultLlmRecorder } from '../../functions/_shared/llmTelemetry.ts';
import { RAG_REFUSAL } from '../../functions/_shared/ragCore.mjs';

const ready = Boolean(Deno.env.get('GEMINI_API_KEY'));

Deno.test({ name: 'RAG pipeline: ingest → retrieve → answer on a fixture PDF', ignore: !ready, sanitizeResources: false, sanitizeOps: false }, async (t) => {
  const db = await connectPg();
  await migrate(db);
  const { rows: [user] } = await db.query(`insert into public.users (supabase_auth_id) values (gen_random_uuid()) returning id`);
  const { rows: [other] } = await db.query(`insert into public.users (supabase_auth_id) values (gen_random_uuid()) returning id`);
  setDefaultLlmRecorder(pgRecorder(db));
  const store = pgChunkStore(db);
  const sourceId = crypto.randomUUID();
  const title = 'BIO 201 Lecture 7';
  const blocks = await pdfToBlocks(await Deno.readFile(new URL('../../../eval/corpus/bio201-lecture7.pdf', import.meta.url)));
  const traceId = newTraceId();

  try {
    await t.step('ingest chunks the PDF by page and is idempotent', async () => {
      const first = await ingestSource({ store, userId: user.id, sourceId, title, kind: 'upload:pdf', blocks, telemetry: { traceId } });
      assertEquals(first.skipped, false);
      assertEquals(first.chunks, 6);
      const { rows } = await db.query(`select chunk_index, metadata, token_count, embedding is not null as has_vec
                                         from source_chunks where source_id = $1 order by chunk_index`, [sourceId]);
      assertEquals(rows.map((r: any) => r.metadata.page), [1, 2, 3, 4, 5, 6]);
      assert(rows.every((r: any) => r.has_vec && r.metadata.source_title === title && r.token_count > 0));

      const again = await ingestSource({ store, userId: user.id, sourceId, title, kind: 'upload:pdf', blocks, telemetry: { traceId } });
      assertEquals(again.skipped, true);
    });

    await t.step('a changed source is re-embedded and stale chunks are removed', async () => {
      const shorter = await ingestSource({ store, userId: user.id, sourceId, title, kind: 'upload:pdf', blocks: blocks.slice(0, 4), telemetry: { traceId } });
      assertEquals(shorter.chunks, 4);
      assertEquals((await db.query('select count(*)::int n from source_chunks where source_id = $1', [sourceId])).rows[0].n, 4);
      await ingestSource({ store, userId: user.id, sourceId, title, kind: 'upload:pdf', blocks, telemetry: { traceId } });
      assertEquals((await db.query('select count(*)::int n from source_chunks where source_id = $1', [sourceId])).rows[0].n, 6);
    });

    await t.step('hybrid retrieval finds the right page and is user-scoped', async () => {
      const { chunks } = await retrieve({ store, userId: user.id, sourceIds: [sourceId], query: 'What activates PFK-1?', k: 3, telemetry: { traceId } });
      assertEquals(chunks[0].metadata.page, 2);
      assert(chunks[0].rrf_score > 0 && chunks[0].similarity > 0.5);
      const foreign = await retrieve({ store, userId: other.id, sourceIds: [sourceId], query: 'What activates PFK-1?', k: 3 });
      assertEquals(foreign.chunks.length, 0);
    });

    await t.step('generators get topic-selected chunks under a token budget', async () => {
      const { selectChunksForGeneration } = await import('../../functions/_shared/rag.ts');
      const { chunks } = await selectChunksForGeneration({
        store, userId: user.id, sourceIds: [sourceId], topics: ['electron transport chain poisons cyanide'], budgetTokens: 700, telemetry: { traceId },
      });
      assert(chunks.reduce((n, c) => n + c.token_count, 0) <= 700);
      assert(chunks.some((c) => c.metadata.page === 5), 'topic chunk (page 5) selected');
      assertEquals(chunks.map((c) => c.chunk_index), [...chunks.map((c) => c.chunk_index)].sort((a, b) => a - b));
    });

    await t.step('answer is grounded in labelled excerpts', async () => {
      const prompts: AiMessage[][] = [];
      const fake = {
        async *streamContent({ messages }: { messages: AiMessage[] }) {
          prompts.push(messages);
          yield { text: 'PFK-1 is activated by AMP [BIO 201 Lecture 7, p. 2].' };
        },
      } as unknown as AiClient;
      const apiKey = Deno.env.get('OPENAI_API_KEY');
      const ai = apiKey ? createAiClient(apiKey, undefined, { feature: 'tutor', userId: user.id, traceId }) : fake;
      const res = await answerQuestion({
        ai, model: 'gpt-5.4-mini', store, userId: user.id, sourceIds: [sourceId],
        question: 'What activates PFK-1?', persona: 'You are a tutor.', mode: 'rag', telemetry: { traceId },
      });
      assertEquals(res.refused, false);
      assertStringIncludes(res.reply, 'AMP');
      assertMatch(res.reply, /\[BIO 201 Lecture 7, p\. ?2\]/);
      if (!apiKey) {
        const system = String(prompts[0][0].content);
        assertStringIncludes(system, '[BIO 201 Lecture 7, p. 2]');
        assertStringIncludes(system, 'Answer ONLY from the SOURCE EXCERPTS');
      }
    });

    await t.step('weak retrieval refuses without calling the model', async () => {
      let called = false;
      const fake = { async *streamContent() { called = true; yield { text: 'x' }; } } as unknown as AiClient;
      const res = await answerQuestion({
        ai: fake, model: 'gpt-5.4-mini', store, userId: user.id, sourceIds: [sourceId],
        question: 'Who won the 1998 World Cup?', persona: 'You are a tutor.', mode: 'rag', minSimilarity: 0.95,
      });
      assertEquals(res.refused, true);
      assertEquals(res.reply, RAG_REFUSAL);
      assertEquals(called, false);
    });

    await t.step('one trace id links ingest, retrieval and generation in llm_calls', async () => {
      const { rows } = await db.query(`select feature, provider, model, input_tokens, cost_usd, success from llm_calls where trace_id = $1`, [traceId]);
      const features = new Set(rows.map((r: any) => r.feature));
      assert(features.has('embedding'));
      if (Deno.env.get('OPENAI_API_KEY')) assert(features.has('tutor'));
      assert(rows.every((r: any) => r.success && r.input_tokens > 0 && Number(r.cost_usd) > 0));
    });
  } finally {
    await db.query('delete from source_chunks where source_id = $1', [sourceId]);
    await db.query('delete from users where id = any($1)', [[user.id, other.id]]);
    await db.end();
  }
});
