const { Pool } = require('pg');

// PostgreSQL connection (Supabase)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('FATAL: DATABASE_URL environment variable is required');
    process.exit(1);
}

const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

// Helper to create a clean interface
const db = {
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
                email TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                share_code TEXT UNIQUE,
                avatar TEXT,
                bio TEXT DEFAULT '',
                streak_data TEXT DEFAULT '{}',
                is_admin INTEGER DEFAULT 0,
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
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                position INTEGER DEFAULT 0,
                difficulty INTEGER DEFAULT 0,
                times_reviewed INTEGER DEFAULT 0,
                times_correct INTEGER DEFAULT 0,
                last_reviewed TIMESTAMP,
                next_review TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

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
                is_active INTEGER DEFAULT 0,
                is_default INTEGER DEFAULT 0
            )
        `);

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

        console.log('Database schema initialized');
    } catch (error) {
        console.error('Database initialization error:', error);
        throw error;
    } finally {
        client.release();
    }
}

// Initialize on startup
initDb().catch(console.error);

module.exports = db;
