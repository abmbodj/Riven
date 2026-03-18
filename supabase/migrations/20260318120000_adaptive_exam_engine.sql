-- ─────────────────────────────────────────────────────
-- Adaptive Exam Engine: topic mastery tracking + exam metadata
-- ─────────────────────────────────────────────────────

-- ========== TOPIC MASTERY ==========

CREATE TABLE IF NOT EXISTS public.topic_mastery (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       integer REFERENCES public.users(id) ON DELETE CASCADE,
  class_id      uuid DEFAULT NULL,
  topic         text NOT NULL,
  total_seen    integer NOT NULL DEFAULT 0,
  total_correct integer NOT NULL DEFAULT 0,
  mastery_score real NOT NULL DEFAULT 0.5,
  last_tested   timestamptz DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, class_id, topic)
);

ALTER TABLE public.topic_mastery ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS topic_mastery_select ON public.topic_mastery;
CREATE POLICY topic_mastery_select ON public.topic_mastery
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS topic_mastery_insert ON public.topic_mastery;
CREATE POLICY topic_mastery_insert ON public.topic_mastery
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS topic_mastery_update ON public.topic_mastery;
CREATE POLICY topic_mastery_update ON public.topic_mastery
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS topic_mastery_delete ON public.topic_mastery;
CREATE POLICY topic_mastery_delete ON public.topic_mastery
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_topic_mastery ON public.topic_mastery;
CREATE TRIGGER set_user_id_topic_mastery
  BEFORE INSERT ON public.topic_mastery
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== EXAM ATTEMPTS: add metadata columns ==========

ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS duration_seconds integer DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS topic_breakdown jsonb DEFAULT '{}';


-- ========== MOCK EXAMS: add exam_mode column ==========

ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS exam_mode text NOT NULL DEFAULT 'standard'
    CHECK (exam_mode IN ('standard', 'focused', 'adaptive'));
