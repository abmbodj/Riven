const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('flashcards.db', { verbose: console.log });

// Initialize database
function initDb() {
  // Folders table
  const createFoldersTable = `
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'folder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Tags table
  const createTagsTable = `
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      is_preset INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createDecksTable = `
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      folder_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folder_id) REFERENCES folders (id) ON DELETE SET NULL
    );
  `;

  const createCardsTable = `
    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deck_id INTEGER NOT NULL,
      front TEXT NOT NULL,
      back TEXT NOT NULL,
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

  const createThemesTable = `
    CREATE TABLE IF NOT EXISTS themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      bg_color TEXT NOT NULL,
      surface_color TEXT NOT NULL,
      text_color TEXT NOT NULL,
      secondary_text_color TEXT NOT NULL,
      border_color TEXT NOT NULL,
      accent_color TEXT NOT NULL,
      is_active INTEGER DEFAULT 0
    );
  `;

  db.exec(createFoldersTable);
  db.exec(createTagsTable);
  db.exec(createDecksTable);
  db.exec(createCardsTable);
  db.exec(createDeckTagsTable);
  db.exec(createThemesTable);

  // Add folder_id column to existing decks table if it doesn't exist
  try {
    db.exec('ALTER TABLE decks ADD COLUMN folder_id INTEGER REFERENCES folders(id) ON DELETE SET NULL');
  } catch (e) {
    // Column already exists
  }

  // Seed preset tags if empty
  const tagCount = db.prepare('SELECT count(*) as count FROM tags').get();
  if (tagCount.count === 0) {
    console.log('Seeding preset tags...');
    const insertTag = db.prepare('INSERT INTO tags (name, color, is_preset) VALUES (?, ?, 1)');
    insertTag.run('Language', '#3b82f6');
    insertTag.run('Science', '#22c55e');
    insertTag.run('Math', '#f59e0b');
    insertTag.run('History', '#8b5cf6');
    insertTag.run('Programming', '#06b6d4');
    insertTag.run('Medical', '#ef4444');
    insertTag.run('Business', '#ec4899');
    insertTag.run('Art', '#f97316');
  }

  // Seed default themes if empty
  const themeCount = db.prepare('SELECT count(*) as count FROM themes').get();
  if (themeCount.count === 0) {
    console.log('Seeding themes...');
    const insertTheme = db.prepare('INSERT INTO themes (name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');

    // Claude Dark
    insertTheme.run('Claude Dark', '#1a1a18', '#242422', '#e8e8e3', '#a1a19a', '#3d3d3a', '#d97757', 1);
    // Claude Light
    insertTheme.run('Claude Light', '#f9f7f2', '#ffffff', '#1d1d1b', '#6b6b6b', '#e5e2da', '#d97757', 0);
  }

  // Seed data if empty
  const deckCount = db.prepare('SELECT count(*) as count FROM decks').get();
  if (deckCount.count === 0) {
    console.log('Seeding database...');
    const insertDeck = db.prepare('INSERT INTO decks (title, description) VALUES (?, ?)');
    const insertCard = db.prepare('INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)');

    const info = insertDeck.run('Spanish Basics', 'Common Spanish words and phrases');
    const deckId = info.lastInsertRowid;

    insertCard.run(deckId, 'Hola', 'Hello');
    insertCard.run(deckId, 'Adiós', 'Goodbye');
    insertCard.run(deckId, 'Gracias', 'Thank you');
    insertCard.run(deckId, 'Por favor', 'Please');
    insertCard.run(deckId, 'Buenos días', 'Good morning');

    const info2 = insertDeck.run('JavaScript Concepts', 'Core JS interview questions');
    const deckId2 = info2.lastInsertRowid;
    insertCard.run(deckId2, 'Closure', 'A function bundled together with its lexical environment.');
    insertCard.run(deckId2, 'Hoisting', 'Variable and function declarations are moved to the top of their scope.');
    insertCard.run(deckId2, 'Event Loop', 'Mechanism that handles asynchronous callbacks in Node.js and browsers.');
  }
}

initDb();

module.exports = db;
