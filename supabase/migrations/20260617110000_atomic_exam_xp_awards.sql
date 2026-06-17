-- Atomically mark an exam attempt as XP-awarded and increment user stats.
-- This prevents concurrent exam completions from overwriting each other's XP totals
-- and ensures retries can recover if any part of the award fails.
CREATE OR REPLACE FUNCTION public.award_exam_attempt_xp(
  p_attempt_id uuid,
  p_user_id integer,
  p_xp_awarded integer
)
RETURNS TABLE (
  xp_total integer,
  level integer,
  previous_xp_total integer,
  previous_level integer,
  already_awarded boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows_updated integer := 0;
  v_xp_awarded integer := GREATEST(0, COALESCE(p_xp_awarded, 0));
  v_xp_total integer := 0;
  v_level integer := 1;
  v_previous_xp_total integer := 0;
BEGIN
  UPDATE public.exam_attempts
  SET xp_awarded = v_xp_awarded
  WHERE id = p_attempt_id
    AND user_id = p_user_id
    AND xp_awarded IS NULL;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    SELECT
      COALESCE(stats.xp_total, 0),
      GREATEST(1, FLOOR(COALESCE(stats.xp_total, 0)::numeric / 120)::integer + 1)
    INTO v_xp_total, v_level
    FROM public.study_user_stats AS stats
    WHERE stats.user_id = p_user_id;

    v_xp_total := COALESCE(v_xp_total, 0);
    v_level := COALESCE(v_level, 1);

    RETURN QUERY SELECT
      v_xp_total,
      v_level,
      v_xp_total,
      v_level,
      TRUE;
    RETURN;
  END IF;

  WITH updated_stats AS (
    INSERT INTO public.study_user_stats AS stats (
      user_id,
      xp_total,
      level,
      last_study_at
    )
    VALUES (
      p_user_id,
      v_xp_awarded,
      GREATEST(1, FLOOR(v_xp_awarded::numeric / 120)::integer + 1),
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET xp_total = stats.xp_total + EXCLUDED.xp_total,
          level = GREATEST(
            1,
            FLOOR((stats.xp_total + EXCLUDED.xp_total)::numeric / 120)::integer + 1
          ),
          last_study_at = EXCLUDED.last_study_at
    RETURNING stats.xp_total, stats.level
  )
  SELECT updated_stats.xp_total, updated_stats.level
  INTO v_xp_total, v_level
  FROM updated_stats;

  v_previous_xp_total := GREATEST(0, v_xp_total - v_xp_awarded);

  RETURN QUERY SELECT
    v_xp_total,
    v_level,
    v_previous_xp_total,
    GREATEST(1, FLOOR(v_previous_xp_total::numeric / 120)::integer + 1),
    FALSE;
END;
$$;

-- Atomic additive stats writer for non-exam study completions.
CREATE OR REPLACE FUNCTION public.increment_study_user_stats(
  p_user_id integer,
  p_xp_earned integer,
  p_sessions_completed_delta integer DEFAULT 0,
  p_topics_mastered integer DEFAULT 0,
  p_last_study_at timestamptz DEFAULT now()
)
RETURNS TABLE (
  xp_total integer,
  level integer,
  previous_xp_total integer,
  previous_level integer,
  sessions_completed integer,
  topics_mastered integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_xp_earned integer := GREATEST(0, COALESCE(p_xp_earned, 0));
  v_sessions_delta integer := GREATEST(0, COALESCE(p_sessions_completed_delta, 0));
  v_topics_mastered integer := GREATEST(0, COALESCE(p_topics_mastered, 0));
  v_xp_total integer := 0;
  v_level integer := 1;
  v_sessions_completed integer := 0;
  v_previous_xp_total integer := 0;
BEGIN
  WITH updated_stats AS (
    INSERT INTO public.study_user_stats AS stats (
      user_id,
      xp_total,
      level,
      last_study_at,
      sessions_completed,
      topics_mastered
    )
    VALUES (
      p_user_id,
      v_xp_earned,
      GREATEST(1, FLOOR(v_xp_earned::numeric / 120)::integer + 1),
      p_last_study_at,
      v_sessions_delta,
      v_topics_mastered
    )
    ON CONFLICT (user_id) DO UPDATE
      SET xp_total = stats.xp_total + EXCLUDED.xp_total,
          level = GREATEST(
            1,
            FLOOR((stats.xp_total + EXCLUDED.xp_total)::numeric / 120)::integer + 1
          ),
          last_study_at = EXCLUDED.last_study_at,
          sessions_completed = stats.sessions_completed + EXCLUDED.sessions_completed,
          topics_mastered = EXCLUDED.topics_mastered
    RETURNING stats.xp_total, stats.level, stats.sessions_completed, stats.topics_mastered
  )
  SELECT
    updated_stats.xp_total,
    updated_stats.level,
    updated_stats.sessions_completed,
    updated_stats.topics_mastered
  INTO v_xp_total, v_level, v_sessions_completed, v_topics_mastered
  FROM updated_stats;

  v_previous_xp_total := GREATEST(0, v_xp_total - v_xp_earned);

  RETURN QUERY SELECT
    v_xp_total,
    v_level,
    v_previous_xp_total,
    GREATEST(1, FLOOR(v_previous_xp_total::numeric / 120)::integer + 1),
    v_sessions_completed,
    v_topics_mastered;
END;
$$;
