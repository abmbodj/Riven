const Database = require('better-sqlite3');
const path = require('path');

const db = new Database('flashcards.db', { verbose: console.log });

// Initialize database
function initDb() {
    const createDecksTable = `
    CREATE TABLE IF NOT EXISTS decks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    db.exec(createDecksTable);
    db.exec(createCardsTable);

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
