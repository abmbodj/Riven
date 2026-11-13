# RAG + LLM observability — plan

## What exists today (mapped 2026-11-12)

- **Backend:** Supabase edge functions (Deno). All AI goes through `supabase/functions/_shared/aiClient.ts`
  (`createAiClient`, OpenAI SDK). Models: `gpt-5.4-mini` for everything (`aiModelMap` in `_shared/aiCore.mjs`),
  `whisper-1` for transcription. Deepgram (batch, callback) handles long audio. No Claude calls.
- **Sources are not persisted entities.** `generate-guide` / `generate-deck` / `generate-exam` receive
  `body.notes` (plain text the client flattened from Tiptap notes or a .pptx) and/or `body.file` (base64 PDF /
  image / docx / txt). `prepareAiSource` turns docx/txt into text; PDFs and images are forwarded inline to OpenAI.
  The whole thing goes into the prompt, capped by a per-tier character limit (30k free / 100k premium).
  Persisted material = `notes` (Tiptap JSON; `source_type` manual/audio/import/youtube), with an optional
  `knowledge_layer`. Audio notes have `transcript_segments` (ms timestamps); YouTube transcripts are cached
  in `youtube_transcripts` (plain text).
- **"Tutor"** = tutor sessions (`study_guides`, built by `generate-guide`) + `tutor-chat`, a per-card Socratic
  chat that currently sees only the card's own teaching text, no source.
- **Jobs:** `ai_jobs` table (`attempt_count`, `next_attempt_at`, `retry_until`), `run-ai-job` executes one job,
  `retry-ai-jobs` is hit by pg_cron every minute and dispatches due queued jobs; backoff in `aiJobRetryCore.mjs`.
- **Rate limits:** `_shared/rateLimit.ts` per request; AI quota in `consumeAiQuota`.

## Design

**Source identity.** `source_id uuid`:
- a note → `notes.id`;
- an ad-hoc upload → content-addressed uuid (sha256 of user_id + bytes), so re-uploading the same file reuses
  chunks. No new `sources` table.

**Ingestion** (`_shared/ragCore.mjs` runtime-agnostic + `_shared/rag.ts` edge glue):
1. Extract structured blocks: Tiptap headings/paragraphs (heading path), PDF pages (`unpdf`), audio transcript
   segments (`started_at_ms`), YouTube/plain transcript lines with `[mm:ss]` markers when present.
2. `chunkBlocks()`: group by structure (heading/page/time window), then split to 500–800 tokens with ~15% overlap.
   Metadata keeps `page`, `start_ms/end_ms`, `heading`, `source_title`.
3. `embed(texts, {kind:'document'|'query'})` — one module, provider chosen by env:
   `vertex` (service-account JSON → OAuth token → `aiplatform.<loc>.rep.googleapis.com …:embedContent`) or
   `gemini` (Developer API key, `batchEmbedContents`). Model `gemini-embedding-2`, 1536 dims
   (HNSW on `vector` is limited to 2000 dims; model output is already L2-normalized).
4. Upsert on `(source_id, chunk_index)`; delete chunks with index ≥ new count; store `content_hash` per source so
   unchanged sources are skipped.
5. Background: new `ai_jobs.kind = 'source_ingest'`. A trigger on `notes` insert/update of content enqueues one
   (deduped while queued). `run-ai-job` processes it; `retry-ai-jobs` dispatches it with the existing backoff.
   Uploads are ingested inline (the user is waiting on generation anyway).
6. `scripts/rag-backfill.mjs`: pages through notes ordered by id, writes a cursor file, enqueues/ingests with a
   rate limit; resumable.

**Retrieval:** `match_source_chunks(query_embedding, query_text, source_ids, k)` SQL function: vector top-N +
`ts_rank_cd` top-N, RRF (`1/(60+rank)`), filtered by `auth`/explicit user id and the source list. Returns chunk +
metadata + `similarity` (cosine). Weak retrieval = best cosine < threshold (calibrated by eval) → refuse.

**Generation:**
- `tutor-chat`: when the card's session has sources, retrieve on the question, answer only from chunks, cite
  `[title, p. N]` / `[title, mm:ss]`, refuse when weak.
- deck/exam/guide: retrieve per topic/section (topics from the request/skeleton or a query sweep) and pass the
  retrieved chunks instead of the whole document.
- Flag `RAG_MODE` (`rag` | `full_context`) env + per-request override for eval; `full_context` = today's path.

**Observability:** `llm_calls` table + `llm_call_stats` view (p50/p95 latency, cost/request, cost per active user,
by feature). `createAiClient(apiKey, fetch, { feature, userId, traceId })` records every chat/stream/transcribe
call; `embed()` records embedding calls. Pricing from `_shared/llmPricing.json`. `trace_id` generated at request
entry and threaded through ingest → retrieve → generate.

**Eval:** `eval/` with 5+ synthetic docs (lecture PDF-as-pages, lecture transcript, notes, etc.), 40+ questions
(incl. unanswerable) with expected answers and the chunk ids that contain them. `npm run eval` runs both paths
against a local Postgres+pgvector, reports recall@k, MRR, LLM-judge correctness, citation accuracy, refusal rate,
p95 latency, avg cost. CI job runs retrieval-only metrics (recall@5 gate) — the generation half needs a key.

## Out of scope / known gaps
- Deepgram calls are billed per audio minute through a callback; not instrumented in v1.
- Images inside PDFs are not OCR'd; image-only uploads keep the full-context path.
