ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS effect_preset TEXT DEFAULT 'none';

ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS effect_intensity TEXT DEFAULT 'soft';

UPDATE public.themes
SET
  effect_preset = CASE
    WHEN COALESCE(is_default, 0) = 1 THEN 'auto'
    ELSE 'none'
  END,
  effect_intensity = CASE
    WHEN COALESCE(is_default, 0) = 1 THEN 'medium'
    ELSE 'soft'
  END
WHERE effect_preset IS NULL OR effect_intensity IS NULL;
