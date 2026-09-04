begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(12);

select extensions.has_table('public', 'recording_sessions', 'recording_sessions exists');
select extensions.has_table('public', 'recording_chunks', 'recording_chunks exists');
select extensions.has_table('public', 'transcript_segments', 'transcript_segments exists');
select extensions.has_table('public', 'recording_marks', 'recording_marks exists');
select extensions.has_table('public', 'recording_assets', 'recording_assets exists');
select extensions.has_table('public', 'note_revisions', 'note_revisions exists');
select extensions.has_table('public', 'study_signals', 'study_signals exists');
select extensions.has_table('public', 'class_note_profiles', 'class_note_profiles exists');
select extensions.has_table('public', 'class_memory_terms', 'class_memory_terms exists');

select extensions.ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.recording_sessions'::regclass),
  'recording_sessions has RLS enabled'
);
select extensions.ok(
  not pg_catalog.has_table_privilege('anon', 'public.recording_sessions', 'select'),
  'anonymous callers cannot read recording sessions'
);
select extensions.ok(
  pg_catalog.has_table_privilege('authenticated', 'public.recording_sessions', 'select'),
  'authenticated callers can access recording sessions through RLS'
);

select * from extensions.finish();
rollback;
