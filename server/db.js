const { Pool } = require('pg');

let db;

// Allow injection of mock for testing
if (global.__TEST_DB_MOCK__) {
    db = global.__TEST_DB_MOCK__;
} else {
    // PostgreSQL connection (Supabase)
    const connectionString = process.env.DATABASE_URL;


    if (!connectionString && process.env.NODE_ENV !== 'test') {
        console.error('FATAL: DATABASE_URL environment variable is required');
        process.exit(1);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const needsSsl = isProduction || process.env.DB_SSL === 'true';
    const pool = new Pool({
        connectionString: connectionString || 'postgres://test', // Fallback for test env if not set
        ssl: needsSsl ? { rejectUnauthorized: false } : false,
        // Serverless-friendly: short idle timeout so connections don't linger
        idleTimeoutMillis: isProduction ? 20000 : 30000,
        connectionTimeoutMillis: 5000,
        max: isProduction ? 15 : 10,
    });

    // Handle unexpected pool errors to prevent silent crashes
    pool.on('error', (err) => {
        console.error('[DB] Unexpected pool error:', err.message);
    });

    // Helper to create a clean interface
    db = {
        // Execute a query and return all rows
        query: async (text, params) => {
            const result = await pool.query(text, params);
            return result.rows;
        },

        // Execute a query and return first row
        queryOne: async (text, params) => {
            const result = await pool.query(text, params);
            return result.rows[0];
        },

        // Execute a query and return the result (for INSERT/UPDATE/DELETE)
        execute: async (text, params) => {
            const result = await pool.query(text, params);
            return result;
        },

        // Get the pool for transactions
        pool
    };

    // Initialize database schema
    async function initDb() {
        const client = await pool.connect();

        try {
            // Users table
            await client.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    username TEXT NOT NULL UNIQUE,
                    display_name TEXT,
                    email TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    share_code TEXT UNIQUE,
                    avatar TEXT,
                    bio TEXT DEFAULT '',
                    streak_data TEXT DEFAULT '{}',
                    pet_customization TEXT DEFAULT '{}',
                    is_admin INTEGER DEFAULT 0,
                    subscription_tier TEXT DEFAULT 'free',
                    hearts INTEGER DEFAULT -1,
                    last_heart_refill TIMESTAMP,
                    ai_generations_count INTEGER DEFAULT 0,
                    last_ai_generation_reset TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add display_name column if it doesn't exist (migration)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT
            `).catch(() => { });

            // Add banner column (migration)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS banner TEXT
            `).catch(() => { });

            // Add pet_customization column if it doesn't exist (migration)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS pet_customization TEXT DEFAULT '{}'
            `).catch(() => { });

            // Add monetization columns (migration)
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS simulate_free_tier BOOLEAN DEFAULT FALSE`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS hearts INTEGER DEFAULT -1`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_heart_refill TIMESTAMP`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_generations_count INTEGER DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ai_generation_reset TIMESTAMP`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT`).catch(() => { });

            // Add role column (migration: user | admin | owner)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
            `).catch(() => { });

            // Add is_banned column (migration)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE
            `).catch(() => { });

            // Migrate: promote existing is_admin=1 users to 'admin' role if still 'user'
            await client.query(`
                UPDATE users SET role = 'admin' WHERE is_admin = 1 AND role = 'user'
            `).catch(() => { });

            // Auto-promote the first admin to 'owner' if no owner exists yet
            const ownerExists = await client.query(`SELECT id FROM users WHERE role = 'owner' LIMIT 1`);
            if (ownerExists.rows.length === 0) {
                await client.query(`
                    UPDATE users SET role = 'owner' WHERE id = (
                        SELECT id FROM users WHERE is_admin = 1 ORDER BY id ASC LIMIT 1
                    )
                `).catch(() => { });
            }

            // Add 2FA columns (migration)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret TEXT
            `).catch(() => { });
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT FALSE
            `).catch(() => { });

            // Referral system columns
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by INTEGER REFERENCES users(id)`).catch(() => { });

            // Referrals tracking table
            await client.query(`
                CREATE TABLE IF NOT EXISTS referrals (
                    id SERIAL PRIMARY KEY,
                    referrer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    referred_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    has_deck BOOLEAN DEFAULT FALSE,
                    session_count INTEGER DEFAULT 0,
                    qualified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(referrer_id, referred_id)
                )
            `);

            // Classes table
            await client.query(`
                CREATE TABLE IF NOT EXISTS classes (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    color TEXT,
                    professor TEXT,
                    room TEXT,
                    zoom_link TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Assignments table
            await client.query(`
                CREATE TABLE IF NOT EXISTS assignments (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    description TEXT,
                    status TEXT DEFAULT 'Todo',
                    due_date TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add Canvas integration columns (migration)
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_url TEXT`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_token TEXT`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_ical_url TEXT`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_auto_sync_enabled BOOLEAN DEFAULT FALSE`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_canvas_sync_at TIMESTAMPTZ`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_canvas_auto_sync_attempt_at TIMESTAMPTZ`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS last_canvas_auto_sync_error TEXT`).catch(() => { });
            await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS canvas_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS canvas_id TEXT`).catch(() => { });
            await client.query(`
                UPDATE users
                SET canvas_auto_sync_enabled = TRUE
                WHERE canvas_ical_url IS NOT NULL
            `).catch(() => { });

            // Add Edlink integration columns (migration)
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS edlink_access_token TEXT`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS edlink_refresh_token TEXT`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS edlink_person_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS edlink_course_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS edlink_assignment_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE`).catch(() => { });

            // Canvas direct integration columns
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_api_url TEXT`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS canvas_api_token TEXT`).catch(() => { });
            await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS canvas_course_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS subject TEXT`).catch(() => { });
            await client.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS canvas_assignment_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'homework'`).catch(() => { });

            // Schedule slots table
            await client.query(`
                CREATE TABLE IF NOT EXISTS schedule_slots (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
                    day_of_week INTEGER NOT NULL,
                    start_time TIME NOT NULL,
                    end_time TIME NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Folders table
            await client.query(`
                CREATE TABLE IF NOT EXISTS folders (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    color TEXT DEFAULT '#6366f1',
                    icon TEXT DEFAULT 'folder',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Tags table
            await client.query(`
                CREATE TABLE IF NOT EXISTS tags (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    color TEXT NOT NULL,
                    is_preset INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS tags_user_id_name_unique
                    ON tags (user_id, LOWER(name))
            `);

            // Decks table
            await client.query(`
                CREATE TABLE IF NOT EXISTS decks (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    title TEXT NOT NULL,
                    description TEXT,
                    folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL,
                    last_studied TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Cards table
            await client.query(`
                CREATE TABLE IF NOT EXISTS cards (
                    id SERIAL PRIMARY KEY,
                    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                    front TEXT DEFAULT '',
                    back TEXT DEFAULT '',
                    front_image TEXT,
                    back_image TEXT,
                    position INTEGER DEFAULT 0,
                    difficulty INTEGER DEFAULT 0,
                    times_reviewed INTEGER DEFAULT 0,
                    times_correct INTEGER DEFAULT 0,
                    last_reviewed TIMESTAMP,
                    next_review TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add card image columns if they don't exist (migration)
            await client.query(`
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS front_image TEXT
            `).catch(() => { });
            await client.query(`
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS back_image TEXT
            `).catch(() => { });

            // Allow null text when image exists (migration)
            await client.query(`
                ALTER TABLE cards ALTER COLUMN front DROP NOT NULL
            `).catch(() => { });
            await client.query(`
                ALTER TABLE cards ALTER COLUMN back DROP NOT NULL
            `).catch(() => { });

            await client.query(`
                ALTER TABLE decks ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL
            `).catch(() => { });

            // FSRS columns for spaced repetition
            await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS stability REAL DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS fsrs_difficulty REAL DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS card_state TEXT DEFAULT 'new'`).catch(() => { });
            await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS reps INTEGER DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS lapses INTEGER DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS scheduled_days INTEGER DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE cards ADD COLUMN IF NOT EXISTS learning_steps INTEGER DEFAULT 0`).catch(() => { });

            // Study sessions table
            await client.query(`
                CREATE TABLE IF NOT EXISTS study_sessions (
                    id SERIAL PRIMARY KEY,
                    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                    cards_studied INTEGER DEFAULT 0,
                    cards_correct INTEGER DEFAULT 0,
                    duration_seconds INTEGER DEFAULT 0,
                    session_type TEXT DEFAULT 'study',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Study Groups tables
            await client.query(`
                CREATE TABLE IF NOT EXISTS study_groups (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  name TEXT NOT NULL,
                  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
                  join_code TEXT UNIQUE NOT NULL,
                  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  created_at TIMESTAMPTZ DEFAULT now()
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS group_members (
                  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
                  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  role TEXT DEFAULT 'member',
                  joined_at TIMESTAMPTZ DEFAULT now(),
                  PRIMARY KEY (group_id, user_id)
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS group_decks (
                  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
                  deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                  shared_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  shared_at TIMESTAMPTZ DEFAULT now(),
                  PRIMARY KEY (group_id, deck_id)
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS group_folders (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
                  name TEXT NOT NULL,
                  created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  created_at TIMESTAMPTZ DEFAULT now()
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS group_files (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
                  folder_id UUID REFERENCES group_folders(id) ON DELETE CASCADE,
                  name TEXT NOT NULL,
                  file_url TEXT NOT NULL,
                  file_type TEXT NOT NULL,
                  uploaded_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  uploaded_at TIMESTAMPTZ DEFAULT now()
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS cram_sessions (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  group_id UUID REFERENCES study_groups(id) ON DELETE CASCADE,
                  deck_id INTEGER REFERENCES decks(id) ON DELETE CASCADE,
                  started_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  started_at TIMESTAMPTZ DEFAULT now(),
                  ended_at TIMESTAMPTZ,
                  status TEXT DEFAULT 'active'
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS cram_responses (
                  session_id UUID REFERENCES cram_sessions(id) ON DELETE CASCADE,
                  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                  card_id INTEGER REFERENCES cards(id) ON DELETE CASCADE,
                  knew_it BOOLEAN NOT NULL,
                  responded_at TIMESTAMPTZ DEFAULT now(),
                  PRIMARY KEY (session_id, user_id, card_id)
                )
            `);

            // Deck tags junction table
            await client.query(`
                CREATE TABLE IF NOT EXISTS deck_tags (
                    deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
                    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
                    PRIMARY KEY (deck_id, tag_id)
                )
            `);

            // Themes table
            await client.query(`
                CREATE TABLE IF NOT EXISTS themes (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    bg_color TEXT NOT NULL,
                    surface_color TEXT NOT NULL,
                    text_color TEXT NOT NULL,
                    secondary_text_color TEXT NOT NULL,
                    border_color TEXT NOT NULL,
                    accent_color TEXT NOT NULL,
                    font_family_display TEXT DEFAULT 'Cormorant Garamond',
                    font_family_body TEXT DEFAULT 'Lora',
                    effect_preset TEXT DEFAULT 'none',
                    effect_intensity TEXT DEFAULT 'soft',
                    is_active INTEGER DEFAULT 0,
                    is_default INTEGER DEFAULT 0
                )
            `);

            // Add font columns if they don't exist (migration)
            await client.query(`
                ALTER TABLE themes ADD COLUMN IF NOT EXISTS font_family_display TEXT DEFAULT 'Cormorant Garamond'
            `).catch(() => { });
            await client.query(`
                ALTER TABLE themes ADD COLUMN IF NOT EXISTS font_family_body TEXT DEFAULT 'Lora'
            `).catch(() => { });
            await client.query(`
                ALTER TABLE themes ADD COLUMN IF NOT EXISTS effect_preset TEXT DEFAULT 'none'
            `).catch(() => { });
            await client.query(`
                ALTER TABLE themes ADD COLUMN IF NOT EXISTS effect_intensity TEXT DEFAULT 'soft'
            `).catch(() => { });

            // Shared decks table
            await client.query(`
                CREATE TABLE IF NOT EXISTS shared_decks (
                    id SERIAL PRIMARY KEY,
                    share_id TEXT UNIQUE NOT NULL,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    deck_id INTEGER NOT NULL,
                    deck_data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Global messages/announcements table (admin broadcasts)
            await client.query(`
                CREATE TABLE IF NOT EXISTS global_messages (
                    id SERIAL PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    type TEXT DEFAULT 'info',
                    is_active INTEGER DEFAULT 1,
                    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    expires_at TIMESTAMP
                )
            `);

            // Track which users have dismissed which messages
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_dismissed_messages (
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    message_id INTEGER NOT NULL REFERENCES global_messages(id) ON DELETE CASCADE,
                    dismissed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, message_id)
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS feedback_submissions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    is_favorited BOOLEAN DEFAULT FALSE,
                    considering_notified_at TIMESTAMP,
                    considering_notified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS user_notifications (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    kind TEXT NOT NULL,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    metadata JSONB DEFAULT '{}'::jsonb,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    dismissed_at TIMESTAMP
                )
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_feedback_submissions_created_at
                ON feedback_submissions (created_at DESC)
            `).catch(() => { });

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_feedback_submissions_favorited_created_at
                ON feedback_submissions (is_favorited, created_at DESC)
            `).catch(() => { });

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_user_notifications_user_created_at
                ON user_notifications (user_id, created_at DESC)
            `).catch(() => { });

            await client.query(`
                CREATE TABLE IF NOT EXISTS user_push_devices (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    installation_id TEXT NOT NULL UNIQUE,
                    platform TEXT NOT NULL,
                    push_token TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    last_seen_at TIMESTAMPTZ DEFAULT now(),
                    last_registered_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            `);

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_user_push_devices_user_active
                ON user_push_devices (user_id, is_active, platform)
            `).catch(() => { });

            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_user_push_devices_active_seen
                ON user_push_devices (is_active, last_seen_at DESC)
            `).catch(() => { });

            await client.query(`
                CREATE TABLE IF NOT EXISTS user_push_preferences (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    messages_enabled BOOLEAN DEFAULT TRUE,
                    streak_enabled BOOLEAN DEFAULT TRUE,
                    reengagement_enabled BOOLEAN DEFAULT TRUE,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            `);

            await client.query(`
                CREATE TABLE IF NOT EXISTS user_push_engagement_state (
                    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                    last_streak_reminder_marker TEXT,
                    last_inactivity_stage_sent INTEGER,
                    created_at TIMESTAMPTZ DEFAULT now(),
                    updated_at TIMESTAMPTZ DEFAULT now()
                )
            `);

            // Friendships table
            await client.query(`
                CREATE TABLE IF NOT EXISTS friendships (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    friend_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    status TEXT DEFAULT 'pending',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, friend_id)
                )
            `);

            // Direct messages table
            await client.query(`
                CREATE TABLE IF NOT EXISTS messages (
                    id SERIAL PRIMARY KEY,
                    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    receiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    content TEXT NOT NULL,
                    message_type TEXT DEFAULT 'text',
                    deck_data TEXT,
                    image_url TEXT,
                    is_edited INTEGER DEFAULT 0,
                    is_read INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add messaging enhancement columns if they don't exist (migration)
            await client.query(`
                ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT
            `).catch(() => { });
            await client.query(`
                ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_edited INTEGER DEFAULT 0
            `).catch(() => { });

            // Password reset tokens table
            await client.query(`
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    used BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Email verification tokens table
            await client.query(`
                CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token TEXT NOT NULL UNIQUE,
                    expires_at TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add email_verified column to users
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`).catch(() => { });

            // Practice refill tracking (persisted instead of in-memory)
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS practice_refill_count INTEGER DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS practice_refill_reset_at TIMESTAMP`).catch(() => { });

            // Stripe webhook idempotency table
            await client.query(`
                CREATE TABLE IF NOT EXISTS stripe_processed_events (
                    event_id TEXT PRIMARY KEY,
                    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // User Blocks table
            await client.query(`
                CREATE TABLE IF NOT EXISTS user_blocks (
                    id SERIAL PRIMARY KEY,
                    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(blocker_id, blocked_id)
                )
            `);

            // Reports table
            await client.query(`
                CREATE TABLE IF NOT EXISTS reports (
                    id SERIAL PRIMARY KEY,
                    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    reported_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                    content_type TEXT NOT NULL, -- 'user', 'message', 'group'
                    content_id TEXT, -- ID of the message or group (can be UUID or int, so we use TEXT)
                    reason TEXT NOT NULL,
                    details TEXT,
                    status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'closed'
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    resolved_at TIMESTAMP,
                    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
                )
            `);

            // Ad rewards table (rewarded ads system)
            await client.query(`
                CREATE TABLE IF NOT EXISTS ad_rewards (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    feature TEXT NOT NULL,
                    reward_token TEXT UNIQUE,
                    status TEXT DEFAULT 'pending',
                    granted_value TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    completed_at TIMESTAMP,
                    expires_at TIMESTAMP
                )
            `);

            // Ad reward user columns (migration)
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_watches_today INTEGER DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS ad_watches_reset_at TIMESTAMP`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_trial_id INTEGER`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_trial_expires_at TIMESTAMP`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lms_sync_count INTEGER DEFAULT 0`).catch(() => { });
            await client.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS lms_sync_reset_at TIMESTAMP`).catch(() => { });

            // Remove duplicate Canvas assignments before adding the unique index.
            await client.query(`
                WITH duplicate_assignments AS (
                    SELECT ctid
                    FROM (
                        SELECT
                            ctid,
                            ROW_NUMBER() OVER (
                                PARTITION BY user_id, canvas_assignment_id
                                ORDER BY created_at ASC, id ASC
                            ) AS row_num
                        FROM assignments
                        WHERE canvas_assignment_id IS NOT NULL
                    ) ranked
                    WHERE row_num > 1
                )
                DELETE FROM assignments assignments_to_delete
                USING duplicate_assignments
                WHERE assignments_to_delete.ctid = duplicate_assignments.ctid
            `).catch(() => { });

            // Database schema initialized successfully

            // Create indexes for performance optimization
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC)
            `);

            // Composite indexes for message query performance
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_conversation
                ON messages(sender_id, receiver_id, created_at DESC)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_unread
                ON messages(receiver_id, sender_id, is_read) WHERE is_read = 0
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_messages_participants
                ON messages(sender_id, created_at DESC)
            `);

            // Create indexes for performance optimization
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_cards_deck_id ON cards(deck_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_cards_next_review ON cards(next_review) WHERE next_review IS NOT NULL
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_decks_folder_id ON decks(folder_id) WHERE folder_id IS NOT NULL
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_deck_tags_deck_id ON deck_tags(deck_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_deck_tags_tag_id ON deck_tags(tag_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_study_sessions_deck_id ON study_sessions(deck_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_folders_user_id ON folders(user_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id)
            `);
            await client.query(`
                CREATE UNIQUE INDEX IF NOT EXISTS assignments_user_canvas_assignment_unique
                ON assignments(user_id, canvas_assignment_id)
                WHERE canvas_assignment_id IS NOT NULL
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS users_canvas_auto_sync_due_idx
                ON users(canvas_auto_sync_enabled, last_canvas_sync_at)
                WHERE canvas_ical_url IS NOT NULL
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_shared_decks_user_id ON shared_decks(user_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_shared_decks_share_id ON shared_decks(share_id)
            `);

            // Indexes for ad rewards
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_ad_rewards_user_id ON ad_rewards(user_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_ad_rewards_token ON ad_rewards(reward_token)
            `);

            // Indexes for blocks and reports
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON user_blocks(blocker_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)
            `);
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Initialize on startup (with guard for serverless cold starts)
    let _initPromise = null;
    if (process.env.NODE_ENV !== 'test') {
        _initPromise = initDb().catch(err => {
            console.error('initDb failed:', err.message);
            _initPromise = null; // Allow retry on next cold start
        });
    }

    // Expose a way to await init completion (useful for serverless first-request)
    db.ready = () => _initPromise || Promise.resolve();
}

module.exports = db;
