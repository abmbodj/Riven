-- ─────────────────────────────────────────────────────
-- Study Dashboard Expansion: notes, study_guides, mock_exams, exam_attempts
-- Follows the same RLS + trigger pattern from 20260314221700_phase2_rls_policies.sql
-- ─────────────────────────────────────────────────────

-- ========== UPDATED_AT TRIGGER FUNCTION ==========

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ========== NOTES ==========

CREATE TABLE IF NOT EXISTS public.notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     integer REFERENCES public.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Untitled',
  content     jsonb DEFAULT '{}',
  class_id    uuid DEFAULT NULL,
  audio_url   text DEFAULT NULL,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('manual', 'audio', 'import')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notes_select ON public.notes;
CREATE POLICY notes_select ON public.notes
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS notes_insert ON public.notes;
CREATE POLICY notes_insert ON public.notes
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS notes_update ON public.notes;
CREATE POLICY notes_update ON public.notes
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS notes_delete ON public.notes;
CREATE POLICY notes_delete ON public.notes
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_notes ON public.notes;
CREATE TRIGGER set_user_id_notes
  BEFORE INSERT ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_updated_at_notes ON public.notes;
CREATE TRIGGER set_updated_at_notes
  BEFORE UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ========== STUDY GUIDES ==========

CREATE TABLE IF NOT EXISTS public.study_guides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     integer REFERENCES public.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Untitled Guide',
  content     jsonb DEFAULT '{}',
  note_id     uuid REFERENCES public.notes(id) ON DELETE SET NULL,
  class_id    uuid DEFAULT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.study_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_guides_select ON public.study_guides;
CREATE POLICY study_guides_select ON public.study_guides
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_guides_insert ON public.study_guides;
CREATE POLICY study_guides_insert ON public.study_guides
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS study_guides_update ON public.study_guides;
CREATE POLICY study_guides_update ON public.study_guides
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS study_guides_delete ON public.study_guides;
CREATE POLICY study_guides_delete ON public.study_guides
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_study_guides ON public.study_guides;
CREATE TRIGGER set_user_id_study_guides
  BEFORE INSERT ON public.study_guides
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_updated_at_study_guides ON public.study_guides;
CREATE TRIGGER set_updated_at_study_guides
  BEFORE UPDATE ON public.study_guides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ========== MOCK EXAMS ==========

CREATE TABLE IF NOT EXISTS public.mock_exams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     integer REFERENCES public.users(id) ON DELETE CASCADE,
  title       text NOT NULL DEFAULT 'Untitled Exam',
  source_type text NOT NULL DEFAULT 'notes' CHECK (source_type IN ('notes', 'guide', 'deck')),
  source_id   text DEFAULT NULL,
  class_id    uuid DEFAULT NULL,
  questions   jsonb NOT NULL DEFAULT '[]',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mock_exams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mock_exams_select ON public.mock_exams;
CREATE POLICY mock_exams_select ON public.mock_exams
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS mock_exams_insert ON public.mock_exams;
CREATE POLICY mock_exams_insert ON public.mock_exams
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS mock_exams_update ON public.mock_exams;
CREATE POLICY mock_exams_update ON public.mock_exams
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS mock_exams_delete ON public.mock_exams;
CREATE POLICY mock_exams_delete ON public.mock_exams
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_mock_exams ON public.mock_exams;
CREATE TRIGGER set_user_id_mock_exams
  BEFORE INSERT ON public.mock_exams
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== EXAM ATTEMPTS ==========

CREATE TABLE IF NOT EXISTS public.exam_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      integer REFERENCES public.users(id) ON DELETE CASCADE,
  exam_id      uuid REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  score        integer NOT NULL,
  total        integer NOT NULL,
  answers      jsonb DEFAULT '[]',
  completed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS exam_attempts_select ON public.exam_attempts;
CREATE POLICY exam_attempts_select ON public.exam_attempts
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS exam_attempts_insert ON public.exam_attempts;
CREATE POLICY exam_attempts_insert ON public.exam_attempts
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS exam_attempts_update ON public.exam_attempts;
CREATE POLICY exam_attempts_update ON public.exam_attempts
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS exam_attempts_delete ON public.exam_attempts;
CREATE POLICY exam_attempts_delete ON public.exam_attempts
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_exam_attempts ON public.exam_attempts;
CREATE TRIGGER set_user_id_exam_attempts
  BEFORE INSERT ON public.exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
