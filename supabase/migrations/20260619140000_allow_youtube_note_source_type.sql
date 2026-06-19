-- Allow generated YouTube notes to persist their source type.
ALTER TABLE public.notes
  DROP CONSTRAINT IF EXISTS notes_source_type_check;

ALTER TABLE public.notes
  ADD CONSTRAINT notes_source_type_check
  CHECK (source_type IN ('manual', 'audio', 'import', 'youtube'));
