-- Remove duplicate themes, keeping the best row per (user_id, name).
-- Prefer the active theme, then the earliest-created row.

DELETE FROM public.themes
WHERE id NOT IN (
    SELECT DISTINCT ON (user_id, LOWER(name))
           id
    FROM public.themes
    ORDER BY user_id, LOWER(name), is_active DESC NULLS LAST, id ASC
);

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS themes_user_id_name_unique
    ON public.themes (user_id, LOWER(name));
