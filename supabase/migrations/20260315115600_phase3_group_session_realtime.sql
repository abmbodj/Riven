ALTER TABLE public.cram_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cram_sessions_select ON public.cram_sessions;
CREATE POLICY cram_sessions_select ON public.cram_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      WHERE gm.group_id = cram_sessions.group_id
        AND gm.user_id = public.get_app_user_id()
    )
  );

ALTER TABLE public.cram_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cram_responses_select ON public.cram_responses;
CREATE POLICY cram_responses_select ON public.cram_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.cram_sessions s
      JOIN public.group_members gm
        ON gm.group_id = s.group_id
      WHERE s.id = cram_responses.session_id
        AND gm.user_id = public.get_app_user_id()
    )
  );

ALTER TABLE public.cram_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.cram_responses REPLICA IDENTITY FULL;

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
      AND tablename = 'cram_sessions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cram_sessions;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cram_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cram_responses;
  END IF;
END;
$$;
