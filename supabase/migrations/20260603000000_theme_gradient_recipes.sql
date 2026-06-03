ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS background_style TEXT DEFAULT 'solid';

ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS gradient_colors JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS gradient_angle INTEGER DEFAULT 135;

ALTER TABLE public.themes
  ADD COLUMN IF NOT EXISTS gradient_intensity TEXT DEFAULT 'medium';

UPDATE public.themes
SET
  background_style = COALESCE(background_style, 'solid'),
  gradient_colors = COALESCE(gradient_colors, '[]'::jsonb),
  gradient_angle = COALESCE(gradient_angle, 135),
  gradient_intensity = COALESCE(gradient_intensity, 'medium')
WHERE background_style IS NULL
  OR gradient_colors IS NULL
  OR gradient_angle IS NULL
  OR gradient_intensity IS NULL;
