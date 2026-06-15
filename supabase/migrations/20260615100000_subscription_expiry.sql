-- Stores the provider-authoritative expiry timestamp for the current billing period.
-- NULL means no active paid subscription (or lifetime/role-based — check tier).
-- subscription_status mirrors the raw provider state for diagnostics only.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- Partial index speeds up the daily reconcile sweep (only scans supporters).
CREATE INDEX IF NOT EXISTS users_subscription_expires_supporters_idx
  ON public.users (subscription_expires_at)
  WHERE subscription_tier = 'supporter';

-- Ensure pg_cron and pg_net extensions are present (idempotent).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net  WITH SCHEMA extensions;

-- Daily reconcile job: fires at 07:00 UTC, calls the reconcile-subscriptions edge function.
-- The secret must be stored in Vault as 'reconcile_subscriptions_secret'.
SELECT cron.schedule(
  'reconcile-subscriptions-daily',
  '0 7 * * *',
  $$
    SELECT
      net.http_post(
        url     := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
                   || '/functions/v1/reconcile-subscriptions',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'reconcile_subscriptions_secret'
          )
        ),
        body    := '{"source":"pg_cron"}'::jsonb
      ) AS request_id;
  $$
);
