-- ─────────────────────────────────────────────────────
-- Audio Notes: enhanced_content column + note-audio storage bucket
-- ─────────────────────────────────────────────────────

-- Add enhanced_content column for AI-enhanced notes (Tiptap JSON)
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS enhanced_content jsonb DEFAULT NULL;

-- Add audio_duration_seconds for display purposes
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS audio_duration_seconds integer DEFAULT NULL;

-- ========== STORAGE BUCKET ==========

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'note-audio',
  'note-audio',
  false,
  209715200,  -- 200MB
  ARRAY['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Users can upload audio to their own folder: note-audio/{user_id}/...
DROP POLICY IF EXISTS "Users can upload own note audio" ON storage.objects;
CREATE POLICY "Users can upload own note audio"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'note-audio'
    AND (storage.foldername(name))[1] = (public.get_app_user_id())::text
  );

-- Users can read their own audio files
DROP POLICY IF EXISTS "Users can read own note audio" ON storage.objects;
CREATE POLICY "Users can read own note audio"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'note-audio'
    AND (storage.foldername(name))[1] = (public.get_app_user_id())::text
  );

-- Users can delete their own audio files
DROP POLICY IF EXISTS "Users can delete own note audio" ON storage.objects;
CREATE POLICY "Users can delete own note audio"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'note-audio'
    AND (storage.foldername(name))[1] = (public.get_app_user_id())::text
  );
