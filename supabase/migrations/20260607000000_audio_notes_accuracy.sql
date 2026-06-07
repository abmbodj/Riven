-- ─────────────────────────────────────────────────────
-- Audio Notes: accuracy + replay groundwork
--   transcript        : the (vocabulary-biased) lecture transcript used to build the note
--   audio_segments    : Whisper segment timeline [{ id, start, end, text }] for timestamp replay
--   polish_status     : draft/polish lifecycle ('polishing' | 'polished'); NULL for legacy notes
-- ─────────────────────────────────────────────────────

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS transcript text DEFAULT NULL;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS audio_segments jsonb DEFAULT NULL;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS polish_status text DEFAULT NULL;
