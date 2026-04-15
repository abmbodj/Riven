-- study_sessions.deck_id was NOT NULL from the original deck-only design.
-- The adaptive_study_coach migration added guide_id and updated RLS policies
-- to accept either deck_id or guide_id, but forgot to drop the NOT NULL constraint.
-- Guide sessions have no deck, so inserts were failing.
ALTER TABLE public.study_sessions ALTER COLUMN deck_id DROP NOT NULL;
