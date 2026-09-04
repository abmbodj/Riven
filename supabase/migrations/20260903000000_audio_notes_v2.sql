-- Classroom audio-to-notes v2: durable recording sessions, structured transcripts,
-- evidence-linked study signals, note revisions, and per-class note memory.

-- New public tables are explicitly granted to authenticated because current Supabase
-- projects no longer expose newly-created public tables to the Data API automatically.

create table if not exists public.recording_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  class_id uuid null references public.classes(id) on delete set null,
  client_session_id text not null,
  state text not null default 'preflight' check (state in (
    'preflight', 'recording', 'paused', 'reconnecting', 'stopped',
    'transcript_ready', 'enhancing', 'complete', 'failed'
  )),
  session_kind text not null default 'lecture' check (session_kind in (
    'lecture', 'seminar', 'lab', 'critique', 'problem_solving'
  )),
  started_at timestamptz null,
  stopped_at timestamptz null,
  duration_ms bigint not null default 0 check (duration_ms >= 0),
  source_config jsonb not null default '{}'::jsonb,
  language_config jsonb not null default '{}'::jsonb,
  manifest_chunk_count integer not null default 0 check (manifest_chunk_count >= 0),
  manifest_uploaded_count integer not null default 0 check (manifest_uploaded_count >= 0),
  transcript_revision integer not null default 0 check (transcript_revision >= 0),
  source_snapshot_hash text null,
  enhancement_completed_at timestamptz null,
  audio_retention_policy text not null default 'standard' check (audio_retention_policy in ('standard', 'keep_30_days')),
  audio_expires_at timestamptz null,
  audio_deleted_at timestamptz null,
  last_error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_session_id)
);

create table if not exists public.recording_chunks (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  session_id uuid not null references public.recording_sessions(id) on delete cascade,
  sequence integer not null check (sequence >= 0),
  started_at_ms bigint not null check (started_at_ms >= 0),
  ended_at_ms bigint not null check (ended_at_ms > started_at_ms),
  duration_ms integer not null check (duration_ms > 0),
  source text not null default 'microphone' check (source in ('microphone', 'tab', 'mixed')),
  storage_path text not null,
  sha256 text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  upload_state text not null default 'uploaded' check (upload_state in ('pending', 'uploaded', 'verified', 'failed', 'deleted')),
  provider_request_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, sequence)
);

create table if not exists public.transcript_segments (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  session_id uuid not null references public.recording_sessions(id) on delete cascade,
  provider_segment_id text not null,
  started_at_ms bigint not null check (started_at_ms >= 0),
  ended_at_ms bigint not null check (ended_at_ms >= started_at_ms),
  source text not null default 'microphone' check (source in ('microphone', 'tab', 'mixed', 'replay')),
  speaker_key text null,
  speaker_role text null,
  language_code text null,
  confidence numeric(6,5) null check (confidence is null or (confidence >= 0 and confidence <= 1)),
  original_text text not null,
  corrected_text text null,
  revision integer not null default 1 check (revision >= 1),
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, provider_segment_id)
);

create table if not exists public.recording_marks (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  session_id uuid not null references public.recording_sessions(id) on delete cascade,
  marked_at_ms bigint not null check (marked_at_ms >= 0),
  label text null check (label is null or char_length(label) <= 240),
  created_at timestamptz not null default now()
);

create table if not exists public.recording_assets (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  session_id uuid not null references public.recording_sessions(id) on delete cascade,
  asset_kind text not null check (asset_kind in ('photo', 'slide_pdf', 'document')),
  captured_at_ms bigint null check (captured_at_ms is null or captured_at_ms >= 0),
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0),
  extracted_text text null,
  analysis jsonb not null default '{}'::jsonb,
  accessible_label text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.note_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  revision integer not null check (revision >= 1),
  content jsonb not null,
  change_kind text not null check (change_kind in ('manual', 'enhancement', 'regeneration', 'restore')),
  source_snapshot_hash text null,
  created_at timestamptz not null default now(),
  unique (note_id, revision)
);

create table if not exists public.study_signals (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  note_id uuid not null references public.notes(id) on delete cascade,
  session_id uuid null references public.recording_sessions(id) on delete cascade,
  signal_kind text not null check (signal_kind in (
    'exam_cue', 'inferred_importance', 'assignment_candidate', 'deadline_candidate',
    'marked_moment', 'uncertainty', 'audio_gap', 'source_conflict'
  )),
  title text not null,
  body text null,
  severity text not null default 'info' check (severity in ('info', 'review', 'warning')),
  evidence_refs jsonb not null default '[]'::jsonb,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'open' check (status in ('open', 'confirmed', 'dismissed')),
  share_visibility text not null default 'private' check (share_visibility in ('private', 'included')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.class_note_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  primary_language text not null default 'en',
  secondary_languages text[] not null default '{}'::text[],
  translation_mode text not null default 'original' check (translation_mode in ('original', 'bilingual', 'translated')),
  preferred_format text not null default 'auto' check (preferred_format in (
    'auto', 'worked_examples', 'process', 'cornell', 'outline', 'chronological',
    'evidence_analysis', 'concept_map', 'procedural', 'discussion', 'language'
  )),
  detail_level text not null default 'detailed' check (detail_level in ('concise', 'detailed')),
  custom_instruction text null check (custom_instruction is null or char_length(custom_instruction) <= 1000),
  recording_policy_status text not null default 'unknown' check (recording_policy_status in ('unknown', 'allowed', 'restricted')),
  cellular_behavior text not null default 'stream' check (cellular_behavior in ('stream', 'ask', 'local_only')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id)
);

create table if not exists public.class_memory_terms (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  term text not null,
  corrected_form text not null,
  speaker_role text null,
  source_kind text not null default 'transcript_correction' check (source_kind in ('transcript_correction', 'speaker_correction', 'course_material')),
  confirmed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (class_id, term)
);

alter table public.notes
  add column if not exists note_revision integer not null default 0,
  add column if not exists audio_retention_policy text not null default 'legacy',
  add column if not exists audio_expires_at timestamptz null,
  add column if not exists enhancement_schema_version integer not null default 1;

-- AI provider outages are retried durably by pg_cron instead of tying retry
-- lifetime to one Edge Function isolate.
alter table public.ai_jobs
  add column if not exists attempt_count integer not null default 0 check (attempt_count >= 0),
  add column if not exists next_attempt_at timestamptz null,
  add column if not exists retry_until timestamptz not null default (now() + interval '24 hours');

create index if not exists ai_jobs_audio_retry_due_idx
  on public.ai_jobs (next_attempt_at)
  where kind = 'note_enhancement' and status = 'queued' and next_attempt_at is not null;

alter table public.notes drop constraint if exists notes_audio_retention_policy_check;
alter table public.notes add constraint notes_audio_retention_policy_check
  check (audio_retention_policy in ('legacy', 'standard', 'keep_30_days'));

create index if not exists recording_sessions_user_updated_idx on public.recording_sessions (user_id, updated_at desc);
create index if not exists recording_sessions_note_idx on public.recording_sessions (note_id, created_at desc);
create index if not exists recording_chunks_session_sequence_idx on public.recording_chunks (session_id, sequence);
create index if not exists transcript_segments_session_time_idx on public.transcript_segments (session_id, started_at_ms, ended_at_ms);
create index if not exists recording_marks_session_time_idx on public.recording_marks (session_id, marked_at_ms);
create index if not exists recording_assets_session_time_idx on public.recording_assets (session_id, captured_at_ms);
create index if not exists note_revisions_note_revision_idx on public.note_revisions (note_id, revision desc);
create index if not exists study_signals_note_status_idx on public.study_signals (note_id, status, created_at);
create index if not exists class_memory_terms_class_idx on public.class_memory_terms (class_id, term);

-- RLS and owner policies. UPDATE always has both USING and WITH CHECK.
alter table public.recording_sessions enable row level security;
alter table public.recording_chunks enable row level security;
alter table public.transcript_segments enable row level security;
alter table public.recording_marks enable row level security;
alter table public.recording_assets enable row level security;
alter table public.note_revisions enable row level security;
alter table public.study_signals enable row level security;
alter table public.class_note_profiles enable row level security;
alter table public.class_memory_terms enable row level security;

revoke all on public.recording_sessions from anon;
grant select, insert, update, delete on public.recording_sessions to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recording_sessions', 'recording_chunks', 'transcript_segments', 'recording_marks',
    'recording_assets', 'note_revisions', 'study_signals', 'class_note_profiles', 'class_memory_terms'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_select', table_name);
    execute format('create policy %I on public.%I for select to authenticated using ((select public.get_app_user_id()) = user_id)', table_name || '_select', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_insert', table_name);
    execute format('create policy %I on public.%I for insert to authenticated with check ((select public.get_app_user_id()) = user_id)', table_name || '_insert', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_update', table_name);
    execute format('create policy %I on public.%I for update to authenticated using ((select public.get_app_user_id()) = user_id) with check ((select public.get_app_user_id()) = user_id)', table_name || '_update', table_name);
    execute format('drop policy if exists %I on public.%I', table_name || '_delete', table_name);
    execute format('create policy %I on public.%I for delete to authenticated using ((select public.get_app_user_id()) = user_id)', table_name || '_delete', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end;
$$;

-- Keep user_id and updated_at consistent with the rest of Riven's schema.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'recording_sessions', 'recording_chunks', 'transcript_segments', 'recording_marks',
    'recording_assets', 'note_revisions', 'study_signals', 'class_note_profiles', 'class_memory_terms'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_user_id_' || table_name, table_name);
    execute format('create trigger %I before insert on public.%I for each row execute function public.set_user_id_on_insert()', 'set_user_id_' || table_name, table_name);
  end loop;

  foreach table_name in array array[
    'recording_sessions', 'recording_chunks', 'transcript_segments', 'recording_assets',
    'study_signals', 'class_note_profiles', 'class_memory_terms'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'set_updated_at_' || table_name, table_name);
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_updated_at_' || table_name, table_name);
  end loop;
end;
$$;

-- Apply the final generated note, its undo snapshot, evidence-linked signals, and
-- retention clock in one transaction. The Edge Function calls this with the service
-- role; authenticated callers remain constrained to their own app user id.
create or replace function public.apply_audio_note_enhancement_v2(
  p_user_id integer,
  p_note_id uuid,
  p_session_id uuid,
  p_content jsonb,
  p_transcript text,
  p_audio_segments jsonb,
  p_knowledge_layer jsonb,
  p_source_snapshot_hash text,
  p_study_signals jsonb,
  p_completed_at timestamptz
)
returns table (note_revision integer, audio_expires_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  previous_content jsonb;
  previous_revision integer;
  backup_revision integer;
  final_revision integer;
  retention_policy text;
  expires_at timestamptz;
begin
  if auth.role() <> 'service_role' and public.get_app_user_id() <> p_user_id then
    raise exception 'Not authorized to apply this note enhancement' using errcode = '42501';
  end if;

  select n.content, n.note_revision
    into previous_content, previous_revision
  from public.notes n
  where n.id = p_note_id and n.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Note not found' using errcode = 'P0002';
  end if;

  select rs.audio_retention_policy
    into retention_policy
  from public.recording_sessions rs
  where rs.id = p_session_id and rs.note_id = p_note_id and rs.user_id = p_user_id
  for update;

  if not found then
    raise exception 'Recording session not found' using errcode = 'P0002';
  end if;

  backup_revision := previous_revision + 1;
  final_revision := previous_revision + 2;
  expires_at := p_completed_at + case
    when retention_policy = 'keep_30_days' then interval '30 days'
    else interval '24 hours'
  end;

  insert into public.note_revisions (
    user_id, note_id, revision, content, change_kind, source_snapshot_hash
  ) values
    (p_user_id, p_note_id, backup_revision, coalesce(previous_content, '{}'::jsonb), 'manual', p_source_snapshot_hash),
    (p_user_id, p_note_id, final_revision, p_content, 'enhancement', p_source_snapshot_hash);

  delete from public.study_signals
  where note_id = p_note_id and session_id = p_session_id and user_id = p_user_id;

  insert into public.study_signals (
    user_id, note_id, session_id, signal_kind, title, body, severity,
    evidence_refs, payload, status, share_visibility
  )
  select
    p_user_id,
    p_note_id,
    p_session_id,
    signal.signal_kind,
    signal.title,
    signal.body,
    signal.severity,
    coalesce(signal.evidence_refs, '[]'::jsonb),
    coalesce(signal.payload, '{}'::jsonb),
    'open',
    'private'
  from jsonb_to_recordset(coalesce(p_study_signals, '[]'::jsonb)) as signal(
    signal_kind text,
    title text,
    body text,
    severity text,
    evidence_refs jsonb,
    payload jsonb
  );

  update public.notes
  set
    enhanced_content = p_content,
    content = p_content,
    transcript = p_transcript,
    audio_segments = p_audio_segments,
    polish_status = 'polished',
    source_type = 'audio',
    knowledge_layer = p_knowledge_layer,
    note_revision = final_revision,
    audio_retention_policy = retention_policy,
    audio_expires_at = expires_at,
    enhancement_schema_version = 2
  where id = p_note_id and user_id = p_user_id;

  update public.recording_sessions
  set
    state = 'complete',
    source_snapshot_hash = p_source_snapshot_hash,
    enhancement_completed_at = p_completed_at,
    audio_expires_at = expires_at
  where id = p_session_id and user_id = p_user_id;

  return query select final_revision, expires_at;
end;
$$;

revoke all on function public.apply_audio_note_enhancement_v2(
  integer, uuid, uuid, jsonb, text, jsonb, jsonb, text, jsonb, timestamptz
) from anon;
grant execute on function public.apply_audio_note_enhancement_v2(
  integer, uuid, uuid, jsonb, text, jsonb, jsonb, text, jsonb, timestamptz
) to authenticated, service_role;

create or replace function public.restore_audio_note_revision(
  p_user_id integer,
  p_note_id uuid,
  p_revision integer
)
returns table (content jsonb, note_revision integer)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  restored_content jsonb;
  next_revision integer;
begin
  if auth.role() <> 'service_role' and public.get_app_user_id() <> p_user_id then
    raise exception 'Not authorized to restore this note' using errcode = '42501';
  end if;

  select nr.content into restored_content
  from public.note_revisions nr
  where nr.note_id = p_note_id and nr.user_id = p_user_id and nr.revision = p_revision;
  if not found then
    raise exception 'Note revision not found' using errcode = 'P0002';
  end if;

  select n.note_revision + 1 into next_revision
  from public.notes n
  where n.id = p_note_id and n.user_id = p_user_id
  for update;
  if not found then
    raise exception 'Note not found' using errcode = 'P0002';
  end if;

  insert into public.note_revisions (user_id, note_id, revision, content, change_kind)
  values (p_user_id, p_note_id, next_revision, restored_content, 'restore');

  update public.notes
  set
    content = restored_content,
    enhanced_content = null,
    polish_status = 'draft',
    knowledge_layer = null,
    note_revision = next_revision
  where id = p_note_id and user_id = p_user_id;

  return query select restored_content, next_revision;
end;
$$;

revoke all on function public.restore_audio_note_revision(integer, uuid, integer) from anon;
grant execute on function public.restore_audio_note_revision(integer, uuid, integer) to authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'recording-chunks',
  'recording-chunks',
  false,
  5242880,
  array['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/x-m4a', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'note-assets',
  'note-assets',
  false,
  52428800,
  array['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can insert own recording media" on storage.objects;
create policy "Users can insert own recording media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('recording-chunks', 'note-assets')
    and (storage.foldername(name))[1] = (select public.get_app_user_id())::text
  );

drop policy if exists "Users can read own recording media" on storage.objects;
create policy "Users can read own recording media" on storage.objects
  for select to authenticated
  using (
    bucket_id in ('recording-chunks', 'note-assets')
    and (storage.foldername(name))[1] = (select public.get_app_user_id())::text
  );

drop policy if exists "Users can update own recording media" on storage.objects;
create policy "Users can update own recording media" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('recording-chunks', 'note-assets')
    and (storage.foldername(name))[1] = (select public.get_app_user_id())::text
  )
  with check (
    bucket_id in ('recording-chunks', 'note-assets')
    and (storage.foldername(name))[1] = (select public.get_app_user_id())::text
  );

drop policy if exists "Users can delete own recording media" on storage.objects;
create policy "Users can delete own recording media" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('recording-chunks', 'note-assets')
    and (storage.foldername(name))[1] = (select public.get_app_user_id())::text
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recording_sessions'
    ) then
      alter publication supabase_realtime add table public.recording_sessions;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'transcript_segments'
    ) then
      alter publication supabase_realtime add table public.transcript_segments;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'study_signals'
    ) then
      alter publication supabase_realtime add table public.study_signals;
    end if;
  end if;
end;
$$;

-- Vault prerequisites (configured by the deployer): project_url,
-- ai_job_runner_secret, and audio_retention_cleanup_secret.
create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  perform cron.unschedule('audio-note-ai-retry-minute');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'audio-note-ai-retry-minute',
  '* * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/retry-ai-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ai-job-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'ai_job_runner_secret')
      ),
      body := '{"source":"pg_cron"}'::jsonb
    ) as request_id;
  $cron$
);

do $$
begin
  perform cron.unschedule('audio-retention-cleanup-hourly');
exception when others then
  null;
end;
$$;

select cron.schedule(
  'audio-retention-cleanup-hourly',
  '17 * * * *',
  $cron$
    select net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
        || '/functions/v1/audio-retention-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-audio-retention-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'audio_retention_cleanup_secret')
      ),
      body := '{"source":"pg_cron"}'::jsonb
    ) as request_id;
  $cron$
);
