-- Remove old pro themes that were re-inserted by stale client code
DELETE FROM public.themes
WHERE name IN (
    'Botanical Garden', 'Desert Rose', 'Forest Canopy', 'Golden Hour',
    'Midnight Galaxy', 'Ocean Depths', 'Sunset Blvd', 'Rose'
);
