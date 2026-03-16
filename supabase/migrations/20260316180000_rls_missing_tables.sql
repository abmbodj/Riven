-- =============================================================
-- RLS for tables that were missing policies
-- Tables: study_groups, group_members, group_decks, group_folders,
--         group_files, referrals, shared_decks, password_reset_tokens,
--         email_verification_tokens, stripe_processed_events, ad_rewards
-- =============================================================

-- Helper: check if current user is a member of a group
CREATE OR REPLACE FUNCTION public.is_group_member(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = target_group_id
      AND gm.user_id = public.get_app_user_id()
  );
$$;

-- Helper: check if current user is creator of a group
CREATE OR REPLACE FUNCTION public.is_group_creator(target_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_groups g
    WHERE g.id = target_group_id
      AND g.created_by = public.get_app_user_id()
  );
$$;

-- ========== study_groups ==========
ALTER TABLE public.study_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_groups_select ON public.study_groups;
CREATE POLICY study_groups_select ON public.study_groups
  FOR SELECT USING (public.is_group_member(id));

DROP POLICY IF EXISTS study_groups_insert ON public.study_groups;
CREATE POLICY study_groups_insert ON public.study_groups
  FOR INSERT WITH CHECK (public.get_app_user_id() IS NOT NULL);

DROP POLICY IF EXISTS study_groups_update ON public.study_groups;
CREATE POLICY study_groups_update ON public.study_groups
  FOR UPDATE USING (public.is_group_creator(id));

DROP POLICY IF EXISTS study_groups_delete ON public.study_groups;
CREATE POLICY study_groups_delete ON public.study_groups
  FOR DELETE USING (public.is_group_creator(id));

-- ========== group_members ==========
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_members_select ON public.group_members;
CREATE POLICY group_members_select ON public.group_members
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_members_insert ON public.group_members;
CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT WITH CHECK (
    user_id = public.get_app_user_id()
    OR public.is_group_creator(group_id)
  );

DROP POLICY IF EXISTS group_members_delete ON public.group_members;
CREATE POLICY group_members_delete ON public.group_members
  FOR DELETE USING (
    user_id = public.get_app_user_id()
    OR public.is_group_creator(group_id)
  );

-- ========== group_decks ==========
ALTER TABLE public.group_decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_decks_select ON public.group_decks;
CREATE POLICY group_decks_select ON public.group_decks
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_decks_insert ON public.group_decks;
CREATE POLICY group_decks_insert ON public.group_decks
  FOR INSERT WITH CHECK (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_decks_delete ON public.group_decks;
CREATE POLICY group_decks_delete ON public.group_decks
  FOR DELETE USING (public.is_group_member(group_id));

-- ========== group_folders ==========
ALTER TABLE public.group_folders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_folders_select ON public.group_folders;
CREATE POLICY group_folders_select ON public.group_folders
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_folders_insert ON public.group_folders;
CREATE POLICY group_folders_insert ON public.group_folders
  FOR INSERT WITH CHECK (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_folders_update ON public.group_folders;
CREATE POLICY group_folders_update ON public.group_folders
  FOR UPDATE USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_folders_delete ON public.group_folders;
CREATE POLICY group_folders_delete ON public.group_folders
  FOR DELETE USING (public.is_group_member(group_id));

-- ========== group_files ==========
ALTER TABLE public.group_files ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS group_files_select ON public.group_files;
CREATE POLICY group_files_select ON public.group_files
  FOR SELECT USING (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_files_insert ON public.group_files;
CREATE POLICY group_files_insert ON public.group_files
  FOR INSERT WITH CHECK (public.is_group_member(group_id));

DROP POLICY IF EXISTS group_files_delete ON public.group_files;
CREATE POLICY group_files_delete ON public.group_files
  FOR DELETE USING (public.is_group_member(group_id));

-- ========== referrals ==========
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referrals_select ON public.referrals;
CREATE POLICY referrals_select ON public.referrals
  FOR SELECT USING (
    referrer_id = public.get_app_user_id()
    OR referred_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS referrals_insert ON public.referrals;
CREATE POLICY referrals_insert ON public.referrals
  FOR INSERT WITH CHECK (referrer_id = public.get_app_user_id());

-- ========== shared_decks ==========
ALTER TABLE public.shared_decks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shared_decks_select ON public.shared_decks;
CREATE POLICY shared_decks_select ON public.shared_decks
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS shared_decks_insert ON public.shared_decks;
CREATE POLICY shared_decks_insert ON public.shared_decks
  FOR INSERT WITH CHECK (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS shared_decks_update ON public.shared_decks;
CREATE POLICY shared_decks_update ON public.shared_decks
  FOR UPDATE USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS shared_decks_delete ON public.shared_decks;
CREATE POLICY shared_decks_delete ON public.shared_decks
  FOR DELETE USING (user_id = public.get_app_user_id());

-- ========== Service tables: no policies (deny all for anon/authenticated) ==========
-- Service role bypasses RLS. These are used only by Edge Functions with service role.

ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.email_verification_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;

-- ========== ad_rewards ==========
ALTER TABLE public.ad_rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_rewards_select ON public.ad_rewards;
CREATE POLICY ad_rewards_select ON public.ad_rewards
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS ad_rewards_insert ON public.ad_rewards;
CREATE POLICY ad_rewards_insert ON public.ad_rewards
  FOR INSERT WITH CHECK (user_id = public.get_app_user_id());
