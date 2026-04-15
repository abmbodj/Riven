-- Ensure xp_earned has a database-level DEFAULT 0.
-- The original ADD COLUMN IF NOT EXISTS was a no-op if the column already existed
-- without a default, leaving rows from code paths that omit the field hitting the
-- NOT NULL constraint.
ALTER TABLE public.study_sessions
  ALTER COLUMN xp_earned SET DEFAULT 0;
