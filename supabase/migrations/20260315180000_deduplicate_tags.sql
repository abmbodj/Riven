-- Remove duplicate tags, keeping the one with the lowest id for each (user_id, name) pair.
-- Re-point deck_tags references from deleted duplicates to the surviving tag.

-- Step 1: Update deck_tags to point to the surviving (min-id) tag
UPDATE public.deck_tags dt
SET tag_id = keeper.min_id
FROM (
    SELECT user_id, LOWER(name) AS lname, MIN(id) AS min_id
    FROM public.tags
    GROUP BY user_id, LOWER(name)
) keeper
JOIN public.tags t ON t.user_id = keeper.user_id
                   AND LOWER(t.name) = keeper.lname
                   AND t.id <> keeper.min_id
WHERE dt.tag_id = t.id;

-- Step 2: Remove any deck_tags duplicates that may have been created by the update
DELETE FROM public.deck_tags a
USING public.deck_tags b
WHERE a.ctid > b.ctid
  AND a.deck_id = b.deck_id
  AND a.tag_id  = b.tag_id;

-- Step 3: Delete the duplicate tag rows
DELETE FROM public.tags
WHERE id NOT IN (
    SELECT MIN(id)
    FROM public.tags
    GROUP BY user_id, LOWER(name)
);

-- Step 4: Add unique constraint to prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_name_unique
    ON public.tags (user_id, LOWER(name));
