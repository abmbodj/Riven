-- =============================================================
-- Phase 2: RLS Policies + user_id auto-set trigger
-- Tables: classes, assignments, schedule_slots, folders, tags
-- =============================================================
-- Run this in Supabase Dashboard → SQL Editor → New Query → Run
-- =============================================================

-- ─────────────────────────────────────────────────────
-- 1. Helper function: resolve auth.uid() → integer user_id
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_app_user_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM public.users WHERE supabase_auth_id = auth.uid()
$$;

-- ─────────────────────────────────────────────────────
-- 2. Trigger function: auto-set user_id on INSERT
--    So the client never has to pass user_id explicitly
-- ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := public.get_app_user_id();
  END IF;
  RETURN NEW;
END;
$$;

-- ─────────────────────────────────────────────────────
-- 3. Enable RLS + Create policies + Attach trigger
-- ─────────────────────────────────────────────────────

-- ========== CLASSES ==========

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY classes_select ON public.classes
  FOR SELECT USING (user_id = public.get_app_user_id());

CREATE POLICY classes_insert ON public.classes
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

CREATE POLICY classes_update ON public.classes
  FOR UPDATE USING (user_id = public.get_app_user_id());

CREATE POLICY classes_delete ON public.classes
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_classes ON public.classes;
CREATE TRIGGER set_user_id_classes
  BEFORE INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== ASSIGNMENTS ==========

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY assignments_select ON public.assignments
  FOR SELECT USING (user_id = public.get_app_user_id());

CREATE POLICY assignments_insert ON public.assignments
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

CREATE POLICY assignments_update ON public.assignments
  FOR UPDATE USING (user_id = public.get_app_user_id());

CREATE POLICY assignments_delete ON public.assignments
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_assignments ON public.assignments;
CREATE TRIGGER set_user_id_assignments
  BEFORE INSERT ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== SCHEDULE_SLOTS ==========

ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedule_slots_select ON public.schedule_slots
  FOR SELECT USING (user_id = public.get_app_user_id());

CREATE POLICY schedule_slots_insert ON public.schedule_slots
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

CREATE POLICY schedule_slots_update ON public.schedule_slots
  FOR UPDATE USING (user_id = public.get_app_user_id());

CREATE POLICY schedule_slots_delete ON public.schedule_slots
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_schedule_slots ON public.schedule_slots;
CREATE TRIGGER set_user_id_schedule_slots
  BEFORE INSERT ON public.schedule_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== FOLDERS ==========

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY folders_select ON public.folders
  FOR SELECT USING (user_id = public.get_app_user_id());

CREATE POLICY folders_insert ON public.folders
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

CREATE POLICY folders_update ON public.folders
  FOR UPDATE USING (user_id = public.get_app_user_id());

CREATE POLICY folders_delete ON public.folders
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_folders ON public.folders;
CREATE TRIGGER set_user_id_folders
  BEFORE INSERT ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();


-- ========== TAGS ==========

ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY tags_select ON public.tags
  FOR SELECT USING (user_id = public.get_app_user_id());

CREATE POLICY tags_insert ON public.tags
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

CREATE POLICY tags_update ON public.tags
  FOR UPDATE USING (user_id = public.get_app_user_id());

CREATE POLICY tags_delete ON public.tags
  FOR DELETE USING (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_tags ON public.tags;
CREATE TRIGGER set_user_id_tags
  BEFORE INSERT ON public.tags
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();
