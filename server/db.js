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
    const pool = new Pool({
        connectionString: connectionString || 'postgres://test', // Fallback for test env if not set
        ssl: isProduction || process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Add display_name column if it doesn't exist (migration)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT
            `).catch(() => { });

            // Add pet_customization column if it doesn't exist (migration)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS pet_customization TEXT DEFAULT '{}'
            `).catch(() => { });

            // Add role column (migration: user | admin | owner)
            await client.query(`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user'
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
            await client.query(`ALTER TABLE classes ADD COLUMN IF NOT EXISTS canvas_id TEXT`).catch(() => { });
            await client.query(`ALTER TABLE assignments ADD COLUMN IF NOT EXISTS canvas_id TEXT`).catch(() => { });

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
                CREATE INDEX IF NOT EXISTS idx_shared_decks_user_id ON shared_decks(user_id)
            `);
            await client.query(`
                CREATE INDEX IF NOT EXISTS idx_shared_decks_share_id ON shared_decks(share_id)
            `);
        } catch (error) {
            console.error('Database initialization error:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // Initialize on startup
    if (process.env.NODE_ENV !== 'test') {
        initDb().catch(console.error);
    }
}

module.exports = db;
