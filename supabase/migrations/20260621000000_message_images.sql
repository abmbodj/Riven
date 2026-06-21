-- Private direct-message image attachments.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS image_path text DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'message-images',
  'message-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "DM image senders can upload" ON storage.objects;
CREATE POLICY "DM image senders can upload"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'message-images'
    AND (storage.foldername(name))[1] = (public.get_app_user_id())::text
  );

DROP POLICY IF EXISTS "DM image participants can read" ON storage.objects;
CREATE POLICY "DM image participants can read"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'message-images'
    AND (
      (storage.foldername(name))[1] = (public.get_app_user_id())::text
      OR (storage.foldername(name))[2] = (public.get_app_user_id())::text
    )
  );

DROP POLICY IF EXISTS "DM image senders can delete" ON storage.objects;
CREATE POLICY "DM image senders can delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'message-images'
    AND (storage.foldername(name))[1] = (public.get_app_user_id())::text
  );
