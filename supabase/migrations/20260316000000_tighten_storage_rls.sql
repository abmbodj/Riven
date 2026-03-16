-- Tighten group-files storage RLS policies.
-- Previously any authenticated user could upload/delete any file.
-- Now uploads are scoped to group members and deletes are restricted
-- to the file uploader (path-prefix check via the group_id folder).

-- Helper: check if the current auth user is a member of the group whose
-- ID is the first path segment of the storage object name.
CREATE OR REPLACE FUNCTION public.is_group_member_for_storage(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    JOIN public.users u ON u.id = gm.user_id
    WHERE u.supabase_auth_id = auth.uid()
      AND gm.group_id = (storage.foldername(object_name))[1]::uuid
  )
$$;

-- Replace INSERT policy: only group members can upload.
DROP POLICY IF EXISTS "Authenticated users can upload to group-files" ON storage.objects;
CREATE POLICY "Group members can upload to group-files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'group-files'
    AND public.is_group_member_for_storage(name)
  );

-- Keep public read access (unchanged).
-- (Policy "Public read access for group-files" already exists.)

-- Replace DELETE policy: only group members can delete files in their group.
DROP POLICY IF EXISTS "Authenticated users can delete from group-files" ON storage.objects;
CREATE POLICY "Group members can delete from group-files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'group-files'
    AND public.is_group_member_for_storage(name)
  );
