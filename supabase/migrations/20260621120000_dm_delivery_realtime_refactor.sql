-- Direct-message delivery metadata and fast conversation listing.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_message_id text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE public.messages
SET read_at = COALESCE(read_at, created_at)
WHERE COALESCE(is_read, 0) <> 0
  AND read_at IS NULL;

UPDATE public.messages
SET delivered_at = COALESCE(delivered_at, read_at, created_at)
WHERE COALESCE(is_read, 0) <> 0
  AND delivered_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_sender_client_message_id
  ON public.messages (sender_id, client_message_id)
  WHERE client_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_dm_pair_created
  ON public.messages (
    (LEAST(sender_id, receiver_id)),
    (GREATEST(sender_id, receiver_id)),
    created_at DESC,
    id DESC
  );

CREATE INDEX IF NOT EXISTS idx_messages_receiver_unread_created
  ON public.messages (receiver_id, sender_id, created_at DESC)
  WHERE read_at IS NULL AND COALESCE(is_read, 0) = 0;

CREATE OR REPLACE FUNCTION public.list_dm_conversations()
RETURNS TABLE (
  user_id integer,
  username text,
  avatar text,
  last_message text,
  last_message_type text,
  last_message_at timestamptz,
  is_own_message boolean,
  unread_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.get_app_user_id() AS id
  ),
  visible_messages AS (
    SELECT
      m.*,
      CASE WHEN m.sender_id = me.id THEN m.receiver_id ELSE m.sender_id END AS other_user_id
    FROM public.messages m
    CROSS JOIN me
    WHERE (m.sender_id = me.id OR m.receiver_id = me.id)
      AND public.dm_partner_allowed(
        CASE WHEN m.sender_id = me.id THEN m.receiver_id ELSE m.sender_id END
      )
  ),
  latest AS (
    SELECT DISTINCT ON (other_user_id)
      other_user_id,
      content,
      COALESCE(message_type, 'text') AS message_type,
      created_at,
      sender_id
    FROM visible_messages
    ORDER BY other_user_id, created_at DESC, id DESC
  ),
  unread AS (
    SELECT
      other_user_id,
      COUNT(*)::integer AS unread_count
    FROM visible_messages
    CROSS JOIN me
    WHERE receiver_id = me.id
      AND read_at IS NULL
      AND COALESCE(is_read, 0) = 0
    GROUP BY other_user_id
  )
  SELECT
    u.id AS user_id,
    u.username,
    u.avatar,
    latest.content AS last_message,
    latest.message_type AS last_message_type,
    latest.created_at AS last_message_at,
    latest.sender_id = (SELECT id FROM me) AS is_own_message,
    COALESCE(unread.unread_count, 0) AS unread_count
  FROM latest
  JOIN public.users u ON u.id = latest.other_user_id
  LEFT JOIN unread ON unread.other_user_id = latest.other_user_id
  ORDER BY latest.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_delivered(other_user_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET delivered_at = COALESCE(delivered_at, now())
  WHERE sender_id = other_user_id
    AND receiver_id = public.get_app_user_id()
    AND delivered_at IS NULL
    AND public.dm_partner_allowed(other_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_read(other_user_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.messages
  SET
    is_read = 1,
    delivered_at = COALESCE(delivered_at, now()),
    read_at = COALESCE(read_at, now())
  WHERE sender_id = other_user_id
    AND receiver_id = public.get_app_user_id()
    AND (COALESCE(is_read, 0) = 0 OR read_at IS NULL)
    AND public.dm_partner_allowed(other_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_dm_conversations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_delivered(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(integer) TO authenticated;
