// ChunkStore + llm_calls recorder over a plain Postgres connection (npm:pg), for the eval harness
// and integration test. Production uses supabaseChunkStore (PostgREST); the SQL is the same.
import pg from 'npm:pg@8.13.1';

import { toPgVector, type ChunkStore } from '../../functions/_shared/rag.ts';
import type { LlmRecorder } from '../../functions/_shared/llmTelemetry.ts';

export type PgClient = InstanceType<typeof pg.Client>;

export const connectPg = async (url = Deno.env.get('RAG_TEST_DATABASE_URL') ?? 'postgresql://postgres:postgres@localhost:54329/postgres') => {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  return client;
};

/** Apply the stub schema + the real migration to an empty database (idempotent). */
export const migrate = async (client: PgClient) => {
  const root = new URL('../../', import.meta.url);
  await client.query(await Deno.readTextFile(new URL('tests/rag/bootstrap.sql', root)));
  await client.query(await Deno.readTextFile(new URL('migrations/20261112120000_rag_source_chunks.sql', root)));
};

export const pgChunkStore = (client: PgClient): ChunkStore => ({
  async sourceHash(sourceId) {
    const { rows } = await client.query(
      `select metadata->>'source_hash' as h from public.source_chunks where source_id = $1 and chunk_index = 0`,
      [sourceId],
    );
    return rows[0]?.h ?? null;
  },
  async replaceChunks(userId, sourceId, rows) {
    await client.query('begin');
    try {
      for (const r of rows) {
        await client.query(
          `insert into public.source_chunks (user_id, source_id, chunk_index, content, token_count, metadata, embedding)
           values ($1, $2, $3, $4, $5, $6, $7::extensions.vector)
           on conflict (source_id, chunk_index) do update set
             content = excluded.content, token_count = excluded.token_count,
             metadata = excluded.metadata, embedding = excluded.embedding`,
          [userId, sourceId, r.chunk_index, r.content, r.token_count, r.metadata, toPgVector(r.embedding)],
        );
      }
      await client.query('delete from public.source_chunks where source_id = $1 and chunk_index >= $2', [sourceId, rows.length]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    }
  },
  async listChunks(userId, sourceIds) {
    const { rows } = await client.query(
      `select id, source_id, chunk_index, content, token_count, metadata from public.source_chunks
       where user_id = $1 and source_id = any($2::uuid[]) order by source_id, chunk_index`,
      [userId, sourceIds],
    );
    return rows;
  },
  async match({ userId, sourceIds, embedding, query, k }) {
    const { rows } = await client.query(
      `select * from public.match_source_chunks($1, $2::uuid[], $3::extensions.vector, $4, $5)`,
      [userId, sourceIds, toPgVector(embedding), query, k],
    );
    return rows.map((r: any) => ({ ...r, similarity: Number(r.similarity), text_rank: Number(r.text_rank), rrf_score: Number(r.rrf_score) }));
  },
});

export const pgRecorder = (client: PgClient): LlmRecorder => async (row) => {
  const cols = Object.keys(row);
  await client.query(
    `insert into public.llm_calls (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')})`,
    Object.values(row),
  );
};
