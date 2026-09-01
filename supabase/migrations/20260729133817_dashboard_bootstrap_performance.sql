create or replace function public.get_dashboard_bootstrap(p_time_zone text default 'UTC')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $function$
declare
  v_auth_uid uuid := auth.uid();
  v_user_id integer;
  v_time_zone text := coalesce(nullif(trim(p_time_zone), ''), 'UTC');
  v_local_today date;
  v_week_start date;
  v_result jsonb;
begin
  if v_auth_uid is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names
    where name = v_time_zone
  ) then
    v_time_zone := 'UTC';
  end if;

  select u.id
  into v_user_id
  from public.users as u
  where u.supabase_auth_id = v_auth_uid
  limit 1;

  if v_user_id is null then
    return jsonb_build_object(
      'version', 1,
      'generatedAt', pg_catalog.to_char(pg_catalog.now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
      'assignments', '[]'::jsonb,
      'classes', '[]'::jsonb,
      'counts', jsonb_build_object('decks', 0, 'notes', 0, 'guides', 0, 'exams', 0),
      'archivedClassCount', 0,
      'recentDecks', '[]'::jsonb,
      'recentStudyItems', '[]'::jsonb,
      'weeklySummary', jsonb_build_object(
        'cards_studied', 0,
        'accuracy', null,
        'total_minutes', 0,
        'daily_breakdown', '[]'::jsonb
      ),
      'streakSummary', jsonb_build_object(
        'currentStreak', 0,
        'longestStreak', 0,
        'lastStudyDate', null
      )
    );
  end if;

  v_local_today := (pg_catalog.now() at time zone v_time_zone)::date;
  v_week_start := v_local_today - extract(dow from v_local_today)::integer;

  with
  active_classes as (
    select c.id, c.name, c.color, c.subject, c.professor, c.created_at
    from public.classes as c
    where c.user_id = v_user_id
      and coalesce(c.is_archived, false) = false
  ),
  active_assignments as (
    select
      a.id,
      a.class_id,
      a.title,
      a.status,
      a.due_date,
      coalesce(a.assignment_type, a.type) as type,
      a.created_at
    from public.assignments as a
    where a.user_id = v_user_id
      and coalesce(a.status, '') <> 'Archived'
      and a.class_cleanup_archived_at is null
      and (
        a.class_id is null
        or exists (select 1 from active_classes as c where c.id = a.class_id)
      )
    order by a.due_date asc nulls last, a.created_at desc
  ),
  recent_decks as (
    select
      d.id,
      d.title,
      d.class_id,
      d.created_at,
      d.last_studied,
      (
        select pg_catalog.count(*)::integer
        from public.cards as card
        where card.deck_id = d.id
      ) as card_count,
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', t.id, 'name', t.name, 'color', t.color)
          order by t.name
        )
        from public.deck_tags as dt
        join public.tags as t on t.id = dt.tag_id
        where dt.deck_id = d.id
          and t.user_id = v_user_id
      ), '[]'::jsonb) as tags
    from public.decks as d
    where d.user_id = v_user_id
    order by d.created_at desc
    limit 4
  ),
  recent_items as (
    select
      d.id::text as id,
      d.title,
      d.class_id,
      'flashcard'::text as item_type,
      coalesce(d.last_studied, d.created_at) as activity_at,
      (
        select pg_catalog.count(*)::integer
        from public.cards as card
        where card.deck_id = d.id
      ) as card_count
    from public.decks as d
    where d.user_id = v_user_id

    union all

    select n.id::text, n.title, n.class_id, 'note', coalesce(n.updated_at, n.created_at)::timestamp, null::integer
    from public.notes as n
    where n.user_id = v_user_id

    union all

    select g.id::text, g.title, g.class_id, 'guide', coalesce(g.updated_at, g.created_at)::timestamp, null::integer
    from public.study_guides as g
    where g.user_id = v_user_id

    union all

    select e.id::text, e.title, e.class_id, 'exam', e.created_at::timestamp, null::integer
    from public.mock_exams as e
    where e.user_id = v_user_id
  ),
  weekly_sessions as (
    select
      coalesce(s.cards_studied, 0)::integer as cards_studied,
      coalesce(s.cards_correct, 0)::integer as cards_correct,
      coalesce(s.duration_seconds, 0)::integer as duration_seconds,
      (
        coalesce(s.started_at, s.created_at at time zone 'UTC')
        at time zone v_time_zone
      )::date as local_date
    from public.study_sessions as s
    where s.user_id = v_user_id
      and (
        coalesce(s.started_at, s.created_at at time zone 'UTC')
        at time zone v_time_zone
      )::date between v_week_start and (v_week_start + 6)
  ),
  weekly_totals as (
    select
      coalesce(pg_catalog.sum(cards_studied), 0)::integer as cards_studied,
      coalesce(pg_catalog.sum(cards_correct), 0)::integer as cards_correct,
      coalesce(pg_catalog.sum(duration_seconds), 0)::integer as duration_seconds
    from weekly_sessions
  ),
  daily_breakdown as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', day_value::text,
        'day', pg_catalog.to_char(day_value, 'Dy'),
        'studied', exists (
          select 1
          from weekly_sessions as ws
          where ws.local_date = day_value
            and ws.cards_studied > 0
        ),
        'is_today', day_value = v_local_today
      )
      order by day_value
    ), '[]'::jsonb) as value
    from pg_catalog.generate_series(v_week_start, v_week_start + 6, interval '1 day') as days(day_value)
  ),
  user_streak as (
    select case
      when coalesce(u.streak_data, '') ~ '^\s*\{' then u.streak_data::jsonb
      else '{}'::jsonb
    end as value
    from public.users as u
    where u.id = v_user_id
  )
  select jsonb_build_object(
    'version', 1,
    'generatedAt', pg_catalog.to_char(pg_catalog.now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'assignments', coalesce((
      select jsonb_agg(pg_catalog.to_jsonb(a) order by a.due_date asc nulls last, a.created_at desc)
      from active_assignments as a
    ), '[]'::jsonb),
    'classes', coalesce((
      select jsonb_agg(pg_catalog.to_jsonb(c) order by c.created_at desc)
      from active_classes as c
    ), '[]'::jsonb),
    'counts', jsonb_build_object(
      'decks', (select pg_catalog.count(*) from public.decks as d where d.user_id = v_user_id),
      'notes', (select pg_catalog.count(*) from public.notes as n where n.user_id = v_user_id),
      'guides', (select pg_catalog.count(*) from public.study_guides as g where g.user_id = v_user_id),
      'exams', (select pg_catalog.count(*) from public.mock_exams as e where e.user_id = v_user_id)
    ),
    'archivedClassCount', (
      select pg_catalog.count(*)
      from public.classes as c
      where c.user_id = v_user_id
        and coalesce(c.is_archived, false) = true
    ),
    'recentDecks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', d.id,
          'title', d.title,
          'class_id', d.class_id,
          'created_at', d.created_at,
          'last_studied', d.last_studied,
          'cardCount', d.card_count,
          'tags', d.tags
        )
        order by d.created_at desc
      )
      from recent_decks as d
    ), '[]'::jsonb),
    'recentStudyItems', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.id,
          'title', item.title,
          'class_id', item.class_id,
          'type', item.item_type,
          'activityAt', item.activity_at,
          'cardCount', item.card_count
        )
        order by item.activity_at desc
      )
      from (
        select *
        from recent_items
        order by activity_at desc
        limit 4
      ) as item
    ), '[]'::jsonb),
    'weeklySummary', (
      select jsonb_build_object(
        'cards_studied', totals.cards_studied,
        'accuracy', case
          when totals.cards_studied > 0
            then pg_catalog.round((totals.cards_correct::numeric / totals.cards_studied::numeric) * 100, 0)
          else null
        end,
        'total_minutes', pg_catalog.round(totals.duration_seconds::numeric / 60, 0),
        'daily_breakdown', daily.value
      )
      from weekly_totals as totals
      cross join daily_breakdown as daily
    ),
    'streakSummary', (
      select jsonb_build_object(
        'currentStreak', case
          when streak.value ->> 'currentStreak' ~ '^[0-9]+$'
            then (streak.value ->> 'currentStreak')::integer
          else 0
        end,
        'longestStreak', case
          when streak.value ->> 'longestStreak' ~ '^[0-9]+$'
            then (streak.value ->> 'longestStreak')::integer
          else 0
        end,
        'lastStudyDate', streak.value ->> 'lastStudyDate'
      )
      from user_streak as streak
    )
  )
  into v_result;

  return v_result;
end;
$function$;

comment on function public.get_dashboard_bootstrap(text) is
  'Returns the authenticated user dashboard snapshot without note, guide, card, or exam body content.';

revoke all on function public.get_dashboard_bootstrap(text) from public;
revoke all on function public.get_dashboard_bootstrap(text) from anon;
grant execute on function public.get_dashboard_bootstrap(text) to authenticated;
