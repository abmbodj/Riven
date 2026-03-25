-- Performance indexes for case-insensitive user lookups
-- Auth queries use LOWER(email) and LOWER(username) which bypass default unique indexes
CREATE INDEX IF NOT EXISTS idx_users_lower_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users(LOWER(username));

-- Index for RLS policy helper: get_app_user_id() maps auth.uid() -> integer user_id
-- This function is called on every PostgREST query with RLS enabled
CREATE INDEX IF NOT EXISTS idx_users_supabase_auth_id ON users(supabase_auth_id) WHERE supabase_auth_id IS NOT NULL;
