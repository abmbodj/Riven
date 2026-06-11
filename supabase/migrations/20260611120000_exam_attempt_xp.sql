-- Track XP granted per exam attempt so the exam-complete edge function is idempotent:
-- XP is awarded once per attempt, and replays grant nothing.
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS xp_awarded integer;
