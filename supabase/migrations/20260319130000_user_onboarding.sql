-- Onboarding gate: new users complete a short flow; existing users backfilled as done.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS onboarding_step smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.users.onboarding_completed_at IS 'NULL = onboarding required; set when finished or skipped.';
COMMENT ON COLUMN public.users.onboarding_step IS 'Next step index (0-4) to show when resuming onboarding.';

-- One-time: all existing accounts treated as onboarded at migration time.
UPDATE public.users
SET onboarding_completed_at = COALESCE(onboarding_completed_at, now())
WHERE onboarding_completed_at IS NULL;

-- Allow self-updates to onboarding fields (see user_self_update_allowed).
CREATE OR REPLACE FUNCTION public.user_self_update_allowed(
  target_user_id integer,
  candidate jsonb
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  current_row jsonb;
BEGIN
  IF target_user_id IS NULL OR target_user_id <> public.get_app_user_id() OR candidate IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT to_jsonb(u)
  INTO current_row
  FROM public.users u
  WHERE u.id = target_user_id;

  IF current_row IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN (
    candidate
      - 'username'
      - 'display_name'
      - 'bio'
      - 'avatar'
      - 'banner'
      - 'streak_data'
      - 'pet_customization'
      - 'onboarding_completed_at'
      - 'onboarding_step'
  ) = (
    current_row
      - 'username'
      - 'display_name'
      - 'bio'
      - 'avatar'
      - 'banner'
      - 'streak_data'
      - 'pet_customization'
      - 'onboarding_completed_at'
      - 'onboarding_step'
  );
END;
$$;
