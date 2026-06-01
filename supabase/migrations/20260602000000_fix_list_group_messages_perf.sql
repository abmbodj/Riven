-- Fix: list_group_messages was a LANGUAGE sql function calling is_group_member()
-- in the WHERE clause. is_group_member() calls get_app_user_id() which calls
-- auth.uid() (reads JWT session state = effectively volatile). PostgreSQL
-- cannot hoist a volatile-dependent function out of per-row evaluation in a
-- plain SQL function, causing ~50 extra user-table lookups per query → timeout.
--
-- Fix: convert to plpgsql, resolve caller ID and membership check ONCE at the
-- top, and pre-resolve the cursor timestamp to eliminate the correlated subquery.

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
