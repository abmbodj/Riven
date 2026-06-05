-- Keep theme activation recoverable and atomic.

-- If multiple themes are active for one user, keep the best candidate active:
-- Riven default first, then any default, then the earliest row.
WITH ranked_active_themes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE
          WHEN name = 'Riven' AND COALESCE(is_default, 0) = 1 THEN 0
          WHEN COALESCE(is_default, 0) = 1 THEN 1
          ELSE 2
        END,
        id
    ) AS active_rank
  FROM public.themes
  WHERE user_id IS NOT NULL
    AND COALESCE(is_active, 0) = 1
)
UPDATE public.themes theme
SET is_active = 0
FROM ranked_active_themes ranked
WHERE theme.id = ranked.id
  AND ranked.active_rank > 1;

-- If a user has themes but no active theme, recover to Riven when available.
WITH fallback_active_themes AS (
  SELECT DISTINCT ON (candidate.user_id)
    candidate.id
  FROM public.themes candidate
  WHERE candidate.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.themes active
      WHERE active.user_id = candidate.user_id
        AND COALESCE(active.is_active, 0) = 1
    )
  ORDER BY
    candidate.user_id,
    CASE
      WHEN candidate.name = 'Riven' AND COALESCE(candidate.is_default, 0) = 1 THEN 0
      WHEN COALESCE(candidate.is_default, 0) = 1 THEN 1
      ELSE 2
    END,
    candidate.id
)
UPDATE public.themes theme
SET is_active = 1
FROM fallback_active_themes fallback
WHERE theme.id = fallback.id;

CREATE UNIQUE INDEX IF NOT EXISTS themes_one_active_per_user
  ON public.themes (user_id)
  WHERE user_id IS NOT NULL
    AND is_active = 1;

CREATE OR REPLACE FUNCTION public.activate_theme(target_theme_id integer)
RETURNS public.themes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id integer := public.get_app_user_id();
  activated_theme public.themes;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Theme not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT *
  INTO activated_theme
  FROM public.themes
  WHERE id = target_theme_id
    AND user_id = current_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Theme not found' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.themes
  SET is_active = 0
  WHERE user_id = current_user_id
    AND id <> target_theme_id
    AND COALESCE(is_active, 0) <> 0;

  UPDATE public.themes
  SET is_active = 1
  WHERE id = target_theme_id
    AND user_id = current_user_id
  RETURNING * INTO activated_theme;

  RETURN activated_theme;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_theme(integer) TO authenticated;
