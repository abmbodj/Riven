-- Repair migration drift: on the live DB, list_group_messages was still the old
-- LANGUAGE sql version (is_group_member() in the WHERE clause, re-evaluated per
-- row → effectively times out → "Failed to load messages" in group chat), even
-- though 20260602000000_fix_list_group_messages_perf.sql is recorded as applied.
-- Its rewrite to plpgsql never actually ran on remote. Re-assert the correct
-- plpgsql definition here (a fresh, genuinely-pending migration so `db push`
-- executes it) and re-grant EXECUTE. Idempotent; safe to re-run.

CREATE OR REPLACE FUNCTION public.list_group_messages(
  target_group_id uuid,
  before_id       uuid DEFAULT NULL,
  page_limit      int  DEFAULT 50
)
RETURNS TABLE (
  id              uuid,
  group_id        uuid,
  sender_id       integer,
  content         text,
  is_edited       boolean,
  created_at      timestamptz,
  sender_username text,
  sender_avatar   text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  caller_id  integer     := public.get_app_user_id();
  before_ts  timestamptz := NULL;
BEGIN
  -- Membership check runs exactly once
  IF NOT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id  = caller_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  -- Resolve cursor timestamp once (avoids correlated subquery per row)
  IF before_id IS NOT NULL THEN
    SELECT m.created_at INTO before_ts
    FROM public.group_messages m
    WHERE m.id = before_id;
  END IF;

  RETURN QUERY
  SELECT
    gm.id,
    gm.group_id,
    gm.sender_id,
    gm.content,
    gm.is_edited,
    gm.created_at,
    u.username  AS sender_username,
    u.avatar    AS sender_avatar
  FROM  public.group_messages gm
  JOIN  public.users          u  ON u.id = gm.sender_id
  WHERE gm.group_id = target_group_id
    AND (before_ts IS NULL OR gm.created_at < before_ts)
  ORDER BY gm.created_at DESC
  LIMIT page_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_group_messages(uuid, uuid, int) TO authenticated;
