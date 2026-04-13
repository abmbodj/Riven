-- =============================================================
-- Study Group Scheduling Hub
-- Optional schedule sharing + scheduled meetups (separate from cram)
-- =============================================================

-- ========== HELPERS ==========

CREATE OR REPLACE FUNCTION public.is_group_admin(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = public.get_app_user_id()
      AND gm.role = 'admin'
  );
$$;

-- ========== TABLES ==========

CREATE TABLE IF NOT EXISTS public.group_schedule_shares (
  group_id         uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id          integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  visibility_mode  text NOT NULL DEFAULT 'busy_free' CHECK (visibility_mode IN ('hidden', 'busy_free', 'full')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.group_meetups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id        uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  created_by      integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  topic           text NOT NULL,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  timezone        text NOT NULL DEFAULT 'UTC',
  location_label  text,
  location_url    text,
  status          text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT group_meetups_topic_length CHECK (char_length(btrim(topic)) >= 2),
  CONSTRAINT group_meetups_valid_range CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS public.group_meetup_attendees (
  meetup_id    uuid NOT NULL REFERENCES public.group_meetups(id) ON DELETE CASCADE,
  group_id     uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id      integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (meetup_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_schedule_shares_group_id
  ON public.group_schedule_shares(group_id);

CREATE INDEX IF NOT EXISTS idx_group_meetups_group_start
  ON public.group_meetups(group_id, start_at);

CREATE INDEX IF NOT EXISTS idx_group_meetups_status_start
  ON public.group_meetups(status, start_at);

CREATE INDEX IF NOT EXISTS idx_group_meetup_attendees_group_user
  ON public.group_meetup_attendees(group_id, user_id);

CREATE INDEX IF NOT EXISTS idx_group_meetup_attendees_user_created
  ON public.group_meetup_attendees(user_id, created_at);

CREATE OR REPLACE FUNCTION public.set_group_meetup_attendee_defaults()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  meetup_group_id uuid;
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id = public.get_app_user_id();
  END IF;

  SELECT m.group_id
  INTO meetup_group_id
  FROM public.group_meetups m
  WHERE m.id = NEW.meetup_id;

  IF meetup_group_id IS NULL THEN
    RAISE EXCEPTION 'Meetup not found';
  END IF;

  NEW.group_id = meetup_group_id;
  RETURN NEW;
END;
$$;

-- ========== TRIGGERS ==========

DROP TRIGGER IF EXISTS set_user_id_group_schedule_shares ON public.group_schedule_shares;
CREATE TRIGGER set_user_id_group_schedule_shares
  BEFORE INSERT ON public.group_schedule_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_updated_at_group_schedule_shares ON public.group_schedule_shares;
CREATE TRIGGER set_updated_at_group_schedule_shares
  BEFORE UPDATE ON public.group_schedule_shares
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_group_meetups ON public.group_meetups;
CREATE TRIGGER set_updated_at_group_meetups
  BEFORE UPDATE ON public.group_meetups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_defaults_group_meetup_attendees ON public.group_meetup_attendees;
CREATE TRIGGER set_defaults_group_meetup_attendees
  BEFORE INSERT ON public.group_meetup_attendees
  FOR EACH ROW EXECUTE FUNCTION public.set_group_meetup_attendee_defaults();

-- ========== RLS ==========

ALTER TABLE public.group_schedule_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_meetups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_meetup_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_schedule_shares_select ON public.group_schedule_shares;
CREATE POLICY group_schedule_shares_select ON public.group_schedule_shares
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_schedule_shares_insert ON public.group_schedule_shares;
CREATE POLICY group_schedule_shares_insert ON public.group_schedule_shares
  FOR INSERT WITH CHECK (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS group_schedule_shares_update ON public.group_schedule_shares;
CREATE POLICY group_schedule_shares_update ON public.group_schedule_shares
  FOR UPDATE USING (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  )
  WITH CHECK (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS group_schedule_shares_delete ON public.group_schedule_shares;
CREATE POLICY group_schedule_shares_delete ON public.group_schedule_shares
  FOR DELETE USING (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS group_meetups_select ON public.group_meetups;
CREATE POLICY group_meetups_select ON public.group_meetups
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_meetups_insert ON public.group_meetups;
CREATE POLICY group_meetups_insert ON public.group_meetups
  FOR INSERT WITH CHECK (
    public.is_group_member(group_id)
    AND created_by = public.get_app_user_id()
  );

DROP POLICY IF EXISTS group_meetups_update ON public.group_meetups;
CREATE POLICY group_meetups_update ON public.group_meetups
  FOR UPDATE USING (
    public.is_group_member(group_id)
    AND (
      created_by = public.get_app_user_id()
      OR public.is_group_admin(group_id)
    )
  )
  WITH CHECK (
    public.is_group_member(group_id)
    AND (
      created_by = public.get_app_user_id()
      OR public.is_group_admin(group_id)
    )
  );

DROP POLICY IF EXISTS group_meetups_delete ON public.group_meetups;
CREATE POLICY group_meetups_delete ON public.group_meetups
  FOR DELETE USING (
    public.is_group_member(group_id)
    AND (
      created_by = public.get_app_user_id()
      OR public.is_group_admin(group_id)
    )
  );

DROP POLICY IF EXISTS group_meetup_attendees_select ON public.group_meetup_attendees;
CREATE POLICY group_meetup_attendees_select ON public.group_meetup_attendees
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_meetup_attendees_insert ON public.group_meetup_attendees;
CREATE POLICY group_meetup_attendees_insert ON public.group_meetup_attendees
  FOR INSERT WITH CHECK (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS group_meetup_attendees_delete ON public.group_meetup_attendees;
CREATE POLICY group_meetup_attendees_delete ON public.group_meetup_attendees
  FOR DELETE USING (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  );

-- ========== RPCS ==========

CREATE OR REPLACE FUNCTION public.get_group_schedule_calendar(
  target_group_id uuid,
  range_start date DEFAULT CURRENT_DATE,
  range_end date DEFAULT (CURRENT_DATE + 6)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  safe_range_start date := COALESCE(range_start, CURRENT_DATE);
  safe_range_end date := COALESCE(range_end, COALESCE(range_start, CURRENT_DATE) + 6);
  payload jsonb;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT public.is_group_member(target_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  SELECT jsonb_build_object(
    'range_start', safe_range_start,
    'range_end', safe_range_end,
    'my_share_mode', (
      SELECT gss.visibility_mode
      FROM public.group_schedule_shares gss
      WHERE gss.group_id = target_group_id
        AND gss.user_id = current_user_id
    ),
    'members', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'username', u.username,
          'display_name', u.display_name,
          'avatar', u.avatar,
          'role', gm.role,
          'share_mode', COALESCE(gss.visibility_mode, 'hidden')
        )
        ORDER BY
          CASE WHEN gm.user_id = current_user_id THEN 0 ELSE 1 END,
          CASE WHEN gm.role = 'admin' THEN 0 ELSE 1 END,
          gm.joined_at ASC
      )
      FROM public.group_members gm
      JOIN public.users u
        ON u.id = gm.user_id
      LEFT JOIN public.group_schedule_shares gss
        ON gss.group_id = gm.group_id
       AND gss.user_id = gm.user_id
      WHERE gm.group_id = target_group_id
    ), '[]'::jsonb),
    'schedule_slots', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', s.id,
          'user_id', s.user_id,
          'member_name', COALESCE(NULLIF(u.display_name, ''), u.username),
          'member_avatar', u.avatar,
          'day_of_week', s.day_of_week,
          'start_time', to_char(s.start_time, 'HH24:MI'),
          'end_time', to_char(s.end_time, 'HH24:MI'),
          'visibility_mode', gss.visibility_mode,
          'class_name', CASE WHEN gss.visibility_mode = 'full' THEN c.name ELSE NULL END
        )
        ORDER BY s.day_of_week ASC, s.start_time ASC
      )
      FROM public.schedule_slots s
      JOIN public.users u
        ON u.id = s.user_id
      JOIN public.group_members gm
        ON gm.group_id = target_group_id
       AND gm.user_id = s.user_id
      JOIN public.group_schedule_shares gss
        ON gss.group_id = gm.group_id
       AND gss.user_id = gm.user_id
      LEFT JOIN public.classes c
        ON c.id = s.class_id
      WHERE gss.visibility_mode <> 'hidden'
    ), '[]'::jsonb),
    'meetups', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', m.id,
          'group_id', m.group_id,
          'created_by', m.created_by,
          'created_by_name', COALESCE(NULLIF(creator.display_name, ''), creator.username),
          'topic', m.topic,
          'start_at', m.start_at,
          'end_at', m.end_at,
          'timezone', m.timezone,
          'location_label', m.location_label,
          'location_url', m.location_url,
          'status', m.status,
          'created_at', m.created_at,
          'updated_at', m.updated_at,
          'attendee_count', COALESCE(attendee_stats.attendee_count, 0),
          'attendee_ids', COALESCE(attendee_ids.attendee_ids, '[]'::jsonb),
          'is_joined', EXISTS (
            SELECT 1
            FROM public.group_meetup_attendees current_attendee
            WHERE current_attendee.meetup_id = m.id
              AND current_attendee.user_id = current_user_id
          ),
          'is_creator', m.created_by = current_user_id,
          'attendees', COALESCE(attendee_preview.attendees, '[]'::jsonb)
        )
        ORDER BY m.start_at ASC
      )
      FROM public.group_meetups m
      JOIN public.users creator
        ON creator.id = m.created_by
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::integer AS attendee_count
        FROM public.group_meetup_attendees a
        WHERE a.meetup_id = m.id
      ) attendee_stats ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(attendee.user_id ORDER BY attendee.created_at ASC), '[]'::jsonb) AS attendee_ids
        FROM public.group_meetup_attendees attendee
        WHERE attendee.meetup_id = m.id
      ) attendee_ids ON true
      LEFT JOIN LATERAL (
        SELECT COALESCE(
          jsonb_agg(
            jsonb_build_object(
              'id', preview_user.id,
              'username', preview_user.username,
              'display_name', preview_user.display_name,
              'avatar', preview_user.avatar
            )
            ORDER BY preview_rows.created_at ASC
          ),
          '[]'::jsonb
        ) AS attendees
        FROM (
          SELECT attendee.user_id, attendee.created_at
          FROM public.group_meetup_attendees attendee
          WHERE attendee.meetup_id = m.id
          ORDER BY attendee.created_at ASC
          LIMIT 6
        ) preview_rows
        JOIN public.users preview_user
          ON preview_user.id = preview_rows.user_id
      ) attendee_preview ON true
      WHERE m.group_id = target_group_id
        AND m.start_at < ((safe_range_end + 1)::timestamptz)
        AND m.end_at >= (safe_range_start::timestamptz)
    ), '[]'::jsonb)
  )
  INTO payload;

  RETURN payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_group_meetup(
  target_group_id uuid,
  target_topic text,
  target_start_at timestamptz,
  target_end_at timestamptz,
  target_timezone text DEFAULT 'UTC',
  target_location_label text DEFAULT NULL,
  target_location_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  created_record public.group_meetups%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  IF NOT public.is_group_member(target_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  IF target_start_at IS NULL OR target_end_at IS NULL OR target_end_at <= target_start_at THEN
    RAISE EXCEPTION 'Invalid meetup time range';
  END IF;

  IF char_length(btrim(COALESCE(target_topic, ''))) < 2 THEN
    RAISE EXCEPTION 'Topic is required';
  END IF;

  INSERT INTO public.group_meetups (
    group_id,
    created_by,
    topic,
    start_at,
    end_at,
    timezone,
    location_label,
    location_url
  )
  VALUES (
    target_group_id,
    current_user_id,
    btrim(target_topic),
    target_start_at,
    target_end_at,
    COALESCE(NULLIF(btrim(target_timezone), ''), 'UTC'),
    NULLIF(btrim(COALESCE(target_location_label, '')), ''),
    NULLIF(btrim(COALESCE(target_location_url, '')), '')
  )
  RETURNING *
  INTO created_record;

  INSERT INTO public.group_meetup_attendees (meetup_id, group_id, user_id)
  VALUES (created_record.id, created_record.group_id, current_user_id)
  ON CONFLICT (meetup_id, user_id) DO NOTHING;

  RETURN to_jsonb(created_record);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_group_meetup(target_meetup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  meetup_group_id uuid;
  meetup_status text;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT m.group_id, m.status
  INTO meetup_group_id, meetup_status
  FROM public.group_meetups m
  WHERE m.id = target_meetup_id;

  IF meetup_group_id IS NULL THEN
    RAISE EXCEPTION 'Meetup not found';
  END IF;

  IF NOT public.is_group_member(meetup_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  IF meetup_status <> 'scheduled' THEN
    RAISE EXCEPTION 'Meetup is no longer active';
  END IF;

  INSERT INTO public.group_meetup_attendees (meetup_id, group_id, user_id)
  VALUES (target_meetup_id, meetup_group_id, current_user_id)
  ON CONFLICT (meetup_id, user_id) DO NOTHING;

  RETURN jsonb_build_object('meetup_id', target_meetup_id, 'status', 'joined');
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_group_meetup(target_meetup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  meetup_group_id uuid;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT m.group_id
  INTO meetup_group_id
  FROM public.group_meetups m
  WHERE m.id = target_meetup_id;

  IF meetup_group_id IS NULL THEN
    RAISE EXCEPTION 'Meetup not found';
  END IF;

  IF NOT public.is_group_member(meetup_group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  DELETE FROM public.group_meetup_attendees
  WHERE meetup_id = target_meetup_id
    AND user_id = current_user_id;

  RETURN jsonb_build_object('meetup_id', target_meetup_id, 'status', 'left');
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_group_meetup(target_meetup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  meetup_record public.group_meetups%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Must be logged in';
  END IF;

  SELECT *
  INTO meetup_record
  FROM public.group_meetups m
  WHERE m.id = target_meetup_id;

  IF meetup_record.id IS NULL THEN
    RAISE EXCEPTION 'Meetup not found';
  END IF;

  IF NOT public.is_group_member(meetup_record.group_id) THEN
    RAISE EXCEPTION 'Not a member of this group';
  END IF;

  IF meetup_record.created_by <> current_user_id
     AND NOT public.is_group_admin(meetup_record.group_id) THEN
    RAISE EXCEPTION 'Not allowed to cancel this meetup';
  END IF;

  UPDATE public.group_meetups
  SET status = 'cancelled'
  WHERE id = target_meetup_id;

  RETURN jsonb_build_object('meetup_id', target_meetup_id, 'status', 'cancelled');
END;
$$;

CREATE OR REPLACE FUNCTION public.list_joined_group_meetups(
  range_start timestamptz DEFAULT NULL,
  range_end timestamptz DEFAULT NULL
)
RETURNS TABLE (
  meetup_id uuid,
  group_id uuid,
  group_name text,
  topic text,
  start_at timestamptz,
  end_at timestamptz,
  timezone text,
  location_label text,
  location_url text,
  status text
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
    m.id AS meetup_id,
    m.group_id,
    g.name AS group_name,
    m.topic,
    m.start_at,
    m.end_at,
    m.timezone,
    m.location_label,
    m.location_url,
    m.status
  FROM public.group_meetup_attendees attendee
  JOIN public.group_meetups m
    ON m.id = attendee.meetup_id
  JOIN public.study_groups g
    ON g.id = m.group_id
  WHERE attendee.user_id = current_user_id
    AND m.status = 'scheduled'
    AND (range_start IS NULL OR m.end_at >= range_start)
    AND (range_end IS NULL OR m.start_at <= range_end)
  ORDER BY m.start_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_group_schedule_calendar(uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group_meetup(uuid, text, timestamptz, timestamptz, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_group_meetup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.leave_group_meetup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_group_meetup(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_joined_group_meetups(timestamptz, timestamptz) TO authenticated;

-- ========== REALTIME ==========

ALTER TABLE public.group_meetups REPLICA IDENTITY FULL;
ALTER TABLE public.group_meetup_attendees REPLICA IDENTITY FULL;

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
      AND tablename = 'group_meetups'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_meetups;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_meetup_attendees'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_meetup_attendees;
  END IF;
END;
$$;
