-- Security remediation (2026-06 review)
-- Bundles four hardening changes; safe to run on an existing database.

-- ─────────────────────────────────────────────────────────────────────────────
-- RIV-011: pin search_path on every SECURITY DEFINER function in `public`.
-- Without a fixed search_path a definer-rights function can be tricked into
-- resolving tables/functions from an attacker-controlled schema. This loops over
-- every such function (regardless of which migration defined it) and sets a safe
-- empty/public search_path, so later re-CREATEs are the only thing to keep in sync.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  fn RECORD;
BEGIN
  FOR fn IN
    SELECT
      p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND (
        p.proconfig IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM unnest(p.proconfig) AS cfg
          WHERE cfg LIKE 'search_path=%'
        )
      )
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', fn.signature);
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RIV-004: a user must not be able to PostgREST-INSERT themselves into an
-- arbitrary group. Joining is done by the group-actions edge function with the
-- service-role client (RLS-exempt) after it validates the join code, so the only
-- direct-insert path that should remain is the group creator. Drop the
-- self-insert disjunct.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS group_members_insert ON public.group_members;
CREATE POLICY group_members_insert ON public.group_members
  FOR INSERT WITH CHECK (
    public.is_group_creator(group_id)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- RIV-027: ensure the Stripe idempotency table exists with a primary key so a
-- fresh `supabase db reset` matches the server bootstrap and the webhook's
-- claim-then-process INSERT ... ON CONFLICT works.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stripe_processed_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.stripe_processed_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (used by the webhook) may touch it.

-- ─────────────────────────────────────────────────────────────────────────────
-- RIV-005: the Express legacy-JWT revocation table lives in the shared Postgres
-- DB and would otherwise be reachable via PostgREST. Enable RLS with no policies
-- so only the service role / direct server connection can read or write it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.revoked_tokens (
  jti TEXT PRIMARY KEY,
  user_id INTEGER,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.revoked_tokens ENABLE ROW LEVEL SECURITY;
