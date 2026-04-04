-- Adaptive Study Coach: progress, achievements, guide-session metadata

ALTER TABLE public.study_sessions
  ADD COLUMN IF NOT EXISTS user_id integer REFERENCES public.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS guide_id uuid REFERENCES public.study_guides(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS class_id uuid DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS source text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS xp_earned integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS mastery_delta integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS weak_area_delta jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.study_sessions
SET user_id = decks.user_id
FROM public.decks
WHERE public.study_sessions.user_id IS NULL
  AND public.study_sessions.deck_id = decks.id;

CREATE OR REPLACE FUNCTION public.owns_guide(target_guide_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_guides
    WHERE id = target_guide_id
      AND user_id = public.get_app_user_id()
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_guide(target_guide_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.study_guides
    WHERE id = target_guide_id
      AND user_id = public.get_app_user_id()
  );
$$;

GRANT EXECUTE ON FUNCTION public.owns_guide(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_guide(uuid) TO authenticated;

DROP POLICY IF EXISTS study_sessions_select ON public.study_sessions;
CREATE POLICY study_sessions_select ON public.study_sessions
  FOR SELECT USING (
    (deck_id IS NOT NULL AND public.can_read_deck(deck_id))
    OR (guide_id IS NOT NULL AND public.can_read_guide(guide_id))
  );

DROP POLICY IF EXISTS study_sessions_insert ON public.study_sessions;
CREATE POLICY study_sessions_insert ON public.study_sessions
  FOR INSERT WITH CHECK (
    (deck_id IS NOT NULL AND public.owns_deck(deck_id))
    OR (guide_id IS NOT NULL AND public.owns_guide(guide_id))
  );

DROP POLICY IF EXISTS study_sessions_update ON public.study_sessions;
CREATE POLICY study_sessions_update ON public.study_sessions
  FOR UPDATE USING (
    (deck_id IS NOT NULL AND public.owns_deck(deck_id))
    OR (guide_id IS NOT NULL AND public.owns_guide(guide_id))
  );

DROP POLICY IF EXISTS study_sessions_delete ON public.study_sessions;
CREATE POLICY study_sessions_delete ON public.study_sessions
  FOR DELETE USING (
    (deck_id IS NOT NULL AND public.owns_deck(deck_id))
    OR (guide_id IS NOT NULL AND public.owns_guide(guide_id))
  );

DROP TRIGGER IF EXISTS set_user_id_study_sessions ON public.study_sessions;
CREATE TRIGGER set_user_id_study_sessions
  BEFORE INSERT ON public.study_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE TABLE IF NOT EXISTS public.study_topic_progress (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            integer REFERENCES public.users(id) ON DELETE CASCADE,
  guide_id           uuid REFERENCES public.study_guides(id) ON DELETE CASCADE,
  class_id           uuid DEFAULT NULL,
  topic_id           text NOT NULL,
  subtopic_id        text NOT NULL,
  mastery_score      real NOT NULL DEFAULT 0,
  confidence_bucket  text NOT NULL DEFAULT 'review_now',
  attempts           integer NOT NULL DEFAULT 0,
  correct_attempts   integer NOT NULL DEFAULT 0,
  current_difficulty text NOT NULL DEFAULT 'support',
  weak_streak        integer NOT NULL DEFAULT 0,
  last_reviewed_at   timestamptz DEFAULT NULL,
  next_review_at     timestamptz DEFAULT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, guide_id, topic_id, subtopic_id)
);

ALTER TABLE public.study_topic_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_topic_progress_select ON public.study_topic_progress;
CREATE POLICY study_topic_progress_select ON public.study_topic_progress
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_topic_progress_insert ON public.study_topic_progress;
CREATE POLICY study_topic_progress_insert ON public.study_topic_progress
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS study_topic_progress_update ON public.study_topic_progress;
CREATE POLICY study_topic_progress_update ON public.study_topic_progress
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_topic_progress_delete ON public.study_topic_progress;
CREATE POLICY study_topic_progress_delete ON public.study_topic_progress
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_study_topic_progress ON public.study_topic_progress;
CREATE TRIGGER set_user_id_study_topic_progress
  BEFORE INSERT ON public.study_topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_updated_at_study_topic_progress ON public.study_topic_progress;
CREATE TRIGGER set_updated_at_study_topic_progress
  BEFORE UPDATE ON public.study_topic_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.study_user_stats (
  user_id            integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  xp_total           integer NOT NULL DEFAULT 0,
  level              integer NOT NULL DEFAULT 1,
  last_study_at      timestamptz DEFAULT NULL,
  sessions_completed integer NOT NULL DEFAULT 0,
  topics_mastered    integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_user_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_user_stats_select ON public.study_user_stats;
CREATE POLICY study_user_stats_select ON public.study_user_stats
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_user_stats_insert ON public.study_user_stats;
CREATE POLICY study_user_stats_insert ON public.study_user_stats
  FOR INSERT WITH CHECK (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_user_stats_update ON public.study_user_stats;
CREATE POLICY study_user_stats_update ON public.study_user_stats
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_user_stats_delete ON public.study_user_stats;
CREATE POLICY study_user_stats_delete ON public.study_user_stats
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_updated_at_study_user_stats ON public.study_user_stats;
CREATE TRIGGER set_updated_at_study_user_stats
  BEFORE UPDATE ON public.study_user_stats
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.study_achievements (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          integer REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_key  text NOT NULL,
  unlocked_at      timestamptz NOT NULL DEFAULT now(),
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);

ALTER TABLE public.study_achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_achievements_select ON public.study_achievements;
CREATE POLICY study_achievements_select ON public.study_achievements
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_achievements_insert ON public.study_achievements;
CREATE POLICY study_achievements_insert ON public.study_achievements
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS study_achievements_update ON public.study_achievements;
CREATE POLICY study_achievements_update ON public.study_achievements
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_achievements_delete ON public.study_achievements;
CREATE POLICY study_achievements_delete ON public.study_achievements
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_study_achievements ON public.study_achievements;
CREATE TRIGGER set_user_id_study_achievements
  BEFORE INSERT ON public.study_achievements
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON public.study_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_guide_id ON public.study_sessions(guide_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_topic_progress_user_id ON public.study_topic_progress(user_id, mastery_score ASC);
CREATE INDEX IF NOT EXISTS idx_study_topic_progress_review ON public.study_topic_progress(user_id, next_review_at ASC);
CREATE INDEX IF NOT EXISTS idx_study_achievements_user_id ON public.study_achievements(user_id, unlocked_at DESC);
