begin;

do $test$
begin
  if pg_catalog.has_function_privilege('anon', 'public.get_dashboard_bootstrap(text)', 'execute') then
    raise exception 'anonymous callers must not execute get_dashboard_bootstrap';
  end if;
  if not pg_catalog.has_function_privilege('authenticated', 'public.get_dashboard_bootstrap(text)', 'execute') then
    raise exception 'authenticated callers must execute get_dashboard_bootstrap';
  end if;
end;
$test$;

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
  user_id,
  deck_id,
  cards_studied,
  cards_correct,
  duration_seconds,
  created_at
)
select
  u.id,
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

do $test$
declare
  snapshot jsonb := public.get_dashboard_bootstrap('UTC');
  honolulu_snapshot jsonb := public.get_dashboard_bootstrap('Pacific/Honolulu');
begin
  if snapshot ->> 'version' <> '1' then
    raise exception 'snapshot version must be 1';
  end if;
  if jsonb_array_length(snapshot -> 'assignments') <> 1 then
    raise exception 'snapshot must contain only current-user assignments';
  end if;
  if snapshot::text like '%Other user assignment%' then
    raise exception 'snapshot leaked another user row';
  end if;
  if snapshot::text like '%private assignment body%'
    or snapshot::text like '%note body%'
    or snapshot::text like '%question body%'
    or snapshot ? 'content'
    or snapshot ? 'questions' then
    raise exception 'snapshot leaked heavy content';
  end if;
  if (snapshot #>> '{weeklySummary,cards_studied}')::integer <> 3 then
    raise exception 'UTC weekly summary must include the Sunday boundary session';
  end if;
  if (honolulu_snapshot #>> '{weeklySummary,cards_studied}')::integer <> 0 then
    raise exception 'timezone boundary must exclude the prior local-week session';
  end if;
end;
$test$;

reset role;

select pg_catalog.set_config(
  'request.jwt.claim.sub',
  '10000000-0000-0000-0000-000000000099',
  true
);
set local role authenticated;

do $test$
declare
  snapshot jsonb := public.get_dashboard_bootstrap('UTC');
begin
  if snapshot -> 'assignments' <> '[]'::jsonb
    or snapshot -> 'classes' <> '[]'::jsonb
    or snapshot -> 'recentDecks' <> '[]'::jsonb
    or snapshot -> 'recentStudyItems' <> '[]'::jsonb then
    raise exception 'new users must receive empty arrays';
  end if;
end;
$test$;

rollback;
