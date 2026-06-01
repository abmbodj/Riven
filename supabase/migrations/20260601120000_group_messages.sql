-- Group chat messages for study groups
CREATE TABLE group_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id   uuid        NOT NULL REFERENCES study_groups(id) ON DELETE CASCADE,
  sender_id  integer     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    text        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 4000),
  is_edited  boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX group_messages_group_created ON group_messages (group_id, created_at DESC);

ALTER TABLE group_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE group_messages;

ALTER TABLE group_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group members can read messages"
  ON group_messages FOR SELECT
  USING (is_group_member(group_id));

CREATE POLICY "group members can insert own messages"
  ON group_messages FOR INSERT
  WITH CHECK (
    is_group_member(group_id)
    AND sender_id = get_app_user_id()
  );

CREATE POLICY "sender can update own message"
  ON group_messages FOR UPDATE
  USING  (sender_id = get_app_user_id())
  WITH CHECK (sender_id = get_app_user_id());

CREATE POLICY "sender can delete own message"
  ON group_messages FOR DELETE
  USING (sender_id = get_app_user_id());

-- Cursor-based paginated fetch, newest first, with sender profile joined
CREATE OR REPLACE FUNCTION list_group_messages(
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
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    gm.id,
    gm.group_id,
    gm.sender_id,
    gm.content,
    gm.is_edited,
    gm.created_at,
    u.username  AS sender_username,
    u.avatar    AS sender_avatar
  FROM  group_messages gm
  JOIN  users          u  ON u.id = gm.sender_id
  WHERE gm.group_id = target_group_id
    AND is_group_member(target_group_id)
    AND (
      before_id IS NULL
      OR gm.created_at < (
          SELECT m2.created_at FROM group_messages m2 WHERE m2.id = before_id
        )
    )
  ORDER BY gm.created_at DESC
  LIMIT page_limit;
$$;
