-- Distinguish in-flight Stripe webhook claims from completed idempotency rows.
--
-- Rows created by the legacy Express webhook omit status and are completed by
-- definition. The edge webhook inserts `processing` first, then flips to
-- `processed` only after fulfillment succeeds.
ALTER TABLE public.stripe_processed_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'processed';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'stripe_processed_events_status_check'
      AND conrelid = 'public.stripe_processed_events'::regclass
  ) THEN
    ALTER TABLE public.stripe_processed_events
      ADD CONSTRAINT stripe_processed_events_status_check
      CHECK (status IN ('processing', 'processed'));
  END IF;
END;
$$;
