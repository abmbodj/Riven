ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS canvas_course_id TEXT;

WITH duplicate_canvas_course_keys AS (
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
  ) ranked
  WHERE row_num > 1
)
UPDATE public.classes
SET canvas_course_id = NULL
WHERE id IN (SELECT id FROM duplicate_canvas_course_keys);

CREATE UNIQUE INDEX IF NOT EXISTS classes_user_canvas_course_unique
  ON public.classes (user_id, canvas_course_id)
  WHERE canvas_course_id IS NOT NULL;
