-- Fix get_group_details: rename local variable `current_role` to `member_role`
-- `current_role` is a PostgreSQL system variable (type `name`), which caused a
-- type mismatch in column 8 (my_role text) when used inside RETURN QUERY SELECT.

DROP FUNCTION IF EXISTS public.get_group_details(uuid);

CREATE FUNCTION public.get_group_details(target_group_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  class_id uuid,
  join_code text,
  created_by integer,
  created_at timestamptz,
  class_name text,
  my_role text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  member_role text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT gm.role
  INTO member_role
  FROM public.group_members gm
  WHERE gm.group_id = target_group_id
    AND gm.user_id = current_user_id;

  IF member_role IS NULL THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  SELECT
    g.id,
    g.name,
    g.class_id,
    g.join_code,
    g.created_by,
    g.created_at,
    c.name AS class_name,
    member_role AS my_role
  FROM public.study_groups g
  LEFT JOIN public.classes c
    ON c.id = g.class_id
  WHERE g.id = target_group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_details(uuid) TO authenticated;
