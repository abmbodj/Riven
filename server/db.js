const Database = require('better-sqlite3');
const path = require('path');

// Use absolute path for database to ensure it works on all platforms
const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'flashcards.db');
const db = new Database(dbPath);

// Initialize database
function initDb() {
  // Users table
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      share_code TEXT UNIQUE,
      avatar TEXT,
      bio TEXT DEFAULT '',
      streak_data TEXT DEFAULT '{}',
      is_admin INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Folders table
  const createFoldersTable = `
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'folder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `;

  // Tags table
  const createTagsTable = `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      is_preset INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `;

  const createDecksTable = `
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      folder_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
    );
  `;

  const createCardsTable = `
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      difficulty INTEGER DEFAULT 0,
      times_reviewed INTEGER DEFAULT 0,
      times_correct INTEGER DEFAULT 0,
      last_reviewed DATETIME,
      next_review DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE
    );
  `;

  // Study sessions table
  const createStudySessionsTable = `
    CREATE TABLE IF NOT EXISTS study_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      cards_studied INTEGER DEFAULT 0,
      cards_correct INTEGER DEFAULT 0,
      duration_seconds INTEGER DEFAULT 0,
      session_type TEXT DEFAULT 'study',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE
    );
  `;

  // Junction table for deck tags
  const createDeckTagsTable = `
    CREATE TABLE IF NOT EXISTS deck_tags (
      deck_id INTEGER NOT NULL,
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (deck_id, tag_id),
      FOREIGN KEY (deck_id) REFERENCES decks (id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags (id) ON DELETE CASCADE
    );
  `;

  // Themes table - per user
  const createThemesTable = `
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      bg_color TEXT NOT NULL,
      surface_color TEXT NOT NULL,
      text_color TEXT NOT NULL,
      secondary_text_color TEXT NOT NULL,
      border_color TEXT NOT NULL,
      accent_color TEXT NOT NULL,
      is_active INTEGER DEFAULT 0,
      is_default INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `;

  // Shared decks table
  const createSharedDecksTable = `
    CREATE TABLE IF NOT EXISTS shared_decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      share_id TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      deck_id INTEGER NOT NULL,
      deck_data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `;

  db.exec(createUsersTable);
  db.exec(createFoldersTable);
  db.exec(createTagsTable);
  db.exec(createDecksTable);
  db.exec(createCardsTable);
  db.exec(createStudySessionsTable);
  db.exec(createDeckTagsTable);
  db.exec(createThemesTable);
  db.exec(createSharedDecksTable);

  // Add folder_id column to existing decks table if it doesn't exist
  try {
    db.exec('ALTER TABLE decks ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL');
  } catch (e) {
    // Column already exists
  }

  // Add user_id column to existing tables if they don't exist
  const tablesToAddUserId = ['decks', 'folders', 'tags', 'themes'];
  for (const table of tablesToAddUserId) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE`);
    } catch (e) {
      // Column already exists
    }
  }

  // Add is_default column to themes if it doesn't exist
  try {
    db.exec('ALTER TABLE themes ADD COLUMN is_default INTEGER DEFAULT 0');
  } catch (e) {
    // Column already exists
  }

  // Add last_studied column to decks table if it doesn't exist
  try {
    db.exec('ALTER TABLE decks ADD COLUMN last_studied DATETIME');
  } catch (e) {
    // Column already exists
  }

  // Add spaced repetition columns to cards if they don't exist
  const cardColumns = ['position', 'difficulty', 'times_reviewed', 'times_correct', 'last_reviewed', 'next_review'];
  for (const col of cardColumns) {
    try {
      if (col === 'position') {
        db.exec(`ALTER TABLE cards ADD COLUMN ${col} INTEGER DEFAULT 0`);
      } else if (['difficulty', 'times_reviewed', 'times_correct'].includes(col)) {
        db.exec(`ALTER TABLE cards ADD COLUMN ${col} INTEGER DEFAULT 0`);
      } else {
        db.exec(`ALTER TABLE cards ADD COLUMN ${col} DATETIME`);
      }
    } catch (e) {
      // Column already exists
    }
  }

  // Note: Tags and themes are created per-user during registration
  // No global seed data needed - each user gets their own tags/themes on signup
}

initDb();

module.exports = db;
