-- ─────────────────────────────────────────────────────
-- Exam Blueprints: reusable, class-linked "style profiles" extracted from an uploaded
-- past exam. A blueprint captures the question-type mix, length, difficulty curve, topic
-- weighting, tone, mark scheme and duration so new mock exams can be generated in that
-- exact shape from the student's own material.
-- Follows the same RLS + trigger pattern as 20260316120000_study_dashboard_tables.sql
-- ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exam_blueprints (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            integer REFERENCES public.users(id) ON DELETE CASCADE,
  class_id           uuid DEFAULT NULL,
  name               text NOT NULL DEFAULT 'Untitled Blueprint',
  profile            jsonb NOT NULL DEFAULT '{}',
  source_exam_title  text DEFAULT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_blueprints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_blueprints_select ON public.exam_blueprints;
CREATE POLICY exam_blueprints_select ON public.exam_blueprints
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS exam_blueprints_insert ON public.exam_blueprints;
CREATE POLICY exam_blueprints_insert ON public.exam_blueprints
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS exam_blueprints_update ON public.exam_blueprints;
CREATE POLICY exam_blueprints_update ON public.exam_blueprints
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS exam_blueprints_delete ON public.exam_blueprints;
CREATE POLICY exam_blueprints_delete ON public.exam_blueprints
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_exam_blueprints ON public.exam_blueprints;
CREATE TRIGGER set_user_id_exam_blueprints
  BEFORE INSERT ON public.exam_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_updated_at_exam_blueprints ON public.exam_blueprints;
CREATE TRIGGER set_updated_at_exam_blueprints
  BEFORE UPDATE ON public.exam_blueprints
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link a generated exam back to the blueprint it was shaped by (nullable).
ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS blueprint_id uuid REFERENCES public.exam_blueprints(id) ON DELETE SET NULL;
