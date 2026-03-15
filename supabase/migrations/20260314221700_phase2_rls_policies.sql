-- =============================================================
-- Phase 2: RLS Policies + user_id auto-set trigger
-- Tables: classes, assignments, schedule_slots, folders, tags,
--         themes, decks, deck_tags, cards, study_sessions, messages
-- =============================================================
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================

-- ─────────────────────────────────────────────────────
-- 1. Helper function: resolve auth.uid() → integer user_id
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_app_user_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE supabase_auth_id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────
-- 2. Trigger function: auto-set user_id on INSERT
--    So the client never has to pass user_id explicitly
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.get_app_user_id();
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.user_self_update_allowed(
  target_user_id integer,
  candidate jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  current_row jsonb;
BEGIN
  IF target_user_id IS NULL OR target_user_id <> public.get_app_user_id() OR candidate IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT to_jsonb(u)
  INTO current_row
  FROM public.users u
  WHERE u.id = target_user_id;

  IF current_row IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN (
    candidate
      - 'username'
      - 'display_name'
      - 'bio'
      - 'avatar'
      - 'banner'
      - 'streak_data'
      - 'pet_customization'
  ) = (
    current_row
      - 'username'
      - 'display_name'
      - 'bio'
      - 'avatar'
      - 'banner'
      - 'streak_data'
      - 'pet_customization'
  );
END;
$$;


-- ========== SOCIAL / FRIENDSHIPS ==========

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users
  FOR SELECT USING (id = public.get_app_user_id());

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE USING (id = public.get_app_user_id())
  WITH CHECK (public.user_self_update_allowed(id, to_jsonb(users)));


ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS friendships_select_participants ON public.friendships;
CREATE POLICY friendships_select_participants ON public.friendships
  FOR SELECT USING (
    user_id = public.get_app_user_id()
    OR friend_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS friendships_insert_sender ON public.friendships;
CREATE POLICY friendships_insert_sender ON public.friendships
  FOR INSERT WITH CHECK (
    user_id = public.get_app_user_id()
    AND friend_id <> public.get_app_user_id()
  );

DROP POLICY IF EXISTS friendships_update_participants ON public.friendships;
CREATE POLICY friendships_update_participants ON public.friendships
  FOR UPDATE USING (
    user_id = public.get_app_user_id()
    OR friend_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS friendships_delete_participants ON public.friendships;
CREATE POLICY friendships_delete_participants ON public.friendships
  FOR DELETE USING (
    user_id = public.get_app_user_id()
    OR friend_id = public.get_app_user_id()
  );


ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_blocks_select_owner ON public.user_blocks;
CREATE POLICY user_blocks_select_owner ON public.user_blocks
  FOR SELECT USING (blocker_id = public.get_app_user_id());

DROP POLICY IF EXISTS user_blocks_insert_owner ON public.user_blocks;
CREATE POLICY user_blocks_insert_owner ON public.user_blocks
  FOR INSERT WITH CHECK (
    blocker_id = public.get_app_user_id()
    AND blocked_id <> public.get_app_user_id()
  );

DROP POLICY IF EXISTS user_blocks_delete_owner ON public.user_blocks;
CREATE POLICY user_blocks_delete_owner ON public.user_blocks
  FOR DELETE USING (blocker_id = public.get_app_user_id());


ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reports_select_reporter ON public.reports;
CREATE POLICY reports_select_reporter ON public.reports
  FOR SELECT USING (reporter_id = public.get_app_user_id());

DROP POLICY IF EXISTS reports_insert_reporter ON public.reports;
CREATE POLICY reports_insert_reporter ON public.reports
  FOR INSERT WITH CHECK (reporter_id = public.get_app_user_id());


CREATE OR REPLACE FUNCTION public.search_public_users(search_query text)
RETURNS TABLE (
  id integer,
  username text,
  avatar text,
  banner text,
  bio text,
  share_code text,
  role text,
  is_admin boolean,
  is_owner boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH app_user_ctx AS (
    SELECT public.get_app_user_id() AS id
  ),
  candidates AS (
    SELECT
      u.id,
      u.username,
      u.avatar,
      u.banner,
      COALESCE(u.bio, '') AS bio,
      u.share_code,
      COALESCE(u.role, CASE WHEN COALESCE(u.is_admin, 0) = 1 THEN 'admin' ELSE 'user' END) AS resolved_role
    FROM public.users u
    CROSS JOIN app_user_ctx cu
    WHERE cu.id IS NOT NULL
      AND LENGTH(TRIM(COALESCE(search_query, ''))) >= 2
      AND u.id <> cu.id
      AND (
        LOWER(u.username) LIKE LOWER('%' || TRIM(search_query) || '%')
        OR UPPER(COALESCE(u.share_code, '')) = UPPER(TRIM(search_query))
      )
  )
  SELECT
    c.id,
    c.username,
    c.avatar,
    c.banner,
    c.bio,
    c.share_code,
    c.resolved_role AS role,
    (c.resolved_role IN ('admin', 'owner')) AS is_admin,
    (c.resolved_role = 'owner') AS is_owner
  FROM candidates c
  ORDER BY c.username ASC
  LIMIT 20
$$;

CREATE OR REPLACE FUNCTION public.get_public_user_profile(target_user_id integer)
RETURNS TABLE (
  id integer,
  username text,
  avatar text,
  banner text,
  bio text,
  share_code text,
  created_at timestamp,
  role text,
  is_admin boolean,
  is_owner boolean,
  deck_count integer,
  friendship_status text,
  friendship_direction text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH app_user_ctx AS (
    SELECT public.get_app_user_id() AS id
  ),
  friendships_for_target AS (
    SELECT f.*
    FROM public.friendships f
    CROSS JOIN app_user_ctx cu
    WHERE cu.id IS NOT NULL
      AND (
        (f.user_id = cu.id AND f.friend_id = target_user_id)
        OR (f.user_id = target_user_id AND f.friend_id = cu.id)
      )
    LIMIT 1
  ),
  target_user AS (
    SELECT
      u.id,
      u.username,
      u.avatar,
      u.banner,
      COALESCE(u.bio, '') AS bio,
      u.share_code,
      u.created_at,
      COALESCE(u.role, CASE WHEN COALESCE(u.is_admin, 0) = 1 THEN 'admin' ELSE 'user' END) AS resolved_role
    FROM public.users u
    WHERE u.id = target_user_id
  )
  SELECT
    tu.id,
    tu.username,
    tu.avatar,
    tu.banner,
    tu.bio,
    tu.share_code,
    tu.created_at,
    tu.resolved_role AS role,
    (tu.resolved_role IN ('admin', 'owner')) AS is_admin,
    (tu.resolved_role = 'owner') AS is_owner,
    COALESCE((SELECT COUNT(*)::integer FROM public.decks d WHERE d.user_id = tu.id), 0) AS deck_count,
    fft.status AS friendship_status,
    CASE
      WHEN fft.user_id = (SELECT id FROM app_user_ctx) THEN 'outgoing'
      WHEN fft.user_id IS NOT NULL THEN 'incoming'
      ELSE NULL
    END AS friendship_direction
  FROM target_user tu
  LEFT JOIN friendships_for_target fft ON TRUE
$$;

CREATE OR REPLACE FUNCTION public.list_friends()
RETURNS TABLE (
  id integer,
  username text,
  avatar text,
  bio text,
  status text,
  role text,
  is_admin boolean,
  is_owner boolean,
  is_outgoing boolean,
  created_at timestamp
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH app_user_ctx AS (
    SELECT public.get_app_user_id() AS id
  ),
  friendships_with_profiles AS (
    SELECT
      u.id,
      u.username,
      u.avatar,
      COALESCE(u.bio, '') AS bio,
      f.status,
      f.user_id AS requester_id,
      f.created_at,
      COALESCE(u.role, CASE WHEN COALESCE(u.is_admin, 0) = 1 THEN 'admin' ELSE 'user' END) AS resolved_role
    FROM public.friendships f
    JOIN app_user_ctx cu ON (f.user_id = cu.id OR f.friend_id = cu.id)
    JOIN public.users u ON (CASE WHEN f.user_id = cu.id THEN f.friend_id ELSE f.user_id END) = u.id
  )
  SELECT
    fwp.id,
    fwp.username,
    fwp.avatar,
    fwp.bio,
    fwp.status,
    fwp.resolved_role AS role,
    (fwp.resolved_role IN ('admin', 'owner')) AS is_admin,
    (fwp.resolved_role = 'owner') AS is_owner,
    (fwp.requester_id = (SELECT id FROM app_user_ctx)) AS is_outgoing,
    fwp.created_at
  FROM friendships_with_profiles fwp
  ORDER BY fwp.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(target_user_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  current_user_is_banned boolean := FALSE;
  target_username text;
  existing_status text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF target_user_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot friend yourself';
  END IF;

  SELECT COALESCE(is_banned, FALSE)
  INTO current_user_is_banned
  FROM public.users
  WHERE id = current_user_id;

  IF current_user_is_banned THEN
    RAISE EXCEPTION 'Your account has been restricted from social features.';
  END IF;

  SELECT username
  INTO target_username
  FROM public.users
  WHERE id = target_user_id;

  IF target_username IS NULL THEN
    RAISE EXCEPTION 'Unable to send friend request';
  END IF;

  SELECT status
  INTO existing_status
  FROM public.friendships
  WHERE (user_id = current_user_id AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = current_user_id)
  LIMIT 1;

  IF existing_status = 'accepted' THEN
    RAISE EXCEPTION 'Already friends';
  END IF;

  IF existing_status = 'pending' THEN
    RAISE EXCEPTION 'Friend request already pending';
  END IF;

  INSERT INTO public.friendships (user_id, friend_id, status)
  VALUES (current_user_id, target_user_id, 'pending');

  RETURN jsonb_build_object('message', 'Friend request sent', 'username', target_username);
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(requester_user_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  request_exists boolean := FALSE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF requester_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.friendships
    WHERE user_id = requester_user_id
      AND friend_id = current_user_id
      AND status = 'pending'
  )
  INTO request_exists;

  IF NOT request_exists THEN
    RAISE EXCEPTION 'No pending request found';
  END IF;

  UPDATE public.friendships
  SET status = 'accepted'
  WHERE user_id = requester_user_id
    AND friend_id = current_user_id;

  RETURN jsonb_build_object('message', 'Friend request accepted');
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friendship(target_user_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  DELETE FROM public.friendships
  WHERE (user_id = current_user_id AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = current_user_id);

  RETURN jsonb_build_object('message', 'Friend removed');
END;
$$;

CREATE OR REPLACE FUNCTION public.list_blocked_users()
RETURNS TABLE (
  id integer,
  username text,
  avatar text,
  blocked_at timestamp
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    u.id,
    u.username,
    u.avatar,
    ub.created_at AS blocked_at
  FROM public.user_blocks ub
  JOIN public.users u ON u.id = ub.blocked_id
  WHERE ub.blocker_id = public.get_app_user_id()
  ORDER BY ub.created_at DESC
$$;

CREATE OR REPLACE FUNCTION public.block_user(target_user_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  IF target_user_id = current_user_id THEN
    RAISE EXCEPTION 'Cannot block yourself';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM public.friendships
  WHERE (user_id = current_user_id AND friend_id = target_user_id)
     OR (user_id = target_user_id AND friend_id = current_user_id);

  INSERT INTO public.user_blocks (blocker_id, blocked_id)
  VALUES (current_user_id, target_user_id)
  ON CONFLICT (blocker_id, blocked_id) DO NOTHING;

  RETURN jsonb_build_object('message', 'User blocked successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_user(target_user_id integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID is required';
  END IF;

  DELETE FROM public.user_blocks
  WHERE blocker_id = current_user_id
    AND blocked_id = target_user_id;

  RETURN jsonb_build_object('message', 'User unblocked successfully');
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_report(
  target_user_id integer,
  report_content_type text,
  report_content_id text,
  report_reason text,
  report_details text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  normalized_content_type text := LOWER(BTRIM(COALESCE(report_content_type, '')));
  normalized_content_id text := NULLIF(BTRIM(COALESCE(report_content_id, '')), '');
  normalized_reason text := BTRIM(COALESCE(report_reason, ''));
  normalized_details text := NULLIF(BTRIM(COALESCE(report_details, '')), '');
  valid_content_types text[] := ARRAY['user', 'deck', 'message', 'group', 'other'];
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF normalized_content_type = '' OR normalized_reason = '' THEN
    RAISE EXCEPTION 'Missing required report fields';
  END IF;

  IF LENGTH(normalized_reason) > 500 THEN
    RAISE EXCEPTION 'Reason must be a string under 500 characters';
  END IF;

  IF normalized_details IS NOT NULL AND LENGTH(normalized_details) > 2000 THEN
    RAISE EXCEPTION 'Details must be under 2000 characters';
  END IF;

  IF NOT (normalized_content_type = ANY(valid_content_types)) THEN
    RAISE EXCEPTION 'Invalid content type';
  END IF;

  INSERT INTO public.reports (
    reporter_id,
    reported_user_id,
    content_type,
    content_id,
    reason,
    details
  )
  VALUES (
    current_user_id,
    target_user_id,
    normalized_content_type,
    normalized_content_id,
    normalized_reason,
    COALESCE(normalized_details, '')
  );

  RETURN jsonb_build_object(
    'message',
    'Report submitted successfully. Our team will review it shortly.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.toggle_simulate_free_tier()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  current_role text;
  current_value boolean := FALSE;
  next_value boolean;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT
    COALESCE(role, CASE WHEN COALESCE(is_admin, 0) = 1 THEN 'admin' ELSE 'user' END),
    COALESCE(simulate_free_tier, FALSE)
  INTO current_role, current_value
  FROM public.users
  WHERE id = current_user_id;

  IF current_role IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF current_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Owner or Admin only';
  END IF;

  next_value := NOT current_value;

  UPDATE public.users
  SET simulate_free_tier = next_value
  WHERE id = current_user_id;

  RETURN jsonb_build_object(
    'simulate_free_tier',
    next_value,
    'subscription_tier',
    CASE WHEN next_value THEN 'free' ELSE 'lifetime' END
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_user_groups()
RETURNS TABLE (
  id uuid,
  name text,
  class_id uuid,
  join_code text,
  created_by integer,
  created_at timestamptz,
  class_name text,
  member_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
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
    COUNT(all_members.user_id)::integer AS member_count
  FROM public.study_groups g
  JOIN public.group_members gm
    ON gm.group_id = g.id
   AND gm.user_id = current_user_id
  LEFT JOIN public.classes c
    ON c.id = g.class_id
  LEFT JOIN public.group_members all_members
    ON all_members.group_id = g.id
  GROUP BY g.id, g.name, g.class_id, g.join_code, g.created_by, g.created_at, c.name
  ORDER BY g.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_details(target_group_id uuid)
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
  current_role text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT gm.role
  INTO current_role
  FROM public.group_members gm
  WHERE gm.group_id = target_group_id
    AND gm.user_id = current_user_id;

  IF current_role IS NULL THEN
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
    current_role AS my_role
  FROM public.study_groups g
  LEFT JOIN public.classes c
    ON c.id = g.class_id
  WHERE g.id = target_group_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_group_members(target_group_id uuid)
RETURNS TABLE (
  id integer,
  username text,
  display_name text,
  avatar text,
  role text,
  joined_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.username,
    u.display_name,
    u.avatar,
    gm.role,
    gm.joined_at
  FROM public.group_members gm
  JOIN public.users u
    ON u.id = gm.user_id
  WHERE gm.group_id = target_group_id
  ORDER BY gm.role ASC, gm.joined_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_group_decks(target_group_id uuid)
RETURNS TABLE (
  id integer,
  user_id integer,
  title text,
  description text,
  folder_id integer,
  last_studied timestamp,
  created_at timestamp,
  class_id uuid,
  shared_at timestamptz,
  shared_by_name text,
  shared_by_avatar text,
  card_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.user_id,
    d.title,
    d.description,
    d.folder_id,
    d.last_studied,
    d.created_at,
    d.class_id,
    gd.shared_at,
    u.username AS shared_by_name,
    u.avatar AS shared_by_avatar,
    COUNT(c.id)::integer AS card_count
  FROM public.group_decks gd
  JOIN public.decks d
    ON d.id = gd.deck_id
  JOIN public.users u
    ON u.id = gd.shared_by
  LEFT JOIN public.cards c
    ON c.deck_id = d.id
  WHERE gd.group_id = target_group_id
  GROUP BY
    d.id,
    d.user_id,
    d.title,
    d.description,
    d.folder_id,
    d.last_studied,
    d.created_at,
    d.class_id,
    gd.shared_at,
    u.username,
    u.avatar
  ORDER BY gd.shared_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_group_folders(target_group_id uuid)
RETURNS TABLE (
  id uuid,
  group_id uuid,
  name text,
  created_by integer,
  created_at timestamptz,
  created_by_name text,
  file_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.group_id,
    f.name,
    f.created_by,
    f.created_at,
    u.username AS created_by_name,
    COUNT(gf.id)::integer AS file_count
  FROM public.group_folders f
  JOIN public.users u
    ON u.id = f.created_by
  LEFT JOIN public.group_files gf
    ON gf.folder_id = f.id
  WHERE f.group_id = target_group_id
  GROUP BY f.id, f.group_id, f.name, f.created_by, f.created_at, u.username
  ORDER BY f.name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_group_files(
  target_group_id uuid,
  target_folder_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  group_id uuid,
  folder_id uuid,
  name text,
  file_url text,
  file_type text,
  uploaded_by integer,
  uploaded_at timestamptz,
  uploaded_by_name text,
  uploaded_by_avatar text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  RETURN QUERY
  SELECT
    f.id,
    f.group_id,
    f.folder_id,
    f.name,
    f.file_url,
    f.file_type,
    f.uploaded_by,
    f.uploaded_at,
    u.username AS uploaded_by_name,
    u.avatar AS uploaded_by_avatar
  FROM public.group_files f
  JOIN public.users u
    ON u.id = f.uploaded_by
  WHERE f.group_id = target_group_id
    AND (target_folder_id IS NULL OR f.folder_id = target_folder_id)
  ORDER BY f.uploaded_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_group_sessions(target_group_id uuid)
RETURNS TABLE (
  id uuid,
  group_id uuid,
  deck_id integer,
  started_by integer,
  started_at timestamptz,
  ended_at timestamptz,
  status text,
  deck_title text,
  deck_desc text,
  started_by_name text,
  active_members integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.group_id,
    s.deck_id,
    s.started_by,
    s.started_at,
    s.ended_at,
    s.status,
    d.title AS deck_title,
    d.description AS deck_desc,
    u.username AS started_by_name,
    COUNT(DISTINCT cr.user_id)::integer AS active_members
  FROM public.cram_sessions s
  JOIN public.decks d
    ON d.id = s.deck_id
  JOIN public.users u
    ON u.id = s.started_by
  LEFT JOIN public.cram_responses cr
    ON cr.session_id = s.id
  WHERE s.group_id = target_group_id
    AND s.status = 'active'
  GROUP BY
    s.id,
    s.group_id,
    s.deck_id,
    s.started_by,
    s.started_at,
    s.ended_at,
    s.status,
    d.title,
    d.description,
    u.username
  ORDER BY s.started_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_group_session_results(target_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  target_group_id uuid;
  payload jsonb;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT s.group_id
  INTO target_group_id
  FROM public.cram_sessions s
  WHERE s.id = target_session_id;

  IF target_group_id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = current_user_id
  ) THEN
    RAISE EXCEPTION 'Not a member';
  END IF;

  SELECT jsonb_build_object(
    'weakSpots',
    COALESCE((
      SELECT jsonb_agg(to_jsonb(weak_spot) ORDER BY weak_spot.incorrect_count DESC)
      FROM (
        WITH card_stats AS (
          SELECT
            cr.card_id,
            COUNT(cr.user_id)::integer AS total_responses,
            SUM(CASE WHEN cr.knew_it = false THEN 1 ELSE 0 END)::integer AS incorrect_count
          FROM public.cram_responses cr
          WHERE cr.session_id = target_session_id
          GROUP BY cr.card_id
        )
        SELECT
          c.id,
          c.deck_id,
          c.front,
          c.back,
          c.front_image,
          c.back_image,
          c.position,
          c.difficulty,
          c.times_reviewed,
          c.times_correct,
          c.last_reviewed,
          c.next_review,
          c.created_at,
          cs.total_responses,
          cs.incorrect_count
        FROM card_stats cs
        JOIN public.cards c
          ON c.id = cs.card_id
        WHERE cs.incorrect_count > 0
          AND (cs.incorrect_count::float / NULLIF(cs.total_responses, 0)) >= 0.5
        ORDER BY cs.incorrect_count DESC
        LIMIT 10
      ) weak_spot
    ), '[]'::jsonb),
    'personalStats',
    (
      SELECT jsonb_build_object(
        'total_answered', COUNT(*)::integer,
        'total_correct', COALESCE(SUM(CASE WHEN cr.knew_it THEN 1 ELSE 0 END), 0)::integer
      )
      FROM public.cram_responses cr
      WHERE cr.session_id = target_session_id
        AND cr.user_id = current_user_id
    )
  )
  INTO payload;

  RETURN payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_public_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_user_profile(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friendship(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_blocked_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_user(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unblock_user(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_report(integer, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_self_update_allowed(integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_simulate_free_tier() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_user_groups() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_details(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_group_members(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_group_decks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_group_folders(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_group_files(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_group_sessions(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_group_session_results(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────
-- 3. Enable RLS + Create policies + Attach trigger
-- ─────────────────────────────────────────────────────

-- ========== CLASSES ==========

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classes_select ON public.classes;
CREATE POLICY classes_select ON public.classes
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS classes_insert ON public.classes;
CREATE POLICY classes_insert ON public.classes
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS classes_update ON public.classes;
CREATE POLICY classes_update ON public.classes
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS classes_delete ON public.classes;
CREATE POLICY classes_delete ON public.classes
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_classes ON public.classes;
CREATE TRIGGER set_user_id_classes
  BEFORE INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== ASSIGNMENTS ==========

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS assignments_select ON public.assignments;
CREATE POLICY assignments_select ON public.assignments
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS assignments_insert ON public.assignments;
CREATE POLICY assignments_insert ON public.assignments
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS assignments_update ON public.assignments;
CREATE POLICY assignments_update ON public.assignments
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS assignments_delete ON public.assignments;
CREATE POLICY assignments_delete ON public.assignments
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_assignments ON public.assignments;
CREATE TRIGGER set_user_id_assignments
  BEFORE INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== SCHEDULE_SLOTS ==========

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_slots_select ON public.schedule_slots;
CREATE POLICY schedule_slots_select ON public.schedule_slots
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS schedule_slots_insert ON public.schedule_slots;
CREATE POLICY schedule_slots_insert ON public.schedule_slots
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS schedule_slots_update ON public.schedule_slots;
CREATE POLICY schedule_slots_update ON public.schedule_slots
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS schedule_slots_delete ON public.schedule_slots;
CREATE POLICY schedule_slots_delete ON public.schedule_slots
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_schedule_slots ON public.schedule_slots;
CREATE TRIGGER set_user_id_schedule_slots
  BEFORE INSERT ON public.schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== FOLDERS ==========

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS folders_select ON public.folders;
CREATE POLICY folders_select ON public.folders
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS folders_insert ON public.folders;
CREATE POLICY folders_insert ON public.folders
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS folders_update ON public.folders;
CREATE POLICY folders_update ON public.folders
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS folders_delete ON public.folders;
CREATE POLICY folders_delete ON public.folders
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_folders ON public.folders;
CREATE TRIGGER set_user_id_folders
  BEFORE INSERT ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== TAGS ==========

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tags_select ON public.tags;
CREATE POLICY tags_select ON public.tags
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS tags_insert ON public.tags;
CREATE POLICY tags_insert ON public.tags
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS tags_update ON public.tags;
CREATE POLICY tags_update ON public.tags
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS tags_delete ON public.tags;
CREATE POLICY tags_delete ON public.tags
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_tags ON public.tags;
CREATE TRIGGER set_user_id_tags
  BEFORE INSERT ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== THEMES ==========

ALTER TABLE public.themes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS themes_select ON public.themes;
CREATE POLICY themes_select ON public.themes
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS themes_insert ON public.themes;
CREATE POLICY themes_insert ON public.themes
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS themes_update ON public.themes;
CREATE POLICY themes_update ON public.themes
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS themes_delete ON public.themes;
CREATE POLICY themes_delete ON public.themes
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_themes ON public.themes;
CREATE TRIGGER set_user_id_themes
  BEFORE INSERT ON public.themes
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== DECK ACCESS HELPERS ==========

CREATE OR REPLACE FUNCTION public.owns_deck(target_deck_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = target_deck_id
      AND d.user_id = public.get_app_user_id()
  )
$$;

CREATE OR REPLACE FUNCTION public.can_read_deck(target_deck_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.decks d
    WHERE d.id = target_deck_id
      AND (
        d.user_id = public.get_app_user_id()
        OR EXISTS (
          SELECT 1
          FROM public.group_decks gd
          JOIN public.group_members gm ON gm.group_id = gd.group_id
          WHERE gd.deck_id = d.id
            AND gm.user_id = public.get_app_user_id()
        )
      )
  )
$$;

GRANT EXECUTE ON FUNCTION public.owns_deck(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_deck(integer) TO authenticated;


-- ========== DECKS ==========

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS decks_select ON public.decks;
CREATE POLICY decks_select ON public.decks
  FOR SELECT USING (
    user_id = public.get_app_user_id()
    OR EXISTS (
      SELECT 1
      FROM public.group_decks gd
      JOIN public.group_members gm ON gm.group_id = gd.group_id
      WHERE gd.deck_id = public.decks.id
        AND gm.user_id = public.get_app_user_id()
    )
  );

DROP POLICY IF EXISTS decks_insert ON public.decks;
CREATE POLICY decks_insert ON public.decks
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS decks_update ON public.decks;
CREATE POLICY decks_update ON public.decks
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS decks_delete ON public.decks;
CREATE POLICY decks_delete ON public.decks
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_decks ON public.decks;
CREATE TRIGGER set_user_id_decks
  BEFORE INSERT ON public.decks
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== DECK_TAGS ==========

ALTER TABLE public.deck_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS deck_tags_select ON public.deck_tags;
CREATE POLICY deck_tags_select ON public.deck_tags
  FOR SELECT USING (public.can_read_deck(deck_id));

DROP POLICY IF EXISTS deck_tags_insert ON public.deck_tags;
CREATE POLICY deck_tags_insert ON public.deck_tags
  FOR INSERT WITH CHECK (public.owns_deck(deck_id));

DROP POLICY IF EXISTS deck_tags_delete ON public.deck_tags;
CREATE POLICY deck_tags_delete ON public.deck_tags
  FOR DELETE USING (public.owns_deck(deck_id));


-- ========== CARDS ==========

ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cards_select ON public.cards;
CREATE POLICY cards_select ON public.cards
  FOR SELECT USING (public.can_read_deck(deck_id));

DROP POLICY IF EXISTS cards_insert ON public.cards;
CREATE POLICY cards_insert ON public.cards
  FOR INSERT WITH CHECK (public.owns_deck(deck_id));

DROP POLICY IF EXISTS cards_update ON public.cards;
CREATE POLICY cards_update ON public.cards
  FOR UPDATE USING (public.owns_deck(deck_id));

DROP POLICY IF EXISTS cards_delete ON public.cards;
CREATE POLICY cards_delete ON public.cards
  FOR DELETE USING (public.owns_deck(deck_id));


-- ========== STUDY_SESSIONS ==========

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_sessions_select ON public.study_sessions;
CREATE POLICY study_sessions_select ON public.study_sessions
  FOR SELECT USING (public.can_read_deck(deck_id));

DROP POLICY IF EXISTS study_sessions_insert ON public.study_sessions;
CREATE POLICY study_sessions_insert ON public.study_sessions
  FOR INSERT WITH CHECK (public.owns_deck(deck_id));

DROP POLICY IF EXISTS study_sessions_update ON public.study_sessions;
CREATE POLICY study_sessions_update ON public.study_sessions
  FOR UPDATE USING (public.owns_deck(deck_id));

DROP POLICY IF EXISTS study_sessions_delete ON public.study_sessions;
CREATE POLICY study_sessions_delete ON public.study_sessions
  FOR DELETE USING (public.owns_deck(deck_id));


-- ========== MESSAGE HELPERS ==========

CREATE OR REPLACE FUNCTION public.dm_partner_allowed(partner_user_id integer)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = public.get_app_user_id()
      AND COALESCE(u.is_banned, FALSE) = FALSE
  )
  AND EXISTS (
    SELECT 1
    FROM public.users u
    WHERE u.id = partner_user_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_blocks ub
    WHERE (ub.blocker_id = public.get_app_user_id() AND ub.blocked_id = partner_user_id)
       OR (ub.blocker_id = partner_user_id AND ub.blocked_id = public.get_app_user_id())
  )
$$;

CREATE OR REPLACE FUNCTION public.mark_messages_read(other_user_id integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.messages
  SET is_read = 1
  WHERE sender_id = other_user_id
    AND receiver_id = public.get_app_user_id()
    AND is_read = 0
    AND public.dm_partner_allowed(other_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_partner_allowed(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(integer) TO authenticated;


-- ========== MESSAGES ==========

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS messages_select ON public.messages;
CREATE POLICY messages_select ON public.messages
  FOR SELECT USING (
    (sender_id = public.get_app_user_id() OR receiver_id = public.get_app_user_id())
    AND public.dm_partner_allowed(
      CASE
        WHEN sender_id = public.get_app_user_id() THEN receiver_id
        ELSE sender_id
      END
    )
  );

DROP POLICY IF EXISTS messages_insert ON public.messages;
CREATE POLICY messages_insert ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = public.get_app_user_id()
    AND public.dm_partner_allowed(receiver_id)
  );

DROP POLICY IF EXISTS messages_update ON public.messages;
CREATE POLICY messages_update ON public.messages
  FOR UPDATE USING (sender_id = public.get_app_user_id());

DROP POLICY IF EXISTS messages_delete ON public.messages;
CREATE POLICY messages_delete ON public.messages
  FOR DELETE USING (sender_id = public.get_app_user_id());

ALTER TABLE public.messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END;
$$;


-- ========== GLOBAL_MESSAGES ========== 

ALTER TABLE public.global_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS global_messages_select ON public.global_messages;
CREATE POLICY global_messages_select ON public.global_messages
  FOR SELECT USING (public.get_app_user_id() IS NOT NULL);


-- ========== USER_DISMISSED_MESSAGES ========== 

ALTER TABLE public.user_dismissed_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_dismissed_messages_select ON public.user_dismissed_messages;
CREATE POLICY user_dismissed_messages_select ON public.user_dismissed_messages
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS user_dismissed_messages_insert ON public.user_dismissed_messages;
CREATE POLICY user_dismissed_messages_insert ON public.user_dismissed_messages
  FOR INSERT WITH CHECK (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS user_dismissed_messages_delete ON public.user_dismissed_messages;
CREATE POLICY user_dismissed_messages_delete ON public.user_dismissed_messages
  FOR DELETE USING (user_id = public.get_app_user_id());
