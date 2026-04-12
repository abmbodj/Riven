const db = require('../db');

async function run() {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        await client.query(`
            ALTER TABLE study_sessions
                ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS guide_id UUID REFERENCES study_guides(id) ON DELETE CASCADE,
                ADD COLUMN IF NOT EXISTS class_id UUID DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS source TEXT DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ DEFAULT NULL,
                ADD COLUMN IF NOT EXISTS xp_earned INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS mastery_delta INTEGER NOT NULL DEFAULT 0,
                ADD COLUMN IF NOT EXISTS weak_area_delta JSONB NOT NULL DEFAULT '{}'::jsonb
        `);

        await client.query(`
            UPDATE study_sessions
            SET user_id = decks.user_id
            FROM decks
            WHERE study_sessions.user_id IS NULL
              AND study_sessions.deck_id = decks.id
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id
            ON study_sessions(user_id, created_at DESC)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_study_sessions_guide_id
            ON study_sessions(guide_id, created_at DESC)
        `);

        await client.query('COMMIT');
        console.log('Study session schema backfill complete.');
    } catch (error) {
        try {
            await client.query('ROLLBACK');
        } catch (rbErr) {
            console.error('ROLLBACK failed:', rbErr);
        }
        console.error('Failed to backfill study_sessions schema:', error);
        process.exitCode = 1;
    } finally {
        client.release();
    }
}

run().finally(() => db.pool.end());
