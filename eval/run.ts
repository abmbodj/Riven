// RAG evaluation harness. Runs the production ingest → retrieve → answer code against a local
// Postgres + pgvector, for both the RAG path and the old full-context path.
//
//   deno run -A eval/run.ts [--retrieval-only] [--modes rag,full_context] [--min-recall5 0.9]
//                           [--min-similarity 0.55] [--limit N] [--out eval/results/latest.json]
//
// Env: GEMINI_API_KEY (embeddings), OPENAI_API_KEY (generation + judge; not needed with
// --retrieval-only), RAG_TEST_DATABASE_URL (default postgresql://postgres:postgres@localhost:54329/postgres).
// Cost/token/latency numbers are read back from the llm_calls rows the instrumented clients wrote.
import { parseArgs } from 'jsr:@std/cli@1.0.6/parse-args';

import { loadCorpus } from './corpus.ts';
import { connectPg, migrate, pgChunkStore, pgRecorder } from '../supabase/tests/rag/pgStore.ts';
import { ingestSource, retrieve } from '../supabase/functions/_shared/rag.ts';
import { answerQuestion } from '../supabase/functions/_shared/ragAnswer.ts';
import { createAiClient } from '../supabase/functions/_shared/aiClient.ts';
import { aiModelMap } from '../supabase/functions/_shared/aiCore.mjs';
import { newTraceId, setDefaultLlmRecorder } from '../supabase/functions/_shared/llmTelemetry.ts';
import { RAG_REFUSAL } from '../supabase/functions/_shared/ragCore.mjs';

const args = parseArgs(Deno.args, {
  boolean: ['retrieval-only'],
  string: ['modes', 'min-recall5', 'min-similarity', 'limit', 'out', 'k'],
  default: { modes: 'rag,full_context', out: 'eval/results/latest.json', k: '5' },
});
const K = Number(args.k);
const MODEL = aiModelMap.grading; // tutor-chat's model
const PERSONA = 'You are River, a warm, concise study tutor. Answer the student in 1-4 sentences.';

type Q = { id: string; doc: string | null; question: string; expected: string | null; evidence: string | null };
const questions: Q[] = JSON.parse(await Deno.readTextFile(new URL('./questions.json', import.meta.url)))
  .slice(0, args.limit ? Number(args.limit) : undefined);

const norm = (s: string) => s.toLowerCase().replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
const pct = (x: number) => Math.round(x * 1000) / 10;
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  return s[lo] + (s[Math.ceil(pos)] - s[lo]) * (pos - lo);
};

// ── Setup: fresh schema, one student, all five sources ───────────────────────
const db = await connectPg();
await migrate(db);
await db.query('truncate public.source_chunks, public.llm_calls');
const { rows: [user] } = await db.query(`insert into public.users (supabase_auth_id) values (gen_random_uuid()) returning id`);
const userId: number = user.id;
setDefaultLlmRecorder(pgRecorder(db));
const store = pgChunkStore(db);

const docs = await loadCorpus();
const sourceIdByDoc: Record<string, string> = {};
for (const doc of docs) {
  const sourceId = crypto.randomUUID();
  sourceIdByDoc[doc.key] = sourceId;
  await ingestSource({ store, userId, sourceId, title: doc.title, kind: doc.kind, blocks: doc.blocks, telemetry: { traceId: newTraceId() } });
}
const sourceIds = Object.values(sourceIdByDoc);
const docBySource = Object.fromEntries(Object.entries(sourceIdByDoc).map(([k, v]) => [v, k]));
const allChunks = await store.listChunks(userId, sourceIds);
const ingestCost = (await db.query(`select coalesce(sum(cost_usd),0) c, coalesce(sum(input_tokens),0) t from llm_calls where feature='embedding'`)).rows[0];
console.log(`indexed ${docs.length} sources → ${allChunks.length} chunks (embedding ${ingestCost.t} tokens, $${Number(ingestCost.c).toFixed(6)})`);

// ── Ground truth: chunks containing each question's evidence phrase ─────────
const expected: Record<string, string[]> = {};
for (const q of questions.filter((q) => q.evidence)) {
  const hits = allChunks.filter((c) => docBySource[c.source_id] === q.doc && norm(c.content).includes(norm(q.evidence!)));
  if (!hits.length) throw new Error(`evidence for ${q.id} not found in any ${q.doc} chunk: "${q.evidence}"`);
  expected[q.id] = hits.map((c) => c.id);
}
await Deno.mkdir('eval/results', { recursive: true });
await Deno.writeTextFile('eval/results/expected_chunks.json', JSON.stringify(
  Object.fromEntries(Object.entries(expected).map(([id, ids]) => [id, ids.map((cid) => {
    const c = allChunks.find((x) => x.id === cid)!;
    return `${docBySource[c.source_id]}#${c.chunk_index}`;
  })])), null, 2) + '\n');

// ── Retrieval metrics (hybrid RRF, top 10) ───────────────────────────────────
const retrievalRows: Array<{ id: string; answerable: boolean; rank: number | null; bestSim: number }> = [];
for (const q of questions) {
  const { chunks } = await retrieve({ store, userId, sourceIds, query: q.question, k: 10, telemetry: { traceId: newTraceId() } });
  const rankIdx = q.evidence ? chunks.findIndex((c) => expected[q.id].includes(c.id)) : -1;
  retrievalRows.push({
    id: q.id,
    answerable: !!q.evidence,
    rank: rankIdx >= 0 ? rankIdx + 1 : null,
    bestSim: Math.max(0, ...chunks.map((c) => c.similarity)),
  });
}
const answerableRows = retrievalRows.filter((r) => r.answerable);
const recallAt = (k: number) => answerableRows.filter((r) => r.rank !== null && r.rank <= k).length / answerableRows.length;
const mrr = answerableRows.reduce((s, r) => s + (r.rank ? 1 / r.rank : 0), 0) / answerableRows.length;
const simsA = answerableRows.map((r) => r.bestSim);
const simsU = retrievalRows.filter((r) => !r.answerable).map((r) => r.bestSim);
const retrieval = {
  questions: retrievalRows.length,
  answerable: answerableRows.length,
  [`recall@1`]: recallAt(1),
  [`recall@3`]: recallAt(3),
  [`recall@${K}`]: recallAt(K),
  [`recall@10`]: recallAt(10),
  mrr,
  best_similarity: {
    answerable: { min: Math.min(...simsA), p10: quantile(simsA, 0.1), median: quantile(simsA, 0.5) },
    unanswerable: { max: Math.max(...simsU), p90: quantile(simsU, 0.9), median: quantile(simsU, 0.5) },
  },
  misses: answerableRows.filter((r) => !r.rank || r.rank > K).map((r) => ({ id: r.id, rank: r.rank })),
};
console.log('retrieval', JSON.stringify(retrieval, null, 2));

const minSimilarity = args['min-similarity'] ? Number(args['min-similarity']) : undefined;
const results: Record<string, unknown> = {
  run_at: new Date().toISOString(),
  model: MODEL,
  embedding_model: 'gemini-embedding-2',
  sources: docs.length,
  chunks: allChunks.length,
  min_similarity: minSimilarity ?? null,
  retrieval,
};

// ── Answer metrics, per mode ─────────────────────────────────────────────────
const citationOk = (reply: string, qid: string) => {
  const evidenceChunks = allChunks.filter((c) => expected[qid].includes(c.id));
  const cites = [...reply.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  return cites.some((cite) => evidenceChunks.some((c) => {
    const meta = c.metadata as Record<string, any>;
    const doc = docs.find((d) => d.key === docBySource[c.source_id])!;
    const [title, ...rest] = cite.split(',');
    const loc = rest.join(',').trim().toLowerCase();
    if (!norm(doc.title).includes(norm(title)) && !norm(title).includes(norm(doc.title))) return false;
    if (meta.page != null) return new RegExp(`\\bp(?:age|\\.)?\\s*${meta.page}\\b`).test(loc);
    if (meta.start_ms != null) {
      const toMs = (t: string) => t.split(':').map(Number).reduce((a, n) => a * 60 + n, 0) * 1000;
      const times = [...loc.matchAll(/(\d+:\d{2}(?::\d{2})?)/g)].map((m) => toMs(m[1]));
      // Any cited time (or range) that overlaps the evidence chunk's span, ±30 s.
      return times.length > 0 && (times.length === 2
        ? times[0] <= meta.end_ms + 30_000 && times[1] >= meta.start_ms - 30_000
        : times.some((t) => t >= meta.start_ms - 30_000 && t <= meta.end_ms + 30_000));
    }
    return meta.heading ? loc.includes(norm(meta.heading)) : true;
  }));
};

const citationSourceOk = (reply: string, docKey: string) => {
  const title = norm(docs.find((d) => d.key === docKey)!.title);
  return [...reply.matchAll(/\[([^\]]+)\]/g)].some((m) => {
    const t = norm(m[1].split(',')[0]);
    return title.includes(t) || t.includes(title);
  });
};

if (!args['retrieval-only']) {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for answer metrics (or pass --retrieval-only)');
  const judge = createAiClient(apiKey, undefined, { feature: 'eval' });
  const fullContextText = docs.map((d) => `=== ${d.title} ===\n${d.fullText}`).join('\n\n');

  for (const mode of String(args.modes).split(',') as Array<'rag' | 'full_context'>) {
    const rows: Array<Record<string, unknown>> = [];
    for (const q of questions) {
      const traceId = newTraceId();
      const ai = createAiClient(apiKey, undefined, { feature: 'tutor', userId, traceId });
      const started = performance.now();
      const ans = await answerQuestion({
        ai, model: MODEL, store, userId, sourceIds, question: q.question, persona: PERSONA,
        mode, fullContextText, minSimilarity, telemetry: { traceId },
      });
      const latencyMs = performance.now() - started;

      let correct: boolean | null = null;
      if (q.expected) {
        if (ans.refused) correct = false;
        else {
          const verdict = await judge.generateContent({
            model: MODEL,
            responseFormat: 'json_object',
            maxTokens: 300,
            messages: [
              { role: 'system', content: 'You grade a study tutor. Decide if the ANSWER is correct with respect to the REFERENCE: it must state the key facts of the reference and not contradict it. Extra correct detail and bracketed citations are fine. Reply as JSON: {"correct": true|false, "reason": "..."}' },
              { role: 'user', content: `QUESTION: ${q.question}\nREFERENCE: ${q.expected}\nANSWER: ${ans.reply}` },
            ],
          });
          try { correct = JSON.parse(verdict).correct === true; } catch { correct = false; }
        }
      }
      const cost = (await db.query(
        `select coalesce(sum(cost_usd),0)::float8 cost,
                coalesce(sum(input_tokens) filter (where feature='tutor'),0)::int gen_in,
                coalesce(sum(output_tokens) filter (where feature='tutor'),0)::int gen_out,
                max(latency_ms) filter (where feature='tutor') gen_ms,
                max(time_to_first_token_ms) filter (where feature='tutor') ttft_ms
           from llm_calls where trace_id = $1`, [traceId])).rows[0];
      rows.push({
        id: q.id,
        answerable: !!q.expected,
        refused: ans.refused,
        correct,
        cited_ok: q.expected && !ans.refused ? citationOk(ans.reply, q.id) : null,
        cited_source_ok: q.expected && !ans.refused ? citationSourceOk(ans.reply, q.doc!) : null,
        latency_ms: Math.round(latencyMs),
        retrieval_ms: ans.retrievalMs,
        chunks_used: ans.chunks.length,
        input_tokens: cost.gen_in,
        output_tokens: cost.gen_out,
        gen_latency_ms: cost.gen_ms,
        ttft_ms: cost.ttft_ms,
        cost_usd: cost.cost,
        trace_id: traceId,
        reply: ans.reply,
      });
      console.log(`[${mode}] ${q.id} ${ans.refused ? 'REFUSED' : correct === null ? '-' : correct ? 'ok' : 'WRONG'} ${Math.round(latencyMs)}ms`);
    }
    const answerable = rows.filter((r) => r.answerable);
    const unanswerable = rows.filter((r) => !r.answerable);
    const answered = answerable.filter((r) => !r.refused);
    const generated = rows.filter((r) => (r.input_tokens as number) > 0);
    const lat = rows.map((r) => r.latency_ms as number);
    results[mode] = {
      answer_correctness: answerable.filter((r) => r.correct).length / answerable.length,
      // strict: right source AND right page / time range / section heading
      citation_accuracy: answered.length ? answered.filter((r) => r.cited_ok).length / answered.length : null,
      // lenient: right source document, locator ignored
      citation_source_accuracy: answered.length ? answered.filter((r) => r.cited_source_ok).length / answered.length : null,
      refusal_rate_unanswerable: unanswerable.filter((r) => r.refused).length / unanswerable.length,
      false_refusal_rate_answerable: answerable.filter((r) => r.refused).length / answerable.length,
      p50_latency_ms: quantile(lat, 0.5),
      p95_latency_ms: quantile(lat, 0.95),
      p95_ttft_ms: quantile(generated.map((r) => r.ttft_ms as number).filter((x) => x != null), 0.95),
      avg_input_tokens_per_request: rows.reduce((s, r) => s + (r.input_tokens as number), 0) / rows.length,
      avg_input_tokens_per_generated_answer: generated.length ? generated.reduce((s, r) => s + (r.input_tokens as number), 0) / generated.length : null,
      avg_cost_usd_per_request: rows.reduce((s, r) => s + (r.cost_usd as number), 0) / rows.length,
      requests: rows.length,
      rows,
    };
  }
}

await Deno.writeTextFile(String(args.out), JSON.stringify(results, null, 2) + '\n');

// ── Summary ──────────────────────────────────────────────────────────────────
console.log(`\nrecall@1 ${pct(recallAt(1))}%  recall@3 ${pct(recallAt(3))}%  recall@${K} ${pct(recallAt(K))}%  recall@10 ${pct(recallAt(10))}%  MRR ${mrr.toFixed(3)}`);
for (const mode of ['rag', 'full_context']) {
  const m = results[mode] as Record<string, number> | undefined;
  if (!m) continue;
  console.log(`${mode.padEnd(12)} correct ${pct(m.answer_correctness)}%  citations ${m.citation_accuracy == null ? 'n/a' : pct(m.citation_accuracy) + '%'} (source-level ${m.citation_source_accuracy == null ? 'n/a' : pct(m.citation_source_accuracy) + '%'})  refusals(unanswerable) ${pct(m.refusal_rate_unanswerable)}%  false refusals ${pct(m.false_refusal_rate_answerable)}%  p95 ${Math.round(m.p95_latency_ms)}ms  in-tokens/req ${Math.round(m.avg_input_tokens_per_request)}  $/req ${m.avg_cost_usd_per_request.toFixed(6)}`);
}
console.log(`wrote ${args.out}`);
await db.end();

if (args['min-recall5'] && recallAt(5) < Number(args['min-recall5'])) {
  console.error(`FAIL: recall@5 ${recallAt(5).toFixed(3)} < threshold ${args['min-recall5']}`);
  Deno.exit(1);
}
void RAG_REFUSAL;
