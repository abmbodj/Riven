ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS canvas_auto_sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS last_canvas_sync_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_canvas_auto_sync_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_canvas_auto_sync_error TEXT;

UPDATE public.users
SET canvas_auto_sync_enabled = TRUE
WHERE canvas_ical_url IS NOT NULL;

WITH duplicate_assignments AS (
  SELECT ctid
  FROM (
    SELECT
      ctid,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, canvas_assignment_id
        ORDER BY created_at ASC, id ASC
      ) AS row_num
    FROM public.assignments
    WHERE canvas_assignment_id IS NOT NULL
  ) ranked
  WHERE row_num > 1
)
DELETE FROM public.assignments assignments_to_delete
USING duplicate_assignments
WHERE assignments_to_delete.ctid = duplicate_assignments.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS assignments_user_canvas_assignment_unique
  ON public.assignments (user_id, canvas_assignment_id)
  WHERE canvas_assignment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_canvas_auto_sync_due_idx
  ON public.users (canvas_auto_sync_enabled, last_canvas_sync_at)
  WHERE canvas_ical_url IS NOT NULL;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'canvas-lms-auto-sync-hourly',
  '0 * * * *',
  $$
    SELECT
      net.http_post(
        url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url') || '/functions/v1/canvas-lms-auto-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'canvas_auto_sync_secret')
        ),
        body := '{"source":"pg_cron"}'::jsonb
      ) AS request_id;
  $$
);
