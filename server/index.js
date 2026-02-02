const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret - MUST be set via environment variable in production
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
}
const jwtSecret = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts per window
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 100, // 100 requests per minute
    message: { error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

// CORS configuration - restrict to allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000'];

console.log('Allowed origins:', allowedOrigins);

app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (health checks, mobile apps, curl, etc.)
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Generate share code
function generateShareCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
}

// Auth middleware
function authMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Optional auth middleware (doesn't fail if no token)
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, jwtSecret);
            req.user = decoded;
        } catch (err) {
            // Invalid token, but continue without user
        }
    }
    next();
}

// Input validation helpers
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
    return username.length >= 2 && username.length <= 30 && /^[a-zA-Z0-9_]+$/.test(username);
}

// ============ AUTH ============

// Register (with stricter rate limiting)
app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    if (!isValidEmail(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!isValidUsername(username)) {
        return res.status(400).json({ error: 'Username must be 2-30 characters, alphanumeric and underscores only' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        // Check if email or username exists (generic message to prevent enumeration)
        const existingEmail = db.prepare('SELECT id FROM users WHERE LOWER(email) = LOWER(?)').get(email);
        if (existingEmail) {
            return res.status(400).json({ error: 'Account with this email or username already exists' });
        }

        // Check if username exists
        const existingUsername = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username);
        if (existingUsername) {
            return res.status(400).json({ error: 'Account with this email or username already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 12); // Increased cost factor
        const shareCode = generateShareCode();

        // Insert user
        const stmt = db.prepare('INSERT INTO users (username, email, password, share_code) VALUES (?, ?, ?, ?)');
        const info = stmt.run(username, email.toLowerCase(), hashedPassword, shareCode);

        // Create default themes for user
        const insertTheme = db.prepare('INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        insertTheme.run(info.lastInsertRowid, 'Claude Dark', '#1a1a18', '#242422', '#e8e8e3', '#a1a19a', '#3d3d3a', '#d97757', 1, 1);
        insertTheme.run(info.lastInsertRowid, 'Claude Light', '#f9f7f2', '#ffffff', '#1d1d1b', '#6b6b6b', '#e5e2da', '#d97757', 0, 1);

        // Create preset tags for user
        const insertTag = db.prepare('INSERT INTO tags (user_id, name, color, is_preset) VALUES (?, ?, ?, 1)');
        insertTag.run(info.lastInsertRowid, 'Language', '#3b82f6');
        insertTag.run(info.lastInsertRowid, 'Science', '#22c55e');
        insertTag.run(info.lastInsertRowid, 'Math', '#f59e0b');
        insertTag.run(info.lastInsertRowid, 'History', '#8b5cf6');
        insertTag.run(info.lastInsertRowid, 'Programming', '#06b6d4');
        insertTag.run(info.lastInsertRowid, 'Medical', '#ef4444');
        insertTag.run(info.lastInsertRowid, 'Business', '#ec4899');
        insertTag.run(info.lastInsertRowid, 'Art', '#f97316');

        // Generate token
        const token = jwt.sign({ id: info.lastInsertRowid, email: email.toLowerCase() }, jwtSecret, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: {
                id: info.lastInsertRowid,
                username,
                email: email.toLowerCase(),
                shareCode,
                avatar: null,
                bio: '',
                streakData: {}
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
// Login (with stricter rate limiting)
app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = LOWER(?)').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.is_admin === 1 }, jwtSecret, { expiresIn: '30d' });

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                shareCode: user.share_code,
                avatar: user.avatar,
                bio: user.bio || '',
                isAdmin: user.is_admin === 1,
                streakData: JSON.parse(user.streak_data || '{}')
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, (req, res) => {
    try {
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            shareCode: user.share_code,
            avatar: user.avatar,
            bio: user.bio || '',
            streakData: JSON.parse(user.streak_data || '{}')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update profile
app.put('/api/auth/profile', authMiddleware, (req, res) => {
    const { username, bio, avatar } = req.body;

    try {
        if (username) {
            // Check if username is taken by another user
            const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?').get(username, req.user.id);
            if (existing) {
                return res.status(400).json({ error: 'Username already taken' });
            }
        }

        const stmt = db.prepare('UPDATE users SET username = COALESCE(?, username), bio = COALESCE(?, bio), avatar = COALESCE(?, avatar) WHERE id = ?');
        stmt.run(username, bio, avatar, req.user.id);

        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            shareCode: user.share_code,
            avatar: user.avatar,
            bio: user.bio || '',
            streakData: JSON.parse(user.streak_data || '{}')
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Change password
app.put('/api/auth/password', authMiddleware, async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current and new password are required' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    try {
        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, req.user.id);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete account
app.delete('/api/auth/account', authMiddleware, async (req, res) => {
    const { password } = req.body;

    try {
        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Password is incorrect' });
        }

        db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update streak data
app.put('/api/auth/streak', authMiddleware, (req, res) => {
    const { streakData } = req.body;

    try {
        db.prepare('UPDATE users SET streak_data = ? WHERE id = ?').run(JSON.stringify(streakData), req.user.id);
        res.json({ message: 'Streak data saved' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get streak data
app.get('/api/auth/streak', authMiddleware, (req, res) => {
    try {
        const user = db.prepare('SELECT streak_data FROM users WHERE id = ?').get(req.user.id);
        res.json(JSON.parse(user.streak_data || '{}'));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Migrate guest data to account
app.post('/api/auth/migrate-guest-data', authMiddleware, (req, res) => {
    const { folders, tags, decks, cards, themes, studySessions, deckTags } = req.body;
    const userId = req.user.id;

    try {
        // Map old IDs to new IDs for relationships
        const folderIdMap = {};
        const tagIdMap = {};
        const deckIdMap = {};

        // Import folders
        if (folders && folders.length > 0) {
            const insertFolder = db.prepare('INSERT INTO folders (user_id, name, color, icon, created_at) VALUES (?, ?, ?, ?, ?)');
            for (const folder of folders) {
                const info = insertFolder.run(userId, folder.name, folder.color || '#6366f1', folder.icon || 'folder', folder.created_at || new Date().toISOString());
                folderIdMap[folder.id] = info.lastInsertRowid;
            }
        }

        // Import custom tags (skip presets since user already has them)
        if (tags && tags.length > 0) {
            const insertTag = db.prepare('INSERT INTO tags (user_id, name, color, is_preset, created_at) VALUES (?, ?, ?, 0, ?)');
            const existingTags = db.prepare('SELECT name FROM tags WHERE user_id = ?').all(userId);
            const existingNames = existingTags.map(t => t.name.toLowerCase());
            
            for (const tag of tags.filter(t => !t.is_preset)) {
                if (!existingNames.includes(tag.name.toLowerCase())) {
                    const info = insertTag.run(userId, tag.name, tag.color, tag.created_at || new Date().toISOString());
                    tagIdMap[tag.id] = info.lastInsertRowid;
                }
            }
        }

        // Import decks
        if (decks && decks.length > 0) {
            const insertDeck = db.prepare('INSERT INTO decks (user_id, title, description, folder_id, created_at, last_studied) VALUES (?, ?, ?, ?, ?, ?)');
            for (const deck of decks) {
                const newFolderId = deck.folder_id ? folderIdMap[deck.folder_id] : null;
                const info = insertDeck.run(userId, deck.title, deck.description || '', newFolderId, deck.created_at || new Date().toISOString(), deck.last_studied || null);
                deckIdMap[deck.id] = info.lastInsertRowid;
            }
        }

        // Import cards
        if (cards && cards.length > 0) {
            const insertCard = db.prepare('INSERT INTO cards (deck_id, front, back, position, difficulty, times_reviewed, times_correct, last_reviewed, next_review, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
            for (const card of cards) {
                const newDeckId = deckIdMap[card.deck_id];
                if (newDeckId) {
                    insertCard.run(
                        newDeckId, 
                        card.front, 
                        card.back, 
                        card.position || 0,
                        card.difficulty || 0,
                        card.times_reviewed || 0,
                        card.times_correct || 0,
                        card.last_reviewed || null,
                        card.next_review || null,
                        card.created_at || new Date().toISOString()
                    );
                }
            }
        }

        // Import deck-tag relationships
        if (deckTags && deckTags.length > 0) {
            const insertDeckTag = db.prepare('INSERT OR IGNORE INTO deck_tags (deck_id, tag_id) VALUES (?, ?)');
            for (const dt of deckTags) {
                const newDeckId = deckIdMap[dt.deck_id];
                const newTagId = tagIdMap[dt.tag_id];
                if (newDeckId && newTagId) {
                    insertDeckTag.run(newDeckId, newTagId);
                }
            }
        }

        // Import study sessions
        if (studySessions && studySessions.length > 0) {
            const insertSession = db.prepare('INSERT INTO study_sessions (deck_id, cards_studied, cards_correct, duration_seconds, session_type, created_at) VALUES (?, ?, ?, ?, ?, ?)');
            for (const session of studySessions) {
                const newDeckId = deckIdMap[session.deck_id];
                if (newDeckId) {
                    insertSession.run(
                        newDeckId,
                        session.cards_studied || 0,
                        session.cards_correct || 0,
                        session.duration_seconds || 0,
                        session.session_type || 'study',
                        session.created_at || new Date().toISOString()
                    );
                }
            }
        }

        res.json({ 
            message: 'Guest data migrated successfully',
            imported: {
                folders: Object.keys(folderIdMap).length,
                tags: Object.keys(tagIdMap).length,
                decks: Object.keys(deckIdMap).length
            }
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({ error: 'Failed to migrate guest data' });
    }
});

// ============ FOLDERS ============

// Get all folders with deck counts
app.get('/api/folders', optionalAuth, (req, res) => {
    try {
        const userId = req.user?.id || null;
        const folders = db.prepare('SELECT * FROM folders WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL) ORDER BY created_at DESC').all(userId, userId);
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
app.post('/api/folders', optionalAuth, (req, res) => {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    try {
        const userId = req.user?.id || null;
        const stmt = db.prepare('INSERT INTO folders (user_id, name, color, icon) VALUES (?, ?, ?, ?)');
        const info = stmt.run(userId, name, color || '#6366f1', icon || 'folder');
        res.status(201).json({ id: info.lastInsertRowid, name, color: color || '#6366f1', icon: icon || 'folder' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a folder
app.put('/api/folders/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    try {
        const userId = req.user?.id || null;
        // Verify ownership
        const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (folder.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
        const stmt = db.prepare('UPDATE folders SET name = ?, color = ?, icon = ? WHERE id = ?');
        stmt.run(name, color, icon, id);
        res.json({ id, name, color, icon });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a folder
app.delete('/api/folders/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        // Verify ownership
        const folder = db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (folder.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
        db.prepare('DELETE FROM folders WHERE id = ?').run(id);
        res.json({ message: 'Folder deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ TAGS ============

// Get all tags
app.get('/api/tags', optionalAuth, (req, res) => {
    try {
        const userId = req.user?.id || null;
        const tags = db.prepare('SELECT * FROM tags WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL) ORDER BY is_preset DESC, name ASC').all(userId, userId);
        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a tag
app.post('/api/tags', optionalAuth, (req, res) => {
    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'Name and color are required' });
    
    try {
        const userId = req.user?.id || null;
        const stmt = db.prepare('INSERT INTO tags (user_id, name, color, is_preset) VALUES (?, ?, ?, 0)');
        const info = stmt.run(userId, name, color);
        res.status(201).json({ id: info.lastInsertRowid, name, color, is_preset: 0 });
    } catch (error) {
        if (error.message.includes('UNIQUE')) {
            return res.status(400).json({ error: 'Tag already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

// Delete a tag (only custom tags)
app.delete('/api/tags/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const tag = db.prepare('SELECT * FROM tags WHERE id = ?').get(id);
        if (!tag) return res.status(404).json({ error: 'Tag not found' });
        if (tag.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        if (tag.is_preset) return res.status(400).json({ error: 'Cannot delete preset tags' });
        
        db.prepare('DELETE FROM tags WHERE id = ?').run(id);
        res.json({ message: 'Tag deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ DECKS ============

// Get all decks with tags
app.get('/api/decks', optionalAuth, (req, res) => {
    try {
        const userId = req.user?.id || null;
        const stmt = db.prepare('SELECT * FROM decks WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL) ORDER BY created_at DESC');
        const decks = stmt.all(userId, userId);
        
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
app.post('/api/decks', optionalAuth, (req, res) => {
    const { title, description, folder_id, tagIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const userId = req.user?.id || null;
        const stmt = db.prepare('INSERT INTO decks (user_id, title, description, folder_id) VALUES (?, ?, ?, ?)');
        const info = stmt.run(userId, title, description || '', folder_id || null);
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

// Get a single deck with cards and tags (requires ownership)
app.get('/api/decks/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const deckStmt = db.prepare('SELECT * FROM decks WHERE id = ?');
        const deck = deckStmt.get(id);

        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        
        // Verify ownership
        if (deck.user_id !== userId) {
            return res.status(403).json({ error: 'Not authorized' });
        }

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
app.put('/api/decks/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    const { title, description, folder_id, tagIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const userId = req.user?.id || null;
        // Verify ownership
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
        const stmt = db.prepare('UPDATE decks SET title = ?, description = ?, folder_id = ? WHERE id = ?');
        stmt.run(title, description || '', folder_id || null, id);
        
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
app.put('/api/decks/:id/move', optionalAuth, (req, res) => {
    const { id } = req.params;
    const { folder_id } = req.body;
    
    try {
        const userId = req.user?.id || null;
        // Verify ownership
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
        const stmt = db.prepare('UPDATE decks SET folder_id = ? WHERE id = ?');
        stmt.run(folder_id || null, id);
        res.json({ id, folder_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a deck
app.delete('/api/decks/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        // Verify ownership
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
        db.prepare('DELETE FROM decks WHERE id = ?').run(id);
        res.json({ message: 'Deck deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Add a card to a deck
app.post('/api/decks/:id/cards', optionalAuth, (req, res) => {
    const { id } = req.params;
    const { front, back } = req.body;

    if (!front || !back) return res.status(400).json({ error: 'Front and back are required' });

    try {
        const userId = req.user?.id || null;
        // Check if deck exists and user owns it
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const stmt = db.prepare('INSERT INTO cards (deck_id, front, back) VALUES (?, ?, ?)');
        const info = stmt.run(id, front, back);
        res.status(201).json({ id: info.lastInsertRowid, deck_id: id, front, back });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update a card
app.put('/api/cards/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    const { front, back } = req.body;

    if (!front || !back) return res.status(400).json({ error: 'Front and back are required' });

    try {
        const userId = req.user?.id || null;
        // Get card and verify deck ownership
        const card = db.prepare('SELECT c.*, d.user_id as deck_user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = ?').get(id);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.deck_user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
        const stmt = db.prepare('UPDATE cards SET front = ?, back = ? WHERE id = ?');
        const info = stmt.run(front, back, id);
        if (info.changes === 0) return res.status(404).json({ error: 'Card not found' });
        res.json({ id, front, back });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update card difficulty (for spaced repetition)
app.put('/api/cards/:id/review', optionalAuth, (req, res) => {
    const { id } = req.params;
    const { correct, difficulty } = req.body;

    try {
        const userId = req.user?.id || null;
        // Get card and verify deck ownership
        const card = db.prepare('SELECT c.*, d.user_id as deck_user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = ?').get(id);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.deck_user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

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
app.put('/api/decks/:id/reorder', optionalAuth, (req, res) => {
    const { id } = req.params;
    const { cardIds } = req.body;

    if (!cardIds || !Array.isArray(cardIds)) {
        return res.status(400).json({ error: 'cardIds array is required' });
    }

    try {
        const userId = req.user?.id || null;
        // Verify deck ownership
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
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
app.delete('/api/cards/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        // Get card and verify deck ownership
        const card = db.prepare('SELECT c.*, d.user_id as deck_user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = ?').get(id);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.deck_user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        
        db.prepare('DELETE FROM cards WHERE id = ?').run(id);
        res.json({ message: 'Card deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ STUDY SESSIONS ============

// Save a study session
app.post('/api/study-sessions', optionalAuth, (req, res) => {
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
app.post('/api/decks/:id/duplicate', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        // Get original deck
        const deck = db.prepare('SELECT * FROM decks WHERE id = ?').get(id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        // Create new deck with user_id
        const newDeckStmt = db.prepare('INSERT INTO decks (user_id, title, description, folder_id) VALUES (?, ?, ?, ?)');
        const newDeckInfo = newDeckStmt.run(userId, `${deck.title} (Copy)`, deck.description, deck.folder_id);
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
app.get('/api/themes', optionalAuth, (req, res) => {
    try {
        const userId = req.user?.id || null;
        const themes = db.prepare('SELECT * FROM themes WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)').all(userId, userId);
        res.json(themes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create a theme
app.post('/api/themes', optionalAuth, (req, res) => {
    const { name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color } = req.body;
    try {
        const userId = req.user?.id || null;
        const stmt = db.prepare('INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        const info = stmt.run(userId, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color);
        res.status(201).json({ id: info.lastInsertRowid, ...req.body });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a theme
app.delete('/api/themes/:id', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        // Don't allow deleting default themes
        const theme = db.prepare('SELECT * FROM themes WHERE id = ?').get(id);
        if (!theme) return res.status(404).json({ error: 'Theme not found' });
        if (theme.is_default) return res.status(400).json({ error: 'Cannot delete default themes' });
        if (theme.is_active) return res.status(400).json({ error: 'Cannot delete active theme' });
        
        const stmt = db.prepare('DELETE FROM themes WHERE id = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))');
        const info = stmt.run(id, userId, userId);
        if (info.changes === 0) return res.status(404).json({ error: 'Theme not found' });
        res.json({ message: 'Theme deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Set active theme
app.put('/api/themes/:id/activate', optionalAuth, (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        db.prepare('UPDATE themes SET is_active = 0 WHERE user_id = ? OR (user_id IS NULL AND ? IS NULL)').run(userId, userId);
        const info = db.prepare('UPDATE themes SET is_active = 1 WHERE id = ?').run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'Theme not found' });
        res.json({ message: 'Theme activated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ DECK SHARING ============

// Share a deck
app.post('/api/decks/:id/share', authMiddleware, (req, res) => {
    const { id } = req.params;
    try {
        const deck = db.prepare('SELECT * FROM decks WHERE id = ? AND user_id = ?').get(id, req.user.id);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        // Get cards
        const cards = db.prepare('SELECT front, back, position FROM cards WHERE deck_id = ?').all(id);
        
        // Get tags
        const tags = db.prepare(`
            SELECT t.name FROM tags t
            JOIN deck_tags dt ON t.id = dt.tag_id
            WHERE dt.deck_id = ?
        `).all(id);

        const shareId = uuidv4().substring(0, 8).toUpperCase();
        const deckData = JSON.stringify({
            title: deck.title,
            description: deck.description,
            cards,
            tags: tags.map(t => t.name)
        });

        const stmt = db.prepare('INSERT INTO shared_decks (share_id, user_id, deck_id, deck_data) VALUES (?, ?, ?, ?)');
        stmt.run(shareId, req.user.id, id, deckData);

        res.json({ shareId, shareUrl: `/shared/${shareId}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get shared deck
app.get('/api/shared/:shareId', (req, res) => {
    const { shareId } = req.params;
    try {
        const shared = db.prepare('SELECT * FROM shared_decks WHERE share_id = ?').get(shareId);
        if (!shared) return res.status(404).json({ error: 'Shared deck not found' });

        const owner = db.prepare('SELECT username, share_code FROM users WHERE id = ?').get(shared.user_id);

        res.json({
            ...JSON.parse(shared.deck_data),
            shareId: shared.share_id,
            sharedBy: owner?.username || 'Unknown',
            sharedAt: shared.created_at
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Import shared deck
app.post('/api/shared/:shareId/import', authMiddleware, (req, res) => {
    const { shareId } = req.params;
    try {
        const shared = db.prepare('SELECT * FROM shared_decks WHERE share_id = ?').get(shareId);
        if (!shared) return res.status(404).json({ error: 'Shared deck not found' });

        const deckData = JSON.parse(shared.deck_data);

        // Create new deck for user
        const deckStmt = db.prepare('INSERT INTO decks (user_id, title, description) VALUES (?, ?, ?)');
        const deckInfo = deckStmt.run(req.user.id, deckData.title, deckData.description || '');
        const newDeckId = deckInfo.lastInsertRowid;

        // Add cards
        const cardStmt = db.prepare('INSERT INTO cards (deck_id, front, back, position) VALUES (?, ?, ?, ?)');
        deckData.cards.forEach((card, idx) => {
            cardStmt.run(newDeckId, card.front, card.back, card.position || idx);
        });

        res.json({ deckId: newDeckId, message: 'Deck imported successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user's shared decks
app.get('/api/my-shared-decks', authMiddleware, (req, res) => {
    try {
        const shared = db.prepare('SELECT * FROM shared_decks WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
        res.json(shared.map(s => ({
            shareId: s.share_id,
            deckId: s.deck_id,
            ...JSON.parse(s.deck_data),
            createdAt: s.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Unshare a deck
app.delete('/api/shared/:shareId', authMiddleware, (req, res) => {
    const { shareId } = req.params;
    try {
        const info = db.prepare('DELETE FROM shared_decks WHERE share_id = ? AND user_id = ?').run(shareId, req.user.id);
        if (info.changes === 0) return res.status(404).json({ error: 'Shared deck not found' });
        res.json({ message: 'Deck unshared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ADMIN ENDPOINTS ============

// Admin middleware - requires admin role
function adminMiddleware(req, res, next) {
    if (!req.user?.isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
}

// Get all users (admin only)
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT id, username, email, share_code, avatar, bio, streak_data, is_admin, created_at 
            FROM users ORDER BY created_at DESC
        `).all();
        
        res.json(users.map(u => ({
            id: u.id,
            username: u.username,
            email: u.email,
            shareCode: u.share_code,
            avatar: u.avatar,
            bio: u.bio || '',
            streakData: JSON.parse(u.streak_data || '{}'),
            isAdmin: u.is_admin === 1,
            createdAt: u.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Update user (admin only)
app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { id } = req.params;
    const { username, email, bio, isAdmin } = req.body;
    
    try {
        // Don't allow demoting yourself
        if (parseInt(id) === req.user.id && isAdmin === false) {
            return res.status(400).json({ error: 'Cannot remove your own admin status' });
        }
        
        const stmt = db.prepare(`
            UPDATE users SET 
                username = COALESCE(?, username), 
                email = COALESCE(?, email), 
                bio = COALESCE(?, bio),
                is_admin = COALESCE(?, is_admin)
            WHERE id = ?
        `);
        stmt.run(username, email, bio, isAdmin ? 1 : 0, id);
        
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin === 1
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user (admin only)
app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, (req, res) => {
    const { id } = req.params;
    
    try {
        // Don't allow deleting yourself
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
        if (info.changes === 0) return res.status(404).json({ error: 'User not found' });
        
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Get user stats (admin only)
app.get('/api/admin/stats', authMiddleware, adminMiddleware, (req, res) => {
    try {
        const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const deckCount = db.prepare('SELECT COUNT(*) as count FROM decks').get().count;
        const cardCount = db.prepare('SELECT COUNT(*) as count FROM cards').get().count;
        const sharedCount = db.prepare('SELECT COUNT(*) as count FROM shared_decks').get().count;
        
        res.json({
            users: userCount,
            decks: deckCount,
            cards: cardCount,
            sharedDecks: sharedCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============ HEALTH CHECK ============

app.get('/api/health', (req, res) => {
    try {
        // Test database connection
        db.prepare('SELECT 1').get();
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
