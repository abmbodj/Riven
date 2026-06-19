-- Make set_group_availability atomic: flip the caller's share mode to busy_free
-- in the same transaction as the availability row writes. Without this, a realtime
-- event on group_member_availability fires onChanged → refreshRange() BEFORE the
-- client's second setGroupScheduleShare call commits, so the refetch sees
-- share_mode='hidden' and computes denominator=0, reverting the optimistic heatmap.
-- With this change the two writes are one transaction — no in-between state is
-- observable. The client's conditional setGroupScheduleShare call is removed.

CREATE OR REPLACE FUNCTION public.set_group_availability(
  target_group_id uuid,
  cells jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  cell_count integer := 0;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT public.is_group_member(target_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  DELETE FROM public.group_member_availability
  WHERE group_id = target_group_id
    AND user_id = current_user_id;

  INSERT INTO public.group_member_availability (group_id, user_id, day_of_week, hour)
  SELECT
    target_group_id,
    current_user_id,
    (cell->>'day_of_week')::smallint,
    (cell->>'hour')::smallint
  FROM jsonb_array_elements(COALESCE(cells, '[]'::jsonb)) AS cell
  WHERE (cell->>'day_of_week')::int BETWEEN 0 AND 6
    AND (cell->>'hour')::int BETWEEN 0 AND 23
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS cell_count = ROW_COUNT;

  -- Painting cells implies participation. Upsert share mode here (same transaction)
  -- so availability rows and share mode become visible atomically. Only promotes
  -- hidden→busy_free; never downgrades an existing busy_free or full row.
  IF cell_count > 0 THEN
    INSERT INTO public.group_schedule_shares (group_id, user_id, visibility_mode)
    VALUES (target_group_id, current_user_id, 'busy_free')
    ON CONFLICT (group_id, user_id) DO UPDATE
      SET visibility_mode = 'busy_free', updated_at = now()
      WHERE public.group_schedule_shares.visibility_mode = 'hidden';
  END IF;

  RETURN jsonb_build_object('group_id', target_group_id, 'cell_count', cell_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_group_availability(uuid, jsonb) TO authenticated;
