ALTER TABLE public.study_guides
  ADD COLUMN IF NOT EXISTS format_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS guide_data jsonb,
  ADD COLUMN IF NOT EXISTS study_state jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.study_guides
SET format_version = 1
WHERE format_version IS NULL;
