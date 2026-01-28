const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Get all decks
app.get('/api/decks', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM decks ORDER BY created_at DESC');
        const decks = stmt.all();
        // Get card count for each deck
        const decksWithCount = decks.map(deck => {
            const countStmt = db.prepare('SELECT count(*) as count FROM cards WHERE deck_id = ?');
            const count = countStmt.get(deck.id).count;
            return { ...deck, cardCount: count };
        });
        res.json(decksWithCount);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a deck
app.post('/api/decks', (req, res) => {
    const { title, description } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const stmt = db.prepare('INSERT INTO decks (title, description) VALUES (?, ?)');
        const info = stmt.run(title, description || '');
        res.status(201).json({ id: info.lastInsertRowid, title, description });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a single deck with cards
app.get('/api/decks/:id', (req, res) => {
    const { id } = req.params;
    try {
        const deckStmt = db.prepare('SELECT * FROM decks WHERE id = ?');
        const deck = deckStmt.get(id);

        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        const cardsStmt = db.prepare('SELECT * FROM cards WHERE deck_id = ?');
        const cards = cardsStmt.all(id);

        res.json({ ...deck, cards });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a deck
app.delete('/api/decks/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM decks WHERE id = ?');
        const info = stmt.run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Deck not found' });
        res.json({ message: 'Deck deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a card to a deck
app.post('/api/decks/:id/cards', (req, res) => {
    const { id } = req.params;
    const { front, back } = req.body;

    if (!front || !back) return res.status(400).json({ error: 'Front and back are required' });

    try {
        // Check if deck exists
        const deck = db.prepare('SELECT id FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        const stmt = db.prepare('INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)');
        const info = stmt.run(id, front, back);
        res.status(201).json({ id: info.lastInsertRowid, deck_id: id, front, back });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a card
app.put('/api/cards/:id', (req, res) => {
    const { id } = req.params;
    const { front, back } = req.body;

    if (!front || !back) return res.status(400).json({ error: 'Front and back are required' });

    try {
        const stmt = db.prepare('UPDATE cards SET front = ?, back = ? WHERE id = ?');
        const info = stmt.run(front, back, id);
        if (info.changes === 0) return res.status(404).json({ error: 'Card not found' });
        res.json({ id, front, back });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a card
app.delete('/api/cards/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM cards WHERE id = ?');
        const info = stmt.run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Card not found' });
        res.json({ message: 'Card deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all themes
app.get('/api/themes', (req, res) => {
    try {
        const themes = db.prepare('SELECT * FROM themes').all();
        res.json(themes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a theme
app.post('/api/themes', (req, res) => {
    const { name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color } = req.body;
    try {
        const stmt = db.prepare('INSERT INTO themes (name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color) VALUES (?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color);
        res.status(201).json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set active theme
app.put('/api/themes/:id/activate', (req, res) => {
    const { id } = req.params;
    try {
        db.prepare('UPDATE themes SET is_active = 0').run();
        const info = db.prepare('UPDATE themes SET is_active = 1 WHERE id = ?').run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Theme not found' });
        res.json({ message: 'Theme activated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
