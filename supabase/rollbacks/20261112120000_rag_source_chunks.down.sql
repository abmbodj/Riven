-- Reverses supabase/migrations/20261112120000_rag_source_chunks.sql.
-- Run manually (psql / SQL editor), then: npx supabase migration repair --status reverted 20261112120000

drop view if exists public.llm_call_stats;
drop table if exists public.llm_calls;

drop trigger if exists notes_delete_chunks on public.notes;
drop function if exists public.delete_note_chunks();
drop trigger if exists notes_enqueue_ingest on public.notes;
drop function if exists public.enqueue_note_ingest();

delete from public.ai_jobs where kind = 'source_ingest';
drop index if exists public.ai_jobs_source_ingest_due_idx;
alter table public.ai_jobs drop constraint if exists ai_jobs_kind_check;
alter table public.ai_jobs add constraint ai_jobs_kind_check check (kind in (
  'deck_generation', 'class_generation', 'guide_generation', 'exam_generation', 'note_enhancement',
  'youtube_source', 'youtube_deck', 'youtube_guide', 'youtube_exam', 'youtube_notes'
));

alter table public.study_guides drop column if exists source_ids;
drop function if exists public.match_source_chunks(integer, uuid[], extensions.vector, text, integer, integer, integer);
drop table if exists public.source_chunks;
-- The vector extension is left installed: other objects may depend on it.
