-- Minimal stand-ins for the Supabase objects the RAG migration depends on, so it can be applied
-- to a plain pgvector Postgres (docker pgvector/pgvector:pg17) for tests and the eval harness.
create schema if not exists extensions;
create schema if not exists auth;
do $$ begin
  create role anon; exception when duplicate_object then null; end $$;
do $$ begin
  create role authenticated; exception when duplicate_object then null; end $$;
do $$ begin
  create role service_role; exception when duplicate_object then null; end $$;

create or replace function auth.uid() returns uuid language sql stable as
$$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

create table if not exists public.users (
  id serial primary key,
  supabase_auth_id uuid unique
);

create or replace function public.get_app_user_id() returns integer language sql stable security definer as
$$ select id from public.users where supabase_auth_id = auth.uid() $$;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id integer references public.users(id) on delete cascade,
  title text not null default 'Untitled',
  content jsonb default '{}',
  source_type text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_guides (
  id uuid primary key default gen_random_uuid(),
  user_id integer references public.users(id) on delete cascade,
  title text not null default 'Untitled Guide',
  note_id uuid
);

create table if not exists public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  kind text not null,
  status text not null,
  phase text not null,
  input_payload jsonb not null default '{}'::jsonb,
  result_payload jsonb not null default '{}'::jsonb,
  error_payload jsonb not null default '{}'::jsonb,
  source_key text,
  target_type text,
  target_id text,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz,
  retry_until timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
