-- Security fix: always override user_id on INSERT to prevent client-supplied
-- impersonation. Previously the trigger only set user_id when NULL, allowing
-- a malicious client to pass another user's ID.

CREATE OR REPLACE FUNCTION public.set_user_id_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.user_id := public.get_app_user_id();
  RETURN NEW;
END;
$$;
