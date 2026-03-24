-- iOS remote push notifications for messages, streak rescue, and re-engagement.

CREATE TABLE IF NOT EXISTS public.user_push_devices (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            integer NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  installation_id    text NOT NULL,
  platform           text NOT NULL CHECK (platform IN ('ios')),
  push_token         text,
  is_active          boolean NOT NULL DEFAULT TRUE,
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_registered_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_push_devices_installation_id_key
  ON public.user_push_devices (installation_id);

CREATE INDEX IF NOT EXISTS user_push_devices_user_active_idx
  ON public.user_push_devices (user_id, is_active, platform);

CREATE INDEX IF NOT EXISTS user_push_devices_active_seen_idx
  ON public.user_push_devices (is_active, last_seen_at DESC)
  WHERE platform = 'ios' AND push_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.user_push_preferences (
  user_id                integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  messages_enabled       boolean NOT NULL DEFAULT TRUE,
  streak_enabled         boolean NOT NULL DEFAULT TRUE,
  reengagement_enabled   boolean NOT NULL DEFAULT TRUE,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_push_engagement_state (
  user_id                      integer PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  last_streak_reminder_marker  text,
  last_inactivity_stage_sent   integer,
  created_at                   timestamptz NOT NULL DEFAULT now(),
  updated_at                   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_push_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_push_engagement_state ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_push_devices_select_own ON public.user_push_devices;
CREATE POLICY user_push_devices_select_own ON public.user_push_devices
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS user_push_preferences_select_own ON public.user_push_preferences;
CREATE POLICY user_push_preferences_select_own ON public.user_push_preferences
  FOR SELECT USING (user_id = public.get_app_user_id());

DROP POLICY IF EXISTS user_push_preferences_insert_own ON public.user_push_preferences;
CREATE POLICY user_push_preferences_insert_own ON public.user_push_preferences
  FOR INSERT WITH CHECK (
    user_id IS NULL OR user_id = public.get_app_user_id()
  );

DROP POLICY IF EXISTS user_push_preferences_update_own ON public.user_push_preferences;
CREATE POLICY user_push_preferences_update_own ON public.user_push_preferences
  FOR UPDATE USING (user_id = public.get_app_user_id())
  WITH CHECK (user_id = public.get_app_user_id());

DROP TRIGGER IF EXISTS set_user_id_user_push_preferences ON public.user_push_preferences;
CREATE TRIGGER set_user_id_user_push_preferences
  BEFORE INSERT ON public.user_push_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_user_id_on_insert();

DROP TRIGGER IF EXISTS set_updated_at_user_push_devices ON public.user_push_devices;
CREATE TRIGGER set_updated_at_user_push_devices
  BEFORE UPDATE ON public.user_push_devices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_user_push_preferences ON public.user_push_preferences;
CREATE TRIGGER set_updated_at_user_push_preferences
  BEFORE UPDATE ON public.user_push_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_user_push_engagement_state ON public.user_push_engagement_state;
CREATE TRIGGER set_updated_at_user_push_engagement_state
  BEFORE UPDATE ON public.user_push_engagement_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.upsert_user_push_device(
  p_installation_id text,
  p_platform text DEFAULT 'ios',
  p_push_token text DEFAULT NULL,
  p_is_active boolean DEFAULT TRUE,
  p_last_seen_at timestamptz DEFAULT now()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_installation_id text := btrim(COALESCE(p_installation_id, ''));
  normalized_platform text := lower(btrim(COALESCE(p_platform, 'ios')));
BEGIN
  IF normalized_installation_id = '' THEN
    RAISE EXCEPTION 'installation_id is required'
      USING ERRCODE = '22023';
  END IF;

  IF normalized_platform <> 'ios' THEN
    RAISE EXCEPTION 'Unsupported push platform: %', normalized_platform
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_push_devices (
    user_id,
    installation_id,
    platform,
    push_token,
    is_active,
    last_seen_at,
    last_registered_at
  )
  VALUES (
    public.get_app_user_id(),
    normalized_installation_id,
    normalized_platform,
    NULLIF(btrim(COALESCE(p_push_token, '')), ''),
    COALESCE(p_is_active, TRUE),
    COALESCE(p_last_seen_at, now()),
    CASE
      WHEN NULLIF(btrim(COALESCE(p_push_token, '')), '') IS NOT NULL THEN now()
      ELSE NULL
    END
  )
  ON CONFLICT (installation_id) DO UPDATE
  SET
    user_id = public.get_app_user_id(),
    platform = EXCLUDED.platform,
    push_token = COALESCE(EXCLUDED.push_token, public.user_push_devices.push_token),
    is_active = EXCLUDED.is_active,
    last_seen_at = COALESCE(EXCLUDED.last_seen_at, now()),
    last_registered_at = CASE
      WHEN EXCLUDED.push_token IS NOT NULL THEN now()
      ELSE public.user_push_devices.last_registered_at
    END;
END;
$$;

CREATE OR REPLACE FUNCTION public.deactivate_user_push_device(
  p_installation_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_installation_id text := btrim(COALESCE(p_installation_id, ''));
BEGIN
  IF normalized_installation_id = '' THEN
    RETURN;
  END IF;

  UPDATE public.user_push_devices
  SET is_active = FALSE
  WHERE installation_id = normalized_installation_id
    AND user_id = public.get_app_user_id();
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_user_push_device(text, text, text, boolean, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deactivate_user_push_device(text) TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.enqueue_message_push_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url text;
  push_secret text;
BEGIN
  IF NEW.sender_id = NEW.receiver_id THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret
  INTO project_url
  FROM vault.decrypted_secrets
  WHERE name IN ('PROJECT_URL', 'project_url')
  ORDER BY CASE WHEN name = 'PROJECT_URL' THEN 0 ELSE 1 END
  LIMIT 1;

  SELECT decrypted_secret
  INTO push_secret
  FROM vault.decrypted_secrets
  WHERE name IN ('PUSH_DISPATCH_SECRET', 'push_dispatch_secret')
  ORDER BY CASE WHEN name = 'PUSH_DISPATCH_SECRET' THEN 0 ELSE 1 END
  LIMIT 1;

  IF project_url IS NULL OR push_secret IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := rtrim(project_url, '/') || '/functions/v1/push-dispatch',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || push_secret
    ),
    body := jsonb_build_object(
      'action', 'message_created',
      'messageId', NEW.id
    )
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'enqueue_message_push_dispatch failed for message %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enqueue_message_push_dispatch ON public.messages;
CREATE TRIGGER enqueue_message_push_dispatch
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_message_push_dispatch();

SELECT cron.schedule(
  'push-dispatch-reengagement-hourly',
  '10 * * * *',
  $$
    SELECT
      net.http_post(
        url := (
          SELECT rtrim(decrypted_secret, '/')
          FROM vault.decrypted_secrets
          WHERE name IN ('PROJECT_URL', 'project_url')
          ORDER BY CASE WHEN name = 'PROJECT_URL' THEN 0 ELSE 1 END
          LIMIT 1
        ) || '/functions/v1/push-dispatch',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name IN ('PUSH_DISPATCH_SECRET', 'push_dispatch_secret')
            ORDER BY CASE WHEN name = 'PUSH_DISPATCH_SECRET' THEN 0 ELSE 1 END
            LIMIT 1
          )
        ),
        body := '{"action":"reengagement_scan"}'::jsonb
      ) AS request_id;
  $$
);
