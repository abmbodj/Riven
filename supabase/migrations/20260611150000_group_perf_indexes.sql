-- Study-groups performance indexes (additive only).
--
-- These tables are created in server/db.js with no secondary indexes, so the
-- hot list queries fall back to sequential scans as groups grow. Every index
-- here is additive: no RLS policy, SECURITY DEFINER function, or column is
-- touched, so the 2026-06 security invariants are unaffected.
--
-- Deliberately NOT added: group_members(group_id). Its PRIMARY KEY is
-- (group_id, user_id), whose btree already serves `WHERE group_id = $1`
-- (list a group's members) and `WHERE group_id = $1 AND user_id = $2`
-- (is_group_member). Only the reverse lookup by user_id alone is uncovered.

-- "List the groups a user belongs to" filters group_members by user_id alone,
-- which the (group_id, user_id) PK cannot serve (user_id is not the leading col).
CREATE INDEX IF NOT EXISTS idx_group_members_user
  ON public.group_members (user_id);

-- group_files PK is (id); listing a folder's files (group_id [+ folder_id],
-- newest first) has no supporting index today.
CREATE INDEX IF NOT EXISTS idx_group_files_group_folder
  ON public.group_files (group_id, folder_id, uploaded_at DESC);

-- cram_sessions PK is (id); finding a group's active session
-- (`WHERE group_id = $1 AND status = 'active'` newest first) has no index today.
CREATE INDEX IF NOT EXISTS idx_cram_sessions_group_status
  ON public.cram_sessions (group_id, status, started_at DESC);

-- group_decks PK (group_id, deck_id) already serves the group_id filter; this
-- adds the shared_at ordering so "shared decks, newest first" avoids a sort.
CREATE INDEX IF NOT EXISTS idx_group_decks_group_shared
  ON public.group_decks (group_id, shared_at DESC);
