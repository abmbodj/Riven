ALTER TABLE public.ai_jobs
  DROP CONSTRAINT IF EXISTS ai_jobs_kind_check;

ALTER TABLE public.ai_jobs
  ADD CONSTRAINT ai_jobs_kind_check CHECK (kind IN (
    'deck_generation',
    'class_generation',
    'guide_generation',
    'exam_generation',
    'note_enhancement',
    'youtube_source',
    'youtube_deck',
    'youtube_guide',
    'youtube_exam',
    'youtube_notes'
  ));
