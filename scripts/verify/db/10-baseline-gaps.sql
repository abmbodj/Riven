-- LOCAL VERIFICATION ONLY. Never applied to production; never a migration.
-- Production's schema predates supabase/migrations/: base tables were created by
-- server/db.js initDb() and later edited in the Supabase dashboard. This file fills
-- the objects the migrations assume already exist, so the migration history can replay
-- on an empty local database. Each block names the first migration that needs it.

-- phase2_rls_policies: get_app_user_id() maps auth.uid() -> users.id
alter table public.users add column if not exists supabase_auth_id uuid unique;

-- pin_authorization_helper_search_paths: prod-only legacy helper, no repo definition and
-- no callers. Mirrors get_app_user_id() so the ALTER has a target.
create or replace function public.user_internal_id() returns integer
  language sql stable security definer
  as $$ select id from public.users where supabase_auth_id = auth.uid() $$;

-- complete-registration inserts users rows without a password (Supabase Auth owns it);
-- initDb declares users.password NOT NULL, so production must have dropped it.
alter table public.users alter column password drop not null;
