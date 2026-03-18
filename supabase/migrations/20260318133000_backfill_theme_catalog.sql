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
    ('Botanical Garden', '#0d1f14', '#142a1c', '#d4e8c2', '#7ab885', '#1e3d28', '#5cdb7a', 'Cormorant Garamond', 'Lora'),
    ('Desert Rose', '#1c0d12', '#28131a', '#f0d9c8', '#c4896e', '#3d1c26', '#e8856a', 'Lora', 'Lora'),
    ('Forest Canopy', '#0a1a0d', '#102015', '#c8e8c0', '#6aaa6e', '#1a3020', '#7dde82', 'Cormorant Garamond', 'Lora'),
    ('Golden Hour', '#1a0f00', '#261600', '#fce8c0', '#d4a055', '#3d2800', '#f5a623', 'Cormorant Garamond', 'Lora'),
    ('Midnight Galaxy', '#06030f', '#0e0820', '#e8e0ff', '#9b7fd4', '#1a1040', '#b06aff', 'Inter', 'Inter'),
    ('Modern Minimal', '#efeae3', '#fbf8f3', '#181512', '#70665d', '#d7cec2', '#c88259', 'Space Grotesk', 'Space Grotesk'),
    ('Ocean Depths', '#020d18', '#051828', '#c8f0f0', '#4db8c8', '#0a2840', '#00d4e8', 'Inter', 'Inter'),
    ('Sunset Blvd', '#1a0800', '#280d00', '#ffeee0', '#e87040', '#3d1500', '#ff6030', 'Cormorant Garamond', 'Lora'),
    ('Tech Innovation', '#061317', '#0b1d22', '#e7faf8', '#88a7ab', '#1f3a40', '#71d6ca', 'JetBrains Mono', 'Space Grotesk'),
    ('Rose', '#1a0020', '#280030', '#ffe0f5', '#ff80c8', '#3d0050', '#ff4da6', 'Inter', 'Inter')
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
          AND COALESCE(existing_active.is_active, FALSE)
      )
    THEN TRUE
    ELSE FALSE
  END AS is_active,
  TRUE AS is_default
FROM public.users AS users
CROSS JOIN theme_catalog
WHERE NOT EXISTS (
  SELECT 1
  FROM public.themes existing_theme
  WHERE existing_theme.user_id = users.id
    AND COALESCE(existing_theme.is_default, FALSE)
    AND existing_theme.name = theme_catalog.name
);
