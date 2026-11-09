-- Keep the one-minute recovery cadence while avoiding empty HTTP requests.
-- Match every status that retry-ai-jobs can reclaim or dispatch; use a broad
-- predicate so timing and recovery decisions remain in the Edge Function.
DO $migration$
DECLARE
  retry_job_id bigint;
BEGIN
  SELECT jobid INTO retry_job_id FROM cron.job WHERE jobname = 'audio-note-ai-retry-minute';
  IF retry_job_id IS NULL THEN
    RAISE EXCEPTION 'audio retry cron job not found';
  END IF;
  PERFORM cron.alter_job(retry_job_id, command := $job$
    SELECT net.http_post(
      url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'project_url')
        || '/functions/v1/retry-ai-jobs',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-ai-job-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ai_job_runner_secret')
      ),
      body := '{"source":"pg_cron"}'::jsonb
    ) AS request_id
    WHERE EXISTS (
      SELECT 1 FROM public.ai_jobs
      WHERE kind = 'note_enhancement'
        AND status IN ('queued', 'running', 'streaming', 'saving')
    );
  $job$);
END;
$migration$;
