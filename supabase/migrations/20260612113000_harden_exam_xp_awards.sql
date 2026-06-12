-- Harden the exam XP award path. Exam attempts are client-created, but XP and
-- study stats are server-owned; the edge function calls the RPC below with the
-- service-role client so claiming an attempt and incrementing XP happen in one
-- database transaction.

ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS xp_awarded integer;

DROP POLICY IF EXISTS exam_attempts_update ON public.exam_attempts;

DROP POLICY IF EXISTS study_user_stats_insert ON public.study_user_stats;
DROP POLICY IF EXISTS study_user_stats_update ON public.study_user_stats;
DROP POLICY IF EXISTS study_user_stats_delete ON public.study_user_stats;

CREATE OR REPLACE FUNCTION public.lock_exam_attempt_award_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  request_role text := COALESCE(current_setting('request.jwt.claim.role', true), '');
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF request_role <> 'service_role' AND current_user NOT IN ('postgres', 'supabase_admin') THEN
      NEW.xp_awarded := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.xp_awarded IS DISTINCT FROM OLD.xp_awarded
    AND request_role <> 'service_role'
    AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'xp_awarded is managed by the server' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lock_exam_attempt_award_fields ON public.exam_attempts;
CREATE TRIGGER lock_exam_attempt_award_fields
  BEFORE INSERT OR UPDATE OF xp_awarded ON public.exam_attempts
  FOR EACH ROW EXECUTE FUNCTION public.lock_exam_attempt_award_fields();

CREATE OR REPLACE FUNCTION public.award_exam_attempt_xp(
  target_attempt_id uuid,
  target_user_id integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  attempt_row public.exam_attempts%ROWTYPE;
  current_xp integer := 0;
  current_sessions integer := 0;
  current_topics integer := 0;
  previous_level integer := 1;
  next_xp integer := 0;
  next_level integer := 1;
  ratio numeric := 0;
  xp_earned integer := 0;
BEGIN
  SELECT *
  INTO attempt_row
  FROM public.exam_attempts
  WHERE id = target_attempt_id
    AND user_id = target_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('notFound', true);
  END IF;

  INSERT INTO public.study_user_stats (user_id)
  VALUES (target_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT
    COALESCE(xp_total, 0),
    COALESCE(sessions_completed, 0),
    COALESCE(topics_mastered, 0)
  INTO current_xp, current_sessions, current_topics
  FROM public.study_user_stats
  WHERE user_id = target_user_id
  FOR UPDATE;

  previous_level := GREATEST(1, FLOOR(GREATEST(current_xp, 0)::numeric / 120)::integer + 1);

  IF attempt_row.xp_awarded IS NOT NULL THEN
    RETURN jsonb_build_object(
      'xpEarned', 0,
      'alreadyAwarded', true,
      'stats', jsonb_build_object(
        'xpTotal', current_xp,
        'level', previous_level,
        'previousLevel', previous_level,
        'leveledUp', false
      )
    );
  END IF;

  IF COALESCE(attempt_row.total, 0) > 0 THEN
    ratio := LEAST(
      1,
      GREATEST(0, COALESCE(attempt_row.score, 0)::numeric / attempt_row.total::numeric)
    );
    xp_earned := LEAST(
      200,
      ROUND(ratio * 100)::integer + CASE WHEN ratio >= 0.7 THEN 20 ELSE 0 END
    );
  END IF;

  UPDATE public.exam_attempts
  SET xp_awarded = xp_earned
  WHERE id = attempt_row.id;

  next_xp := current_xp + xp_earned;
  next_level := GREATEST(1, FLOOR(GREATEST(next_xp, 0)::numeric / 120)::integer + 1);

  INSERT INTO public.study_user_stats (
    user_id,
    xp_total,
    level,
    last_study_at,
    sessions_completed,
    topics_mastered
  )
  VALUES (
    target_user_id,
    next_xp,
    next_level,
    now(),
    current_sessions,
    current_topics
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    xp_total = EXCLUDED.xp_total,
    level = EXCLUDED.level,
    last_study_at = EXCLUDED.last_study_at,
    sessions_completed = EXCLUDED.sessions_completed,
    topics_mastered = EXCLUDED.topics_mastered;

  RETURN jsonb_build_object(
    'xpEarned', xp_earned,
    'alreadyAwarded', false,
    'stats', jsonb_build_object(
      'xpTotal', next_xp,
      'level', next_level,
      'previousLevel', previous_level,
      'leveledUp', next_level > previous_level
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lock_exam_attempt_award_fields() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.award_exam_attempt_xp(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_exam_attempt_xp(uuid, integer) TO service_role;
