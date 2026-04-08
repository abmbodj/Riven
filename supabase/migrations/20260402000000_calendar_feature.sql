-- Calendar Feature Migration
-- Adds calendar_sources table, assignment_type column, and calendar_source_id FK

-- 1. Create calendar_sources table first (needed for FK below)
CREATE TABLE IF NOT EXISTS calendar_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('google', 'ical', 'canvas')),
    label TEXT NOT NULL,
    color TEXT,
    url TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE calendar_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own calendar sources"
    ON calendar_sources
    FOR ALL
    USING (public.get_app_user_id() = user_id)
    WITH CHECK (public.get_app_user_id() = user_id);

CREATE INDEX IF NOT EXISTS idx_calendar_sources_user_id ON calendar_sources(user_id);

-- 2. Add assignment_type to assignments
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS
    assignment_type TEXT DEFAULT 'assignment'
    CHECK (assignment_type IN ('assignment', 'quiz', 'exam', 'project', 'reading'));

-- 3. Add calendar_source_id to assignments (tracks external iCal events)
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS
    calendar_source_id UUID REFERENCES calendar_sources(id) ON DELETE CASCADE;
