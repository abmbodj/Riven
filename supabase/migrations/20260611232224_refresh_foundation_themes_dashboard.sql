-- Refresh the Foundation theme set for 2026.
-- Riven and Riven Light stay unchanged; the three older generic themes are
-- replaced with Manuscript, Deep Current, and Signal Glass.

WITH refreshed_theme_catalog AS (
  SELECT *
  FROM (
    VALUES
      (
        'Manuscript',
        '#f3eee3',
        '#fffaf1',
        '#211b16',
        '#75695b',
        '#d8cdbb',
        '#8a9b55',
        'Instrument Serif',
        'Lora',
        'dust',
        'soft',
        'gradient',
        '["#f3eee3", "#fffaf1", "#d9c8ac"]'::jsonb,
        145,
        'soft'
      ),
      (
        'Deep Current',
        '#071a1d',
        '#0f2a2d',
        '#e7f2eb',
        '#8ca9a5',
        '#1f4546',
        '#7bcbb8',
        'Cormorant Garamond',
        'Lora',
        'auto',
        'medium',
        'gradient',
        '["#061013", "#0a2c31", "#124d4c"]'::jsonb,
        160,
        'rich'
      ),
      (
        'Signal Glass',
        '#081114',
        '#101d20',
        '#e8f3ef',
        '#90a6a3',
        '#26383a',
        '#8be2d1',
        'JetBrains Mono',
        'Space Grotesk',
        'grid',
        'medium',
        'gradient',
        '["#071013", "#102026", "#17353a"]'::jsonb,
        135,
        'medium'
      )
  ) AS catalog(
    name,
    bg_color,
    surface_color,
    text_color,
    secondary_text_color,
    border_color,
    accent_color,
    font_family_display,
    font_family_body,
    effect_preset,
    effect_intensity,
    background_style,
    gradient_colors,
    gradient_angle,
    gradient_intensity
  )
)
UPDATE public.themes theme
SET
  bg_color = catalog.bg_color,
  surface_color = catalog.surface_color,
  text_color = catalog.text_color,
  secondary_text_color = catalog.secondary_text_color,
  border_color = catalog.border_color,
  accent_color = catalog.accent_color,
  font_family_display = catalog.font_family_display,
  font_family_body = catalog.font_family_body,
  effect_preset = catalog.effect_preset,
  effect_intensity = catalog.effect_intensity,
  background_style = catalog.background_style,
  gradient_colors = catalog.gradient_colors,
  gradient_angle = catalog.gradient_angle,
  gradient_intensity = catalog.gradient_intensity,
  is_default = 1
FROM refreshed_theme_catalog catalog
WHERE theme.user_id IS NOT NULL
  AND LOWER(theme.name) = LOWER(catalog.name)
  AND COALESCE(theme.is_default, 0) = 1;

WITH refreshed_theme_catalog AS (
  SELECT *
  FROM (
    VALUES
      ('Manuscript', '#f3eee3', '#fffaf1', '#211b16', '#75695b', '#d8cdbb', '#8a9b55', 'Instrument Serif', 'Lora', 'dust', 'soft', 'gradient', '["#f3eee3", "#fffaf1", "#d9c8ac"]'::jsonb, 145, 'soft'),
      ('Deep Current', '#071a1d', '#0f2a2d', '#e7f2eb', '#8ca9a5', '#1f4546', '#7bcbb8', 'Cormorant Garamond', 'Lora', 'auto', 'medium', 'gradient', '["#061013", "#0a2c31", "#124d4c"]'::jsonb, 160, 'rich'),
      ('Signal Glass', '#081114', '#101d20', '#e8f3ef', '#90a6a3', '#26383a', '#8be2d1', 'JetBrains Mono', 'Space Grotesk', 'grid', 'medium', 'gradient', '["#071013", "#102026", "#17353a"]'::jsonb, 135, 'medium')
  ) AS catalog(name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, font_family_display, font_family_body, effect_preset, effect_intensity, background_style, gradient_colors, gradient_angle, gradient_intensity)
)
INSERT INTO public.themes (
  user_id,
  name,
  bg_color,
  surface_color,
  text_color,
  secondary_text_color,
  border_color,
  accent_color,
  font_family_display,
  font_family_body,
  effect_preset,
  effect_intensity,
  background_style,
  gradient_colors,
  gradient_angle,
  gradient_intensity,
  is_active,
  is_default
)
SELECT
  users.id,
  catalog.name,
  catalog.bg_color,
  catalog.surface_color,
  catalog.text_color,
  catalog.secondary_text_color,
  catalog.border_color,
  catalog.accent_color,
  catalog.font_family_display,
  catalog.font_family_body,
  catalog.effect_preset,
  catalog.effect_intensity,
  catalog.background_style,
  catalog.gradient_colors,
  catalog.gradient_angle,
  catalog.gradient_intensity,
  0,
  1
FROM public.users
CROSS JOIN refreshed_theme_catalog catalog
WHERE NOT EXISTS (
  SELECT 1
  FROM public.themes existing
  WHERE existing.user_id = users.id
    AND LOWER(existing.name) = LOWER(catalog.name)
);

WITH replacement_map AS (
  SELECT *
  FROM (
    VALUES
      ('Arctic Frost', 'Deep Current'),
      ('Modern Minimal', 'Manuscript'),
      ('Tech Innovation', 'Signal Glass')
  ) AS replacements(old_name, new_name)
),
active_replacements AS (
  SELECT replacement.id
  FROM public.themes old_theme
  JOIN replacement_map map
    ON old_theme.name = map.old_name
  JOIN public.themes replacement
    ON replacement.user_id = old_theme.user_id
   AND replacement.name = map.new_name
   AND COALESCE(replacement.is_default, 0) = 1
  WHERE COALESCE(old_theme.is_default, 0) = 1
    AND COALESCE(old_theme.is_active, 0) = 1
)
UPDATE public.themes theme
SET is_active = 0
WHERE theme.user_id IN (
  SELECT replacement.user_id
  FROM public.themes replacement
  JOIN active_replacements active
    ON active.id = replacement.id
)
AND theme.id NOT IN (SELECT id FROM active_replacements);

WITH replacement_map AS (
  SELECT *
  FROM (
    VALUES
      ('Arctic Frost', 'Deep Current'),
      ('Modern Minimal', 'Manuscript'),
      ('Tech Innovation', 'Signal Glass')
  ) AS replacements(old_name, new_name)
),
active_replacements AS (
  SELECT replacement.id
  FROM public.themes old_theme
  JOIN replacement_map map
    ON old_theme.name = map.old_name
  JOIN public.themes replacement
    ON replacement.user_id = old_theme.user_id
   AND replacement.name = map.new_name
   AND COALESCE(replacement.is_default, 0) = 1
  WHERE COALESCE(old_theme.is_default, 0) = 1
    AND COALESCE(old_theme.is_active, 0) = 1
)
UPDATE public.themes theme
SET is_active = 1
WHERE theme.id IN (SELECT id FROM active_replacements);

DELETE FROM public.themes
WHERE COALESCE(is_default, 0) = 1
  AND name IN ('Arctic Frost', 'Modern Minimal', 'Tech Innovation');

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
