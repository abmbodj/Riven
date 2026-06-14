-- Award exam XP atomically with the attempt idempotency marker.
--
-- The edge function computes the bounded XP amount from the stored attempt, then
-- calls this RPC so the claim and stats increment commit or roll back together.
CREATE OR REPLACE FUNCTION public.award_exam_attempt_xp(
  p_attempt_id uuid,
  p_user_id integer,
  p_xp_award integer
)
RETURNS TABLE (
  xp_earned integer,
  already_awarded boolean,
  xp_total integer,
  level integer,
  previous_level integer,
  leveled_up boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  normalized_xp integer := GREATEST(COALESCE(p_xp_award, 0), 0);
  stored_award integer;
  prior_xp_total integer := 0;
  prior_level integer := 1;
  next_xp_total integer := 0;
  next_level integer := 1;
BEGIN
  UPDATE public.exam_attempts
  SET xp_awarded = normalized_xp
  WHERE id = p_attempt_id
    AND user_id = p_user_id
    AND xp_awarded IS NULL
  RETURNING xp_awarded INTO stored_award;

  IF NOT FOUND THEN
    SELECT exam_attempts.xp_awarded
    INTO stored_award
    FROM public.exam_attempts
    WHERE id = p_attempt_id
      AND user_id = p_user_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Exam attempt not found' USING ERRCODE = 'P0001';
    END IF;

    SELECT
      COALESCE(study_user_stats.xp_total, 0),
      GREATEST(1, FLOOR(GREATEST(COALESCE(study_user_stats.xp_total, 0), 0)::numeric / 120)::integer + 1)
    INTO prior_xp_total, prior_level
    FROM public.study_user_stats
    WHERE user_id = p_user_id;

    RETURN QUERY SELECT
      0,
      true,
      COALESCE(prior_xp_total, 0),
      COALESCE(prior_level, 1),
      COALESCE(prior_level, 1),
      false;
    RETURN;
  END IF;

  INSERT INTO public.study_user_stats (
    user_id,
    xp_total,
    level,
    last_study_at,
    sessions_completed,
    topics_mastered
  )
  VALUES (p_user_id, 0, 1, NULL, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT
    COALESCE(study_user_stats.xp_total, 0),
    GREATEST(1, FLOOR(GREATEST(COALESCE(study_user_stats.xp_total, 0), 0)::numeric / 120)::integer + 1)
  INTO prior_xp_total, prior_level
  FROM public.study_user_stats
  WHERE user_id = p_user_id
  FOR UPDATE;

  next_xp_total := COALESCE(prior_xp_total, 0) + normalized_xp;
  next_level := GREATEST(1, FLOOR(GREATEST(next_xp_total, 0)::numeric / 120)::integer + 1);

  UPDATE public.study_user_stats
  SET
    xp_total = next_xp_total,
    level = next_level,
    last_study_at = now()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT
    normalized_xp,
    false,
    next_xp_total,
    next_level,
    COALESCE(prior_level, 1),
    next_level > COALESCE(prior_level, 1);
END;
$$;

REVOKE ALL ON FUNCTION public.award_exam_attempt_xp(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.award_exam_attempt_xp(uuid, integer, integer) TO service_role;
