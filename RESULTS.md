# RAG eval results

Every number below was measured by `npm run eval` (`eval/run.ts`) or read from the `llm_calls` table it
wrote. Raw per-question output is in `eval/results/latest.json`. Percent changes are arithmetic on the
measured values.

**Setup:** local Postgres 17 + pgvector 0.8.7 (docker), run 2026-11-13. Embeddings: `gemini-embedding-2`
at 1536 dims via the Gemini Developer API. Generation and judge: `gpt-5.4-mini`. RAG answers use top-6 chunks
and `RAG_MIN_SIMILARITY=0.60`. The test set has 49 questions over 5 sources: 41 answerable, 8 unanswerable.

**What "full context" means here:** all five documents are put whole into the prompt. That is the old
path the deck, exam, and guide generators use. Production `tutor-chat` never saw sources at all before
this change (card-only chat), so this is a comparison against prompt stuffing, not against today's tutor.

## Index

| | measured |
|---|---|
| Sources indexed | 5 (1 PDF, 1 Tiptap note, 1 audio transcript, 1 YouTube transcript, 1 text study guide) |
| Chunks indexed | 26 (6,247 tokens total) |
| Ingest embedding cost | 6,217 tokens, $0.001243 |

## Retrieval (hybrid vector + full-text, RRF)

| | measured |
|---|---|
| recall@5 | **1.00** (41/41) |
| recall@1 / @3 / @10 | 1.00 / 1.00 / 1.00 |
| MRR | 1.000 |
| Best-match similarity, answerable | min 0.607, median 0.747 |
| Best-match similarity, unanswerable | median 0.666, max 0.731 |

The two similarity ranges overlap, so the 0.60 threshold only catches clearly off-topic questions.
Unanswerable questions close to the material are refused by the prompt's "answer only from excerpts"
rule.

The corpus is small (26 chunks across five unrelated subjects), so retrieval is near its ceiling. These
recall numbers don't predict recall on a student's real library of overlapping notes.

## Answers: RAG vs full context (run 2, the final run)

| | RAG | Full context |
|---|---|---|
| Answer correctness (LLM judge) | **100%** (41/41) | 100% (41/41) |
| Citation accuracy, strict (right source and page / time range / section) | **100%** (41/41) | 61.0% (25/41) |
| Citation accuracy, source only | 100% (41/41) | 87.8% (36/41) |
| Refusal rate on unanswerable | 87.5% (7/8) | 87.5% (7/8) |
| False refusals on answerable | 0% (0/41) | 0% (0/41) |
| Generation input tokens per request | **1,783.6** | 5,986.8 (−70.2% with RAG) |
| Query-embedding tokens per request | 19.5 | none |
| Cost per request (generation + query embedding) | **$0.001537** | $0.004667 (−67.1% with RAG) |
| p50 end-to-end latency | 1,011 ms | 738 ms |
| p95 end-to-end latency | 1,322 ms | 1,023 ms |
| p95 generation call latency (`llm_calls`) | 960 ms | 984 ms |
| p95 time to first token (`llm_calls`) | 677 ms | 695 ms |
| Median retrieval time (embed query + SQL) | 276 ms | none |

Notes on the table:

- **RAG is slower end to end.** The generation call itself is about the same speed. The extra time is the
  query embedding plus the SQL search (276 ms median). p95 latency also moved a lot between runs:
  - Run 1, an identical pipeline before the refusal fix below: RAG p95 1,872 ms, full context p95 963 ms.
  - Run 2: RAG p95 1,322 ms, full context p95 1,023 ms.
- **Refusal matching bug, found by this eval.** In run 1 the model refused with a curly apostrophe
  ("I don’t know…"). Exact matching missed it, and RAG scored 6/8 on unanswerable questions. The fix
  normalises apostrophes before matching (`ragAnswer.ts`). Run 2 is after the fix.
- **The unanswerable question both modes got wrong is un-08.** It asks what comes after the next video,
  and both modes answered with what the next video is.
- **Full context loses strict citations on the notes.** Its 16 strict misses cite a document name with
  no section, mostly on the heading-only notes.
- **The judge is not included in any cost figure.** Its own spend was $0.0271 for 82 calls.

## Not measured

- **Production `llm_calls`.** Nothing is deployed. The migration and functions have only run against the
  local database.
- **The Vertex AI embedding path.** No GCP project or service account was available, so every embedding
  above went through the Gemini Developer API (same model).
- **Flashcard, exam, and guide generation quality under RAG.** The eval covers question answering only.
  The corpus (6,247 tokens) is also close to the 6,000-token cutoff where the generators switch to
  topic-selected excerpts, so that path wasn't exercised on large sources. The integration test checks
  that the topic chunk is picked, the token budget holds, and chunks come back in document order, but
  it doesn't measure output quality.
- **Backfill speed and cost on real user notes.** The backfill script has not been run against any real
  data.
- **Deepgram transcription cost and latency.** Not instrumented.
- **Recall on larger, overlapping libraries.** See the caveat under Retrieval.
