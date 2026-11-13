-- RAG: pgvector source chunks, hybrid retrieval, background ingestion, LLM observability.
-- Rollback: supabase/rollbacks/20261112120000_rag_source_chunks.down.sql

create extension if not exists vector with schema extensions;

-- ── Chunks ───────────────────────────────────────────────────────────────────
-- source_id = notes.id for notes, or a content-addressed uuid for ad-hoc uploads.
create table if not exists public.source_chunks (
  id           uuid primary key default gen_random_uuid(),
  user_id      integer not null references public.users(id) on delete cascade,
  source_id    uuid not null,
  chunk_index  integer not null check (chunk_index >= 0),
  content      text not null,
  token_count  integer not null check (token_count >= 0),
  -- page / start_ms / end_ms / heading / source_title / source_kind / source_hash
  metadata     jsonb not null default '{}'::jsonb,
  -- gemini-embedding-2 at output_dimensionality=1536 (HNSW on `vector` caps at 2000 dims).
  embedding    extensions.vector(1536),
  content_tsv  tsvector generated always as (to_tsvector('english', content)) stored,
  created_at   timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create index if not exists source_chunks_user_source_idx on public.source_chunks (user_id, source_id);
create index if not exists source_chunks_embedding_hnsw_idx
  on public.source_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists source_chunks_tsv_gin_idx on public.source_chunks using gin (content_tsv);

alter table public.source_chunks enable row level security;

-- Users read only their own chunks. Writes are service-role only (ingestion job), so no
-- insert/update/delete policies exist.
drop policy if exists source_chunks_select_own on public.source_chunks;
create policy source_chunks_select_own on public.source_chunks
  for select using (user_id = public.get_app_user_id());

-- ── Hybrid retrieval: vector + full text, fused with reciprocal rank fusion ──
-- SECURITY INVOKER: an authenticated caller is still bound by RLS above; the service role
-- (edge functions) must pass the caller's user id explicitly.
create or replace function public.match_source_chunks(
  p_user_id         integer,
  p_source_ids      uuid[],
  p_query_embedding extensions.vector(1536),
  p_query_text      text,
  p_match_count     integer default 8,
  p_candidates      integer default 40,
  p_rrf_k           integer default 60
)
returns table (
  id          uuid,
  source_id   uuid,
  chunk_index integer,
  content     text,
  token_count integer,
  metadata    jsonb,
  similarity  double precision,
  text_rank   real,
  rrf_score   double precision
)
language sql
stable
security invoker
set search_path = public, extensions
-- Filtered HNSW scans keep going until enough rows survive the user/source filter (pgvector ≥ 0.8).
set hnsw.iterative_scan = 'relaxed_order'
set hnsw.ef_search = 100
as $$
  with vec as (
    select c.id, row_number() over (order by c.embedding <=> p_query_embedding) as rnk
    from public.source_chunks c
    where c.user_id = p_user_id
      and (p_source_ids is null or c.source_id = any (p_source_ids))
      and c.embedding is not null
    order by c.embedding <=> p_query_embedding
    limit p_candidates
  ),
  q as (select websearch_to_tsquery('english', coalesce(p_query_text, '')) as tsq),
  fts as (
    select c.id, ts_rank_cd(c.content_tsv, q.tsq) as text_rank,
           row_number() over (order by ts_rank_cd(c.content_tsv, q.tsq) desc) as rnk
    from public.source_chunks c, q
    where c.user_id = p_user_id
      and (p_source_ids is null or c.source_id = any (p_source_ids))
      and c.content_tsv @@ q.tsq
    order by text_rank desc
    limit p_candidates
  ),
  fused as (
    select coalesce(v.id, f.id) as id,
           f.text_rank,
           coalesce(1.0 / (p_rrf_k + v.rnk), 0) + coalesce(1.0 / (p_rrf_k + f.rnk), 0) as rrf_score
    from vec v
    full outer join fts f on f.id = v.id
  )
  select c.id, c.source_id, c.chunk_index, c.content, c.token_count, c.metadata,
         1 - (c.embedding <=> p_query_embedding) as similarity,
         coalesce(fused.text_rank, 0)::real as text_rank,
         fused.rrf_score
  from fused
  join public.source_chunks c on c.id = fused.id
  order by fused.rrf_score desc, c.chunk_index
  limit p_match_count;
$$;

revoke all on function public.match_source_chunks(integer, uuid[], extensions.vector, text, integer, integer, integer) from public, anon;
grant execute on function public.match_source_chunks(integer, uuid[], extensions.vector, text, integer, integer, integer) to authenticated, service_role;

-- Sources a tutor session was generated from, so tutor-chat can retrieve from them.
alter table public.study_guides add column if not exists source_ids uuid[] not null default '{}';

-- ── Background ingestion via the existing ai_jobs runner ────────────────────
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check check (kind in (
  'deck_generation', 'class_generation', 'guide_generation', 'exam_generation', 'note_enhancement',
  'youtube_source', 'youtube_deck', 'youtube_guide', 'youtube_exam', 'youtube_notes',
  'source_ingest'
));

create index if not exists ai_jobs_source_ingest_due_idx
  on public.ai_jobs (next_attempt_at)
  where kind = 'source_ingest' and status = 'queued';

-- Enqueue (re-)ingestion whenever a note's text changes. Deduped: at most one queued job per
-- note. The job itself skips work when the content hash is unchanged.
create or replace function public.enqueue_note_ingest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.content is not distinct from old.content and new.title is not distinct from old.title then
    return new;
  end if;
  if exists (
    select 1 from public.ai_jobs
    where kind = 'source_ingest' and status = 'queued' and source_key = 'note:' || new.id::text
  ) then
    return new;
  end if;
  insert into public.ai_jobs (user_id, kind, status, phase, input_payload, source_key, target_type, target_id, next_attempt_at)
  values (new.user_id, 'source_ingest', 'queued', 'accepted',
          jsonb_build_object('sourceType', 'note', 'noteId', new.id),
          'note:' || new.id::text, 'note', new.id::text,
          -- Small debounce so a burst of autosaves collapses into one ingest.
          now() + interval '30 seconds');
  return new;
end;
$$;

revoke all on function public.enqueue_note_ingest() from public, anon, authenticated;

drop trigger if exists notes_enqueue_ingest on public.notes;
create trigger notes_enqueue_ingest
  after insert or update of content, title on public.notes
  for each row execute function public.enqueue_note_ingest();

-- Deleting a note removes its chunks (uploads have no parent row; they go with the user).
create or replace function public.delete_note_chunks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.source_chunks where source_id = old.id;
  return old;
end;
$$;

revoke all on function public.delete_note_chunks() from public, anon, authenticated;

drop trigger if exists notes_delete_chunks on public.notes;
create trigger notes_delete_chunks
  after delete on public.notes
  for each row execute function public.delete_note_chunks();

-- ── LLM observability ────────────────────────────────────────────────────────
create table if not exists public.llm_calls (
  id                     uuid primary key default gen_random_uuid(),
  user_id                integer references public.users(id) on delete set null,
  feature                text not null check (feature in (
    'tutor', 'flashcards', 'exam', 'guide', 'notes', 'transcription', 'embedding', 'grading', 'eval', 'other'
  )),
  provider               text not null,
  model                  text not null,
  input_tokens           integer,
  output_tokens          integer,
  latency_ms             integer not null,
  time_to_first_token_ms integer,
  tokens_per_sec         numeric,
  cost_usd               numeric(12, 8),
  retrieval_ms           integer,
  chunks_used            integer,
  success                boolean not null,
  error_code             text,
  trace_id               uuid,
  created_at             timestamptz not null default now()
);

create index if not exists llm_calls_feature_created_idx on public.llm_calls (feature, created_at desc);
create index if not exists llm_calls_trace_idx on public.llm_calls (trace_id);

-- Service-role only (edge functions write, admins read via SQL). No policies → RLS denies clients.
alter table public.llm_calls enable row level security;

create or replace view public.llm_call_stats
with (security_invoker = true)
as
select
  feature,
  (date_trunc('day', created_at))::date                                          as day,
  count(*)                                                                        as calls,
  count(distinct coalesce(trace_id, id))                                          as requests,
  count(distinct user_id)                                                         as active_users,
  percentile_cont(0.5)  within group (order by latency_ms)                        as p50_latency_ms,
  percentile_cont(0.95) within group (order by latency_ms)                        as p95_latency_ms,
  percentile_cont(0.95) within group (order by time_to_first_token_ms)            as p95_ttft_ms,
  sum(input_tokens)                                                               as input_tokens,
  sum(output_tokens)                                                              as output_tokens,
  sum(cost_usd)                                                                   as total_cost_usd,
  sum(cost_usd) / nullif(count(distinct coalesce(trace_id, id)), 0)              as cost_per_request_usd,
  sum(cost_usd) / nullif(count(distinct user_id), 0)                              as cost_per_active_user_usd,
  avg(case when success then 0 else 1 end)::numeric(6, 4)                         as error_rate
from public.llm_calls
group by feature, (date_trunc('day', created_at))::date;

revoke all on public.llm_call_stats from anon, authenticated;
