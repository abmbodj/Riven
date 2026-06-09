-- ─────────────────────────────────────────────────────
-- Notes: structured knowledge layer
--   knowledge_layer : the single hand-off every downstream generator consumes
--                     (flashcards, mock exams, study guides, future tutor).
--                     Shape: { version, content_type, subject, summary, concepts[],
--                     key_terms[], formulas[], action_items[], emphasis_signals[] }.
--                     NULL for legacy/manual/file notes — consumers fall back to prose.
-- ─────────────────────────────────────────────────────

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS knowledge_layer jsonb DEFAULT NULL;
