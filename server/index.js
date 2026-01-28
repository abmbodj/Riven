const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ============ FOLDERS ============

// Get all folders with deck counts
app.get('/api/folders', (req, res) => {
    try {
        const folders = db.prepare('SELECT * FROM folders ORDER BY created_at DESC').all();
        const foldersWithCount = folders.map(folder => {
            const count = db.prepare('SELECT count(*) as count FROM decks WHERE folder_id = ?').get(folder.id).count;
            return { ...folder, deckCount: count };
        });
        res.json(foldersWithCount);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a folder
app.post('/api/folders', (req, res) => {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    try {
        const stmt = db.prepare('INSERT INTO folders (name, color, icon) VALUES (?, ?, ?)');
        const info = stmt.run(name, color || '#6366f1', icon || 'folder');
        res.status(201).json({ id: info.lastInsertRowid, name, color: color || '#6366f1', icon: icon || 'folder' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a folder
app.put('/api/folders/:id', (req, res) => {
    const { id } = req.params;
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    try {
        const stmt = db.prepare('UPDATE folders SET name = ?, color = ?, icon = ? WHERE id = ?');
        const info = stmt.run(name, color, icon, id);
        if (info.changes === 0) return res.status(404).json({ error: 'Folder not found' });
        res.json({ id, name, color, icon });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a folder
app.delete('/api/folders/:id', (req, res) => {
    const { id } = req.params;
    try {
        const stmt = db.prepare('DELETE FROM folders WHERE id = ?');
        const info = stmt.run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Folder not found' });
        res.json({ message: 'Folder deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ TAGS ============

// Get all tags
app.get('/api/tags', (req, res) => {
    try {
        const tags = db.prepare('SELECT * FROM tags ORDER BY is_preset DESC, name ASC').all();
        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a tag
app.post('/api/tags', (req, res) => {
    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'Name and color are required' });
    
    try {
        const stmt = db.prepare('INSERT INTO tags (name, color, is_preset) VALUES (?, ?, 0)');
        const info = stmt.run(name, color);
        res.status(201).json({ id: info.lastInsertRowid, name, color, is_preset: 0 });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Tag already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Delete a tag (only custom tags)
app.delete('/api/tags/:id', (req, res) => {
    const { id } = req.params;
    try {
        const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
        if (!tag) return res.status(404).json({ error: 'Tag not found' });
        if (tag.is_preset) return res.status(400).json({ error: 'Cannot delete preset tags' });
        
        db.prepare('DELETE FROM tags WHERE id = ?').run(id);
        res.json({ message: 'Tag deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ DECKS ============

// Get all decks with tags
app.get('/api/decks', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM decks ORDER BY created_at DESC');
        const decks = stmt.all();
        
        const decksWithDetails = decks.map(deck => {
            const countStmt = db.prepare('SELECT count(*) as count FROM cards WHERE deck_id = ?');
            const count = countStmt.get(deck.id).count;
            
            // Get tags for this deck
            const tags = db.prepare(`
                SELECT t.* FROM tags t
                JOIN deck_tags dt ON t.id = dt.tag_id
                WHERE dt.deck_id = ?
            `).all(deck.id);
            
            return { ...deck, cardCount: count, tags };
        });
        res.json(decksWithDetails);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a deck
app.post('/api/decks', (req, res) => {
    const { title, description, folder_id, tagIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const stmt = db.prepare('INSERT INTO decks (title, description, folder_id) VALUES (?, ?, ?)');
        const info = stmt.run(title, description || '', folder_id || null);
        const deckId = info.lastInsertRowid;
        
        // Add tags
        if (tagIds && tagIds.length > 0) {
            const insertTag = db.prepare('INSERT INTO deck_tags (deck_id, tag_id) VALUES (?, ?)');
            tagIds.forEach(tagId => insertTag.run(deckId, tagId));
        }
        
        res.status(201).json({ id: deckId, title, description, folder_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get a single deck with cards and tags
app.get('/api/decks/:id', (req, res) => {
    const { id } = req.params;
    try {
        const deckStmt = db.prepare('SELECT * FROM decks WHERE id = ?');
        const deck = deckStmt.get(id);

        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        const cardsStmt = db.prepare('SELECT * FROM cards WHERE deck_id = ?');
        const cards = cardsStmt.all(id);
        
        const tags = db.prepare(`
            SELECT t.* FROM tags t
            JOIN deck_tags dt ON t.id = dt.tag_id
            WHERE dt.deck_id = ?
        `).all(id);

        res.json({ ...deck, cards, tags });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a deck
app.put('/api/decks/:id', (req, res) => {
    const { id } = req.params;
    const { title, description, folder_id, tagIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const stmt = db.prepare('UPDATE decks SET title = ?, description = ?, folder_id = ? WHERE id = ?');
        const info = stmt.run(title, description || '', folder_id || null, id);
        if (info.changes === 0) return res.status(404).json({ error: 'Deck not found' });
        
        // Update tags if provided
        if (tagIds !== undefined) {
            db.prepare('DELETE FROM deck_tags WHERE deck_id = ?').run(id);
            if (tagIds.length > 0) {
                const insertTag = db.prepare('INSERT INTO deck_tags (deck_id, tag_id) VALUES (?, ?)');
                tagIds.forEach(tagId => insertTag.run(id, tagId));
            }
        }
        
        res.json({ id, title, description, folder_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Move deck to folder
app.put('/api/decks/:id/move', (req, res) => {
    const { id } = req.params;
    const { folder_id } = req.body;
    
    try {
        const stmt = db.prepare('UPDATE decks SET folder_id = ? WHERE id = ?');
        const info = stmt.run(folder_id || null, id);
        if (info.changes === 0) return res.status(404).json({ error: 'Deck not found' });
        res.json({ id, folder_id });
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
