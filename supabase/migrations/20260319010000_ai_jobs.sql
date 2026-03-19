-- ─────────────────────────────────────────────────────
-- AI Jobs: persistent progress tracking for long-running AI work
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind             text NOT NULL CHECK (kind IN (
    'note_enhancement',
    'youtube_source',
    'youtube_deck',
    'youtube_guide',
    'youtube_exam',
    'youtube_notes'
  )),
  status           text NOT NULL CHECK (status IN (
    'queued',
    'running',
    'streaming',
    'saving',
    'completed',
    'failed',
    'cancelled'
  )),
  phase            text NOT NULL CHECK (phase IN (
    'accepted',
    'uploading_audio',
    'fetching_audio',
    'processing_media',
    'drafting',
    'enriching',
    'saving',
    'done',
    'error'
  )),
  progress_percent integer DEFAULT NULL CHECK (progress_percent IS NULL OR (progress_percent >= 0 AND progress_percent <= 100)),
  progress_message text DEFAULT NULL,
  input_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  result_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_key       text DEFAULT NULL,
  target_type      text DEFAULT NULL,
  target_id        text DEFAULT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  started_at       timestamptz DEFAULT NULL,
  completed_at     timestamptz DEFAULT NULL
);

ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_jobs_select ON public.ai_jobs;
CREATE POLICY ai_jobs_select ON public.ai_jobs
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS ai_jobs_insert ON public.ai_jobs;
CREATE POLICY ai_jobs_insert ON public.ai_jobs
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS ai_jobs_update ON public.ai_jobs;
CREATE POLICY ai_jobs_update ON public.ai_jobs
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS ai_jobs_delete ON public.ai_jobs;
CREATE POLICY ai_jobs_delete ON public.ai_jobs
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_ai_jobs ON public.ai_jobs;
CREATE TRIGGER set_user_id_ai_jobs
  BEFORE INSERT ON public.ai_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_updated_at_ai_jobs ON public.ai_jobs;
CREATE TRIGGER set_updated_at_ai_jobs
  BEFORE UPDATE ON public.ai_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_created_at
  ON public.ai_jobs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_source_key_kind_status
  ON public.ai_jobs (source_key, kind, status);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'ai_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_jobs;
  END IF;
END;
$$;
