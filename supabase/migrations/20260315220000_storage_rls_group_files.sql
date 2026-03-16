-- Allow authenticated users to upload files to the group-files bucket.
-- Group membership is validated at the application layer (edge function)
-- before the DB record is created.
DROP POLICY IF EXISTS "Authenticated users can upload to group-files" ON storage.objects;
CREATE POLICY "Authenticated users can upload to group-files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'group-files');

-- Allow public read access (the bucket URLs already use /object/public/).
DROP POLICY IF EXISTS "Public read access for group-files" ON storage.objects;
CREATE POLICY "Public read access for group-files"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'group-files');

-- Allow authenticated users to delete from group-files.
-- Fine-grained ownership checks are enforced at the app layer (edge function).
DROP POLICY IF EXISTS "Authenticated users can delete from group-files" ON storage.objects;
CREATE POLICY "Authenticated users can delete from group-files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'group-files');
