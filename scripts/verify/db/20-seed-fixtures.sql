-- LOCAL VERIFICATION ONLY. Fixture content for the seeded accounts (see lib/seed.mjs).
-- Users rows already exist (created by the real complete-registration function).
-- Fixed UUIDs/ids so journeys can navigate straight to an item.

-- Account state -------------------------------------------------------------
update public.users set onboarding_completed_at = '2026-09-01T12:00:00Z', onboarding_step = 0
  where email in ('student@riven.test', 'pro@riven.test');
update public.users set subscription_tier = 'supporter', subscription_status = 'active',
  subscription_expires_at = now() + interval '30 days'
  where email = 'pro@riven.test';

-- Student: one class with schedule, assignments, a deck and a lecture note ----
insert into public.classes (id, user_id, name, color, professor, room, subject, created_at)
select '11111111-1111-4111-8111-111111111111', id, 'BIO 101 Cell Biology', '#22c55e', 'Dr. Ada Lovelace', 'Science Hall 204', 'Biology', '2026-09-02T09:00:00'
from public.users where email = 'student@riven.test';

insert into public.schedule_slots (user_id, class_id, day_of_week, start_time, end_time)
select id, '11111111-1111-4111-8111-111111111111', d, '09:00', '10:15'
from public.users, unnest(array[1, 3]) as d where email = 'student@riven.test';

insert into public.assignments (user_id, class_id, title, description, status, due_date, type)
select id, '11111111-1111-4111-8111-111111111111', t.title, t.description, 'Todo', now() + t.due, t.type
from public.users, (values
  ('Read chapter 4: Cellular respiration', 'Pages 88-112', interval '2 days', 'reading'),
  ('Problem set 3', 'Glycolysis and Krebs cycle', interval '5 days', 'homework')
) as t(title, description, due, type)
where email = 'student@riven.test';

insert into public.decks (id, user_id, title, description, class_id, created_at)
select 1001, id, 'Cell Energy', 'Mitochondria, glycolysis and ATP', '11111111-1111-4111-8111-111111111111', '2026-09-03T09:00:00'
from public.users where email = 'student@riven.test';
select setval(pg_get_serial_sequence('public.decks', 'id'), 1001);

insert into public.cards (deck_id, front, back, position)
values
  (1001, 'Which organelle makes most ATP?', 'The mitochondrion', 0),
  (1001, 'Where does glycolysis happen?', 'In the cytoplasm', 1),
  (1001, 'What powers ATP synthase?', 'The proton gradient across the inner membrane', 2),
  (1001, 'What does the Krebs cycle feed into the ETC?', 'NADH and FADH2', 3);

insert into public.notes (id, user_id, title, class_id, source_type, content, created_at, updated_at)
select '22222222-2222-4222-8222-222222222222', id, 'Lecture 5: Cellular respiration', '11111111-1111-4111-8111-111111111111', 'manual',
  '{"type":"doc","content":[{"type":"heading","attrs":{"level":2},"content":[{"type":"text","text":"Cellular respiration"}]},{"type":"paragraph","content":[{"type":"text","text":"Glycolysis happens in the cytoplasm and splits glucose into two pyruvate. The Krebs cycle runs in the mitochondrial matrix and produces NADH and FADH2. The electron transport chain pumps protons across the inner membrane, and ATP synthase uses that gradient to make ATP. About 30 to 32 ATP are made per glucose."}]}]}',
  '2026-09-04T10:00:00Z', '2026-09-04T10:00:00Z'
from public.users where email = 'student@riven.test';

-- The note insert trigger queues a RAG ingest job; the verification stack has no job
-- runner on a timer, so drop it to keep ai_jobs empty at the start of every run.
delete from public.ai_jobs;
