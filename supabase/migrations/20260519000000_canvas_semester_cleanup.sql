ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_source TEXT,
  ADD COLUMN IF NOT EXISTS canvas_last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS canvas_last_assignment_due_at TIMESTAMPTZ;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS class_cleanup_archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS class_cleanup_previous_status TEXT;

DROP INDEX IF EXISTS public.classes_user_canvas_course_unique;

WITH active_duplicate_canvas_course_keys AS (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, canvas_course_id
        ORDER BY created_at ASC, id ASC
      ) AS row_num
    FROM public.classes
    WHERE canvas_course_id IS NOT NULL
      AND COALESCE(is_archived, FALSE) = FALSE
  ) ranked
  WHERE row_num > 1
)
UPDATE public.classes
SET canvas_course_id = NULL
WHERE id IN (SELECT id FROM active_duplicate_canvas_course_keys);

CREATE UNIQUE INDEX IF NOT EXISTS classes_user_active_canvas_course_unique
  ON public.classes (user_id, canvas_course_id)
  WHERE canvas_course_id IS NOT NULL
    AND COALESCE(is_archived, FALSE) = FALSE;

CREATE INDEX IF NOT EXISTS classes_user_archive_state_idx
  ON public.classes (user_id, is_archived, archived_at);

CREATE INDEX IF NOT EXISTS assignments_class_cleanup_restore_idx
  ON public.assignments (user_id, class_id, class_cleanup_archived_at)
  WHERE class_cleanup_archived_at IS NOT NULL;
