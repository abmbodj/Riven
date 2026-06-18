-- =============================================================
-- Study Group Availability Heatmap
-- Per-group, recurring "typical week" free-time painting (When2Meet style)
-- that powers the coordination-first group calendar redesign. Also adds
-- in-app + push notifications when sessions are proposed or cancelled.
-- =============================================================

-- ========== TABLE ==========

-- One row per free hour-cell a member paints for a group. Recurring weekly:
-- day_of_week (0=Sun..6=Sat) + hour (0..23). A painted cell means "I'm free for
-- this group then." Class times are pre-blocked client-side and never painted.
CREATE TABLE IF NOT EXISTS public.group_member_availability (
  group_id     uuid NOT NULL REFERENCES public.study_groups(id) ON DELETE CASCADE,
  user_id      integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_of_week  smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  hour         smallint NOT NULL CHECK (hour BETWEEN 0 AND 23),
  created_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id, day_of_week, hour)
);

CREATE INDEX IF NOT EXISTS idx_group_member_availability_group
  ON public.group_member_availability(group_id);

-- ========== TRIGGERS ==========

DROP TRIGGER IF EXISTS set_user_id_group_member_availability ON public.group_member_availability;
CREATE TRIGGER set_user_id_group_member_availability
  BEFORE INSERT ON public.group_member_availability
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

-- ========== RLS ==========

ALTER TABLE public.group_member_availability ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_member_availability_select ON public.group_member_availability;
CREATE POLICY group_member_availability_select ON public.group_member_availability
  FOR SELECT USING (public.is_group_member(group_id));

-- Members may only write their OWN availability rows. Never widen this to let a
-- member paint on behalf of someone else.
DROP POLICY IF EXISTS group_member_availability_insert ON public.group_member_availability;
CREATE POLICY group_member_availability_insert ON public.group_member_availability
  FOR INSERT WITH CHECK (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS group_member_availability_delete ON public.group_member_availability;
CREATE POLICY group_member_availability_delete ON public.group_member_availability
  FOR DELETE USING (
    public.is_group_member(group_id)
    AND user_id = public.get_app_user_id()
  );

-- ========== RPCS ==========

-- Replace-set the caller's painted availability for a group in one shot.
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

  RETURN jsonb_build_object('group_id', target_group_id, 'cell_count', cell_count);
END;
$$;

-- Push enqueue: mirror enqueue_message_push_dispatch — read vault secrets and
-- fire-and-forget to the existing push-dispatch edge function. Never blocks the
-- calling transaction.
CREATE OR REPLACE FUNCTION public.enqueue_group_meetup_push_dispatch(
  target_meetup_id uuid,
  event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  project_url text;
  push_secret text;
BEGIN
  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('PROJECT_URL', 'project_url')
  ORDER BY CASE WHEN name = 'PROJECT_URL' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT decrypted_secret
  INTO push_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('PUSH_DISPATCH_SECRET', 'push_dispatch_secret')
  ORDER BY CASE WHEN name = 'PUSH_DISPATCH_SECRET' THEN 0 ELSE 1 END
  LIMIT 1;

  IF project_url IS NULL OR push_secret IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || push_secret
    ),
    body := jsonb_build_object(
      'action', 'group_meetup_event',
      'meetupId', target_meetup_id,
      'eventType', event_type
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'enqueue_group_meetup_push_dispatch failed for meetup %: %', target_meetup_id, SQLERRM;
END;
$$;

-- Notify every other group member in-app, then fire push. Centralised so create
-- and cancel share one code path.
CREATE OR REPLACE FUNCTION public.notify_group_meetup_event(
  target_meetup_id uuid,
  event_type text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  meetup_record public.group_meetups%ROWTYPE;
  actor_id integer := public.get_app_user_id();
  actor_name text;
  notif_title text;
  notif_body text;
BEGIN
  SELECT * INTO meetup_record FROM public.group_meetups WHERE id = target_meetup_id;
  IF meetup_record.id IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(NULLIF(u.display_name, ''), u.username)
  INTO actor_name
  FROM public.users u
  WHERE u.id = actor_id;

  IF event_type = 'cancelled' THEN
    notif_title := 'Session cancelled';
    notif_body := COALESCE(actor_name, 'Someone') || ' cancelled "' || meetup_record.topic || '"';
  ELSE
    notif_title := 'New study session';
    notif_body := COALESCE(actor_name, 'Someone') || ' proposed "' || meetup_record.topic || '"';
  END IF;

  INSERT INTO public.user_notifications (user_id, kind, title, content, metadata)
  SELECT
    gm.user_id,
    'group_meetup_' || event_type,
    notif_title,
    notif_body,
    jsonb_build_object(
      'group_id', meetup_record.group_id,
      'meetup_id', meetup_record.id,
      'start_at', meetup_record.start_at,
      'end_at', meetup_record.end_at,
      'is_free', EXISTS (
        SELECT 1
        FROM public.group_member_availability gma
        WHERE gma.group_id = meetup_record.group_id
          AND gma.user_id = gm.user_id
          AND gma.day_of_week = EXTRACT(DOW FROM meetup_record.start_at)::smallint
          AND gma.hour = EXTRACT(HOUR FROM meetup_record.start_at)::smallint
      )
    )
  FROM public.group_members gm
  WHERE gm.group_id = meetup_record.group_id
    AND gm.user_id <> actor_id;

  PERFORM public.enqueue_group_meetup_push_dispatch(target_meetup_id, event_type);
END;
$$;

-- Re-create create_group_meetup with notification side-effect appended.
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
SET search_path = public, pg_temp
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

  PERFORM public.notify_group_meetup_event(created_record.id, 'proposed');

  RETURN to_jsonb(created_record);
END;
$$;

-- Re-create cancel_group_meetup with notification side-effect appended.
CREATE OR REPLACE FUNCTION public.cancel_group_meetup(target_meetup_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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

  PERFORM public.notify_group_meetup_event(target_meetup_id, 'cancelled');

  RETURN jsonb_build_object('meetup_id', target_meetup_id, 'status', 'cancelled');
END;
$$;

-- Re-create the calendar RPC with painted availability appended. Adds:
--   'availability'    — every non-hidden member's free cells (drives the heatmap)
--   'my_availability' — the caller's own free cells (seeds the paint grid)
-- All previously-returned keys are preserved unchanged.
CREATE OR REPLACE FUNCTION public.get_group_schedule_calendar(
  target_group_id uuid,
  range_start date DEFAULT CURRENT_DATE,
  range_end date DEFAULT (CURRENT_DATE + 6)
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
          'class_name', CASE WHEN gss.visibility_mode = 'full' THEN c.name ELSE NULL END,
          'class_is_archived', COALESCE(c.is_archived, FALSE)
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
        AND COALESCE(c.is_archived, FALSE) = FALSE
    ), '[]'::jsonb),
    'availability', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'user_id', a.user_id,
          'day_of_week', a.day_of_week,
          'hour', a.hour
        )
      )
      FROM public.group_member_availability a
      JOIN public.group_members gm
        ON gm.group_id = a.group_id
       AND gm.user_id = a.user_id
      LEFT JOIN public.group_schedule_shares gss
        ON gss.group_id = a.group_id
       AND gss.user_id = a.user_id
      WHERE a.group_id = target_group_id
        AND COALESCE(gss.visibility_mode, 'hidden') <> 'hidden'
    ), '[]'::jsonb),
    'my_availability', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'day_of_week', a.day_of_week,
          'hour', a.hour
        )
      )
      FROM public.group_member_availability a
      WHERE a.group_id = target_group_id
        AND a.user_id = current_user_id
    ), '[]'::jsonb),
    -- The caller's own (non-archived) class times — used client-side to lock
    -- class hours in the availability paint grid, regardless of share mode.
    'my_schedule_slots', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'day_of_week', s.day_of_week,
          'start_time', to_char(s.start_time, 'HH24:MI'),
          'end_time', to_char(s.end_time, 'HH24:MI')
        )
        ORDER BY s.day_of_week ASC, s.start_time ASC
      )
      FROM public.schedule_slots s
      LEFT JOIN public.classes c
        ON c.id = s.class_id
      WHERE s.user_id = current_user_id
        AND COALESCE(c.is_archived, FALSE) = FALSE
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

GRANT EXECUTE ON FUNCTION public.set_group_availability(uuid, jsonb) TO authenticated;

-- ========== REALTIME ==========

ALTER TABLE public.group_member_availability REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_member_availability'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.group_member_availability;
  END IF;
END;
$$;
