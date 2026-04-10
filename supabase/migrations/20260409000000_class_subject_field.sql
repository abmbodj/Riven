-- Add subject field to classes for subject-aware AI generation
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS subject TEXT;
