-- Add FSRS (Free Spaced Repetition Scheduler) columns to cards table
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS stability REAL DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS fsrs_difficulty REAL DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS card_state TEXT DEFAULT 'new';
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS reps INTEGER DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS scheduled_days INTEGER DEFAULT 0;
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS learning_steps INTEGER DEFAULT 0;

-- Backfill existing reviewed cards to approximate FSRS state
UPDATE public.cards SET
    card_state = CASE
        WHEN COALESCE(times_reviewed, 0) = 0 THEN 'new'
        WHEN difficulty >= 3 THEN 'review'
        ELSE 'learning'
    END,
    stability = CASE
        WHEN difficulty = 0 THEN 0
        WHEN difficulty = 1 THEN 1
        WHEN difficulty = 2 THEN 3
        WHEN difficulty = 3 THEN 7
        WHEN difficulty = 4 THEN 14
        WHEN difficulty = 5 THEN 30
        ELSE 0
    END,
    fsrs_difficulty = CASE
        WHEN difficulty = 0 THEN 5.0
        WHEN difficulty = 1 THEN 6.0
        WHEN difficulty = 2 THEN 5.0
        WHEN difficulty = 3 THEN 4.0
        WHEN difficulty = 4 THEN 3.0
        WHEN difficulty = 5 THEN 2.0
        ELSE 5.0
    END,
    reps = COALESCE(times_reviewed, 0),
    lapses = GREATEST(0, COALESCE(times_reviewed, 0) - COALESCE(times_correct, 0))
WHERE card_state IS NULL OR card_state = 'new';

-- Index for FSRS state queries
CREATE INDEX IF NOT EXISTS idx_cards_card_state ON public.cards(card_state);
