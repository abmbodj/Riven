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

// Update card difficulty (for spaced repetition)
app.put('/api/cards/:id/review', (req, res) => {
    const { id } = req.params;
    const { correct, difficulty } = req.body;

    try {
        const card = db.prepare('SELECT * FROM cards WHERE id = ?').get(id);
        if (!card) return res.status(404).json({ error: 'Card not found' });

        const timesReviewed = (card.times_reviewed || 0) + 1;
        const timesCorrect = (card.times_correct || 0) + (correct ? 1 : 0);
        
        // Calculate next review date based on difficulty (0-5 scale)
        // Higher difficulty = shorter interval
        const intervals = [1, 3, 7, 14, 30, 60]; // days
        const newDifficulty = Math.max(0, Math.min(5, difficulty !== undefined ? difficulty : (correct ? Math.max(0, (card.difficulty || 0) - 1) : Math.min(5, (card.difficulty || 0) + 2))));
        const intervalDays = intervals[5 - newDifficulty] || 1;
        
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + intervalDays);

        const stmt = db.prepare(`
            UPDATE cards 
            SET difficulty = ?, times_reviewed = ?, times_correct = ?, 
                last_reviewed = CURRENT_TIMESTAMP, next_review = ?
            WHERE id = ?
        `);
        stmt.run(newDifficulty, timesReviewed, timesCorrect, nextReview.toISOString(), id);
        
        res.json({ 
            id, 
            difficulty: newDifficulty, 
            times_reviewed: timesReviewed, 
            times_correct: timesCorrect,
            next_review: nextReview.toISOString()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder cards in a deck
app.put('/api/decks/:id/reorder', (req, res) => {
    const { id } = req.params;
    const { cardIds } = req.body;

    if (!cardIds || !Array.isArray(cardIds)) {
        return res.status(400).json({ error: 'cardIds array is required' });
    }

    try {
        const updateStmt = db.prepare('UPDATE cards SET position = ? WHERE id = ? AND deck_id = ?');
        cardIds.forEach((cardId, index) => {
            updateStmt.run(index, cardId, id);
        });
        res.json({ message: 'Cards reordered' });
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

// ============ STUDY SESSIONS ============

// Save a study session
app.post('/api/study-sessions', (req, res) => {
    const { deck_id, cards_studied, cards_correct, duration_seconds, session_type } = req.body;

    try {
        const stmt = db.prepare(`
            INSERT INTO study_sessions (deck_id, cards_studied, cards_correct, duration_seconds, session_type)
            VALUES (?, ?, ?, ?, ?)
        `);
        const info = stmt.run(deck_id, cards_studied || 0, cards_correct || 0, duration_seconds || 0, session_type || 'study');
        
        // Update deck's last_studied
        db.prepare('UPDATE decks SET last_studied = CURRENT_TIMESTAMP WHERE id = ?').run(deck_id);
        
        res.status(201).json({ id: info.lastInsertRowid });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get study sessions for a deck
app.get('/api/decks/:id/stats', (req, res) => {
    const { id } = req.params;
    try {
        // Get deck info
        const deck = db.prepare('SELECT last_studied FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        // Get all sessions
        const sessions = db.prepare(`
            SELECT * FROM study_sessions 
            WHERE deck_id = ? 
            ORDER BY created_at DESC 
            LIMIT 50
        `).all(id);

        // Calculate stats
        const totalSessions = sessions.length;
        const totalCardsStudied = sessions.reduce((sum, s) => sum + (s.cards_studied || 0), 0);
        const totalCorrect = sessions.reduce((sum, s) => sum + (s.cards_correct || 0), 0);
        const totalTime = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
        const accuracy = totalCardsStudied > 0 ? Math.round((totalCorrect / totalCardsStudied) * 100) : 0;

        // Get card difficulty distribution
        const cards = db.prepare('SELECT difficulty, times_reviewed FROM cards WHERE deck_id = ?').all(id);
        const difficultyDistribution = {
            easy: cards.filter(c => (c.difficulty || 0) <= 1).length,
            medium: cards.filter(c => (c.difficulty || 0) >= 2 && (c.difficulty || 0) <= 3).length,
            hard: cards.filter(c => (c.difficulty || 0) >= 4).length,
        };

        res.json({
            last_studied: deck.last_studied,
            total_sessions: totalSessions,
            total_cards_studied: totalCardsStudied,
            total_correct: totalCorrect,
            total_time_seconds: totalTime,
            accuracy,
            difficulty_distribution: difficultyDistribution,
            recent_sessions: sessions.slice(0, 10)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ DECK OPERATIONS ============

// Duplicate a deck
app.post('/api/decks/:id/duplicate', (req, res) => {
    const { id } = req.params;
    try {
        // Get original deck
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        // Create new deck
        const newDeckStmt = db.prepare('INSERT INTO decks (title, description, folder_id) VALUES (?, ?, ?)');
        const newDeckInfo = newDeckStmt.run(`${deck.title} (Copy)`, deck.description, deck.folder_id);
        const newDeckId = newDeckInfo.lastInsertRowid;

        // Copy cards
        const cards = db.prepare('SELECT front, back, position FROM cards WHERE deck_id = ?').all(id);
        const insertCard = db.prepare('INSERT INTO cards (deck_id, front, back, position) VALUES (?, ?, ?, ?)');
        cards.forEach(card => {
            insertCard.run(newDeckId, card.front, card.back, card.position || 0);
        });

        // Copy tags
        const tags = db.prepare('SELECT tag_id FROM deck_tags WHERE deck_id = ?').all(id);
        const insertTag = db.prepare('INSERT INTO deck_tags (deck_id, tag_id) VALUES (?, ?)');
        tags.forEach(tag => {
            insertTag.run(newDeckId, tag.tag_id);
        });

        res.status(201).json({ id: newDeckId, title: `${deck.title} (Copy)` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Export a deck
app.get('/api/decks/:id/export', (req, res) => {
    const { id } = req.params;
    const { format } = req.query;

    try {
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        const cards = db.prepare('SELECT front, back FROM cards WHERE deck_id = ? ORDER BY position').all(id);
        const tags = db.prepare(`
            SELECT t.name FROM tags t
            JOIN deck_tags dt ON t.id = dt.tag_id
            WHERE dt.deck_id = ?
        `).all(id);

        if (format === 'csv') {
            // CSV format
            let csv = 'front,back\n';
            cards.forEach(card => {
                const front = card.front.replace(/"/g, '""');
                const back = card.back.replace(/"/g, '""');
                csv += `"${front}","${back}"\n`;
            });
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${deck.title}.csv"`);
            res.send(csv);
        } else {
            // JSON format (default)
            res.json({
                title: deck.title,
                description: deck.description,
                tags: tags.map(t => t.name),
                cards: cards,
                exported_at: new Date().toISOString()
            });
        }
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
