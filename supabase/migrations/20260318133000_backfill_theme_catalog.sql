WITH theme_catalog (
  name,
  bg_color,
  surface_color,
  text_color,
  secondary_text_color,
  border_color,
  accent_color,
  font_family_display,
  font_family_body
) AS (
  VALUES
    ('Riven', '#162a31', '#1e3840', '#e4ddd0', '#8fa6a8', '#233e46', '#deb96a', 'Cormorant Garamond', 'Lora'),
    ('Riven Light', '#f5f0e8', '#ffffff', '#1e3840', '#6b7d7f', '#ddd5c8', '#deb96a', 'Cormorant Garamond', 'Lora'),
    ('Arctic Frost', '#eaf2f6', '#f9fdff', '#163038', '#607983', '#cad8de', '#89c3d4', 'Instrument Serif', 'Space Grotesk'),
    ('Modern Minimal', '#efeae3', '#fbf8f3', '#181512', '#70665d', '#d7cec2', '#c88259', 'Space Grotesk', 'Space Grotesk'),
    ('Tech Innovation', '#061317', '#0b1d22', '#e7faf8', '#88a7ab', '#1f3a40', '#71d6ca', 'JetBrains Mono', 'Space Grotesk')
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
  is_active,
  is_default
)
SELECT
  users.id,
  theme_catalog.name,
  theme_catalog.bg_color,
  theme_catalog.surface_color,
  theme_catalog.text_color,
  theme_catalog.secondary_text_color,
  theme_catalog.border_color,
  theme_catalog.accent_color,
  theme_catalog.font_family_display,
  theme_catalog.font_family_body,
  CASE
    WHEN theme_catalog.name = 'Riven'
      AND NOT EXISTS (
        SELECT 1
        FROM public.themes existing_active
        WHERE existing_active.user_id = users.id
          AND COALESCE(existing_active.is_active, 0) = 1
      )
    THEN 1
    ELSE 0
  END AS is_active,
  1 AS is_default
FROM public.users AS users
CROSS JOIN theme_catalog
WHERE NOT EXISTS (
  SELECT 1
  FROM public.themes existing_theme
  WHERE existing_theme.user_id = users.id
    AND COALESCE(existing_theme.is_default, 0) = 1
    AND existing_theme.name = theme_catalog.name
);
