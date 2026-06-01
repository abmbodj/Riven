-- Caps the schedule calendar query range to 180 days (6 months) to prevent
-- abuse with very large date windows that could cause slow DB queries.
-- This is a backward-compatible CREATE OR REPLACE on the existing function.

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
  safe_range_end date := LEAST(
    COALESCE(range_end, COALESCE(range_start, CURRENT_DATE) + 6),
    COALESCE(range_start, CURRENT_DATE) + 180
  );
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

GRANT EXECUTE ON FUNCTION public.get_group_schedule_calendar(uuid, date, date) TO authenticated;
