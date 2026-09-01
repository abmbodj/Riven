begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);

select extensions.ok(
  not pg_catalog.has_function_privilege('anon', 'public.get_dashboard_bootstrap(text)', 'execute'),
  'anonymous callers cannot execute get_dashboard_bootstrap'
);
select extensions.ok(
  pg_catalog.has_function_privilege('authenticated', 'public.get_dashboard_bootstrap(text)', 'execute'),
  'authenticated callers can execute get_dashboard_bootstrap'
);

insert into public.users (username, email, password, supabase_auth_id)
values
  ('dashboard_test_a', 'dashboard-a@example.test', 'not-a-real-password', '10000000-0000-0000-0000-000000000001'),
  ('dashboard_test_b', 'dashboard-b@example.test', 'not-a-real-password', '10000000-0000-0000-0000-000000000002');

insert into public.classes (user_id, name, color)
select id, 'Current user class', '#deb96a'
from public.users
where username = 'dashboard_test_a';

insert into public.assignments (user_id, class_id, title, description, status, due_date)
select u.id, c.id, 'Current user assignment', 'private assignment body', 'Pending', current_date + 1
from public.users as u
join public.classes as c on c.user_id = u.id
where u.username = 'dashboard_test_a';

insert into public.assignments (user_id, title, description, status, due_date)
select id, 'Other user assignment', 'must never be returned', 'Pending', current_date + 1
from public.users
where username = 'dashboard_test_b';

insert into public.notes (user_id, title, content, enhanced_content)
select id, 'Current user note', '{"private":"note body"}', '{"private":"enhanced body"}'
from public.users
where username = 'dashboard_test_a';

insert into public.mock_exams (user_id, title, questions)
select id, 'Current user exam', '[{"private":"question body"}]'
from public.users
where username = 'dashboard_test_a';

insert into public.decks (user_id, title)
select id, 'Timezone test deck'
from public.users
where username = 'dashboard_test_a';

insert into public.study_sessions (
  deck_id,
  cards_studied,
  cards_correct,
  duration_seconds,
  created_at
)
select
  d.id,
  3,
  2,
  180,
  (current_date - extract(dow from current_date)::integer)::timestamp + interval '9 hours 30 minutes'
from public.users as u
join public.decks as d on d.user_id = u.id
where u.username = 'dashboard_test_a';

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000001',
  true
);
set local role authenticated;

create temporary table dashboard_test_snapshots as
select
  public.get_dashboard_bootstrap('UTC') as snapshot,
  public.get_dashboard_bootstrap('Pacific/Honolulu') as honolulu_snapshot;

select extensions.is(snapshot ->> 'version', '1', 'snapshot version is 1')
from dashboard_test_snapshots;
select extensions.is(
  jsonb_array_length(snapshot -> 'assignments'),
  1,
  'snapshot contains only the current user assignment'
)
from dashboard_test_snapshots;
select extensions.ok(
  snapshot::text not like '%Other user assignment%',
  'snapshot does not leak another user row'
)
from dashboard_test_snapshots;
select extensions.ok(
  snapshot::text not like '%private assignment body%'
    and snapshot::text not like '%note body%'
    and snapshot::text not like '%question body%'
    and snapshot::text not like '%"content":%'
    and snapshot::text not like '%"questions":%',
  'snapshot excludes heavy content fields'
)
from dashboard_test_snapshots;
select extensions.is(
  (snapshot #>> '{weeklySummary,cards_studied}')::integer,
  3,
  'UTC summary includes the deck-owned Sunday boundary session'
)
from dashboard_test_snapshots;
select extensions.is(
  (snapshot #>> '{weeklySummary,accuracy}')::numeric,
  0.6667::numeric,
  'weekly accuracy is a 0-to-1 ratio'
)
from dashboard_test_snapshots;
select extensions.is(
  (snapshot #>> '{weeklySummary,daily_breakdown,0,cards}')::integer,
  3,
  'daily breakdown exposes card totals'
)
from dashboard_test_snapshots;
select extensions.is(
  (snapshot #>> '{weeklySummary,daily_breakdown,0,minutes}')::integer,
  3,
  'daily breakdown exposes minute totals'
)
from dashboard_test_snapshots;
select extensions.is(
  (honolulu_snapshot #>> '{weeklySummary,cards_studied}')::integer,
  0,
  'timezone boundary excludes the prior local-week session'
)
from dashboard_test_snapshots;

reset role;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000099',
  true
);
set local role authenticated;

select extensions.ok(
  snapshot -> 'assignments' = '[]'::jsonb
    and snapshot -> 'classes' = '[]'::jsonb
    and snapshot -> 'recentDecks' = '[]'::jsonb
    and snapshot -> 'recentStudyItems' = '[]'::jsonb,
  'new users receive empty arrays'
)
from (select public.get_dashboard_bootstrap('UTC') as snapshot) as new_user;

select * from extensions.finish();

rollback;
