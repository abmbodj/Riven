ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS exam_source_id uuid,
  ADD COLUMN IF NOT EXISTS exam_title text,
  ADD COLUMN IF NOT EXISTS class_id uuid,
  ADD COLUMN IF NOT EXISTS exam_mode text NOT NULL DEFAULT 'standard';

UPDATE public.exam_attempts AS attempts
SET
  exam_source_id = COALESCE(attempts.exam_source_id, attempts.exam_id),
  exam_title = COALESCE(attempts.exam_title, exams.title),
  class_id = COALESCE(attempts.class_id, exams.class_id),
  exam_mode = COALESCE(attempts.exam_mode, exams.exam_mode, 'standard')
FROM public.mock_exams AS exams
WHERE attempts.exam_id = exams.id;

ALTER TABLE public.exam_attempts
  DROP CONSTRAINT IF EXISTS exam_attempts_exam_id_fkey;

ALTER TABLE public.exam_attempts
  ADD CONSTRAINT exam_attempts_exam_id_fkey
    FOREIGN KEY (exam_id)
    REFERENCES public.mock_exams(id)
    ON DELETE SET NULL;

ALTER TABLE public.exam_attempts
  DROP CONSTRAINT IF EXISTS exam_attempts_exam_mode_check;

ALTER TABLE public.exam_attempts
  ADD CONSTRAINT exam_attempts_exam_mode_check
    CHECK (exam_mode IN ('standard', 'focused', 'adaptive'));
