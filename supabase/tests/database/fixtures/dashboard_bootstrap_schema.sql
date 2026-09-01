create table public.users (
  id serial primary key,
  username text not null unique,
  email text not null unique,
  password text not null,
  supabase_auth_id uuid unique,
  streak_data text not null default '{}'
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  name text not null,
  color text,
  subject text,
  professor text,
  is_archived boolean not null default false,
  created_at timestamp not null default current_timestamp
);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  class_id uuid references public.classes(id) on delete cascade,
  title text not null,
  description text,
  status text not null default 'Todo',
  due_date timestamp,
  assignment_type text,
  type text,
  class_cleanup_archived_at timestamptz,
  created_at timestamp not null default current_timestamp
);

create table public.decks (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  title text not null,
  class_id uuid references public.classes(id) on delete set null,
  last_studied timestamp,
  created_at timestamp not null default current_timestamp
);

create table public.cards (
  id serial primary key,
  deck_id integer not null references public.decks(id) on delete cascade
);

create table public.tags (
  id serial primary key,
  user_id integer not null references public.users(id) on delete cascade,
  name text not null,
  color text
);

create table public.deck_tags (
  deck_id integer not null references public.decks(id) on delete cascade,
  tag_id integer not null references public.tags(id) on delete cascade,
  primary key (deck_id, tag_id)
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}',
  enhanced_content jsonb,
  class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.study_guides (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  title text not null,
  content jsonb not null default '{}',
  class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.mock_exams (
  id uuid primary key default gen_random_uuid(),
  user_id integer not null references public.users(id) on delete cascade,
  title text not null,
  questions jsonb not null default '[]',
  class_id uuid references public.classes(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.study_sessions (
  id serial primary key,
  deck_id integer not null references public.decks(id) on delete cascade,
  cards_studied integer not null default 0,
  cards_correct integer not null default 0,
  duration_seconds integer not null default 0,
  started_at timestamptz,
  created_at timestamp not null default current_timestamp
);

grant usage on schema public to authenticated;
grant select on all tables in schema public to authenticated;
