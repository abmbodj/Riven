-- Repair remote drift where migration history includes the AI note columns
-- but the live notes table is missing them.
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS transcript text DEFAULT NULL;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS audio_segments jsonb DEFAULT NULL;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS polish_status text DEFAULT NULL;

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS knowledge_layer jsonb DEFAULT NULL;

-- Refresh PostgREST/Supabase schema cache for Edge Function inserts.
NOTIFY pgrst, 'reload schema';
