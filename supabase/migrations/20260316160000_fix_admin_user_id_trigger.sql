-- Fix: The unconditional user_id override breaks admin/service-role inserts
-- from edge functions. auth.uid() is NULL in admin context, so
-- get_app_user_id() returns NULL, and records become invisible via RLS.
--
-- New behavior:
--   - Client requests (auth.uid() present): override user_id (anti-impersonation)
--   - Admin/service-role (auth.uid() NULL): trust the provided user_id

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    -- Client request: enforce ownership (prevent impersonation)
    NEW.user_id := public.get_app_user_id();
  END IF;
  -- Admin/service-role request: trust the provided user_id
  RETURN NEW;
END;
$$;
