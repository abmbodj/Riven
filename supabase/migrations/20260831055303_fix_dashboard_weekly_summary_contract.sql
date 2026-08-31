do $migration$
declare
  v_definition text;
begin
  select pg_catalog.pg_get_functiondef('public.get_dashboard_bootstrap(text)'::regprocedure)
  into v_definition;

  v_definition := pg_catalog.replace(
    v_definition,
$old$
    from public.study_sessions as s
    where s.user_id = v_user_id
$old$,
$new$
    from public.study_sessions as s
    join public.decks as session_deck on session_deck.id = s.deck_id
    where session_deck.user_id = v_user_id
$new$
  );

  v_definition := pg_catalog.replace(
    v_definition,
$old$
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
$old$,
$new$
  weekly_days as (
    select
      local_date,
      coalesce(pg_catalog.sum(cards_studied), 0)::integer as cards,
      coalesce(pg_catalog.sum(duration_seconds), 0)::integer as duration_seconds
    from weekly_sessions
    group by local_date
  ),
  daily_breakdown as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'date', day_value::date::text,
        'day', pg_catalog.to_char(day_value, 'Dy'),
        'cards', coalesce(day_totals.cards, 0),
        'minutes', pg_catalog.round(coalesce(day_totals.duration_seconds, 0)::numeric / 60, 0),
        'studied', coalesce(day_totals.cards, 0) > 0
          or coalesce(day_totals.duration_seconds, 0) > 0,
        'is_today', day_value::date = v_local_today
      )
      order by day_value
    ), '[]'::jsonb) as value
    from pg_catalog.generate_series(v_week_start, v_week_start + 6, interval '1 day') as days(day_value)
    left join weekly_days as day_totals on day_totals.local_date = day_value::date
  ),
$new$
  );

  v_definition := pg_catalog.replace(
    v_definition,
    'pg_catalog.round((totals.cards_correct::numeric / totals.cards_studied::numeric) * 100, 0)',
    'pg_catalog.round(totals.cards_correct::numeric / totals.cards_studied::numeric, 4)'
  );

  if pg_catalog.strpos(v_definition, 'join public.decks as session_deck on session_deck.id = s.deck_id') = 0
    or pg_catalog.strpos(v_definition, '''cards'', coalesce(day_totals.cards, 0)') = 0
    or pg_catalog.strpos(v_definition, 'pg_catalog.round(totals.cards_correct::numeric / totals.cards_studied::numeric, 4)') = 0 then
    raise exception 'could not apply the dashboard weekly-summary contract correction';
  end if;

  execute v_definition;
end;
$migration$;

comment on function public.get_dashboard_bootstrap(text) is
  'Returns the authenticated user dashboard snapshot without note, guide, card, or exam body content.';

revoke all on function public.get_dashboard_bootstrap(text) from public;
revoke all on function public.get_dashboard_bootstrap(text) from anon;
grant execute on function public.get_dashboard_bootstrap(text) to authenticated;
