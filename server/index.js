if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config({ override: true });
}
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const slowDown = require('express-slow-down');
const xss = require('xss');
const db = require('./db');
const registerAuthRoutes = require('./routes/auth');
const registerSocialRoutes = require('./routes/social');
const registerHealthRoutes = require('./routes/health');
const registerAdminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust the first proxy (Render/Vercel load balancer)
// Required for successful rate limiting behind a proxy
app.set('trust proxy', 1);

// JWT Secret
//
// In production, a real secret is required. In tests, we allow a deterministic
// fallback so importing the app doesn't hard-exit.
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'test' ? 'test-secret' : undefined);
if (!JWT_SECRET) {
    console.error('FATAL: JWT_SECRET environment variable is required');
    console.error('Generate a secure secret with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
    process.exit(1);
}
const jwtSecret = JWT_SECRET;

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100, // Relaxed from 5 to 100 for dev
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 20, // Relaxed from 3
    delayMs: (hits) => hits * 100
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

// CORS
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'https://riven-virid.vercel.app'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or same-origin in some cases)
        if (!origin) return callback(null, true);

        // In development, allow any origin (e.g. mobile devices on LAN)
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error('[CORS] Blocked request from origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: false,
}));
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));

// Input sanitization middleware
app.use((req, res, next) => {
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = xss(req.body[key]);
            }
        }
    }
    if (req.query) {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = xss(req.query[key]);
            }
        }
    }
    if (req.params) {
        for (const key in req.params) {
            if (typeof req.params[key] === 'string') {
                req.params[key] = xss(req.params[key]);
            }
        }
    }
    next();
});

app.use('/api/', apiLimiter);

const crypto = require('crypto');

// Generate share code
function generateShareCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = crypto.randomBytes(8);
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars[bytes[i] % chars.length];
    }
    return code;
}

// Auth middleware
async function authMiddleware(req, res, next) {
    // Read token from httpOnly cookie (preferred) or Authorization header (backward compatibility)
    let token = req.cookies.token;

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    try {
        const decoded = jwt.verify(token, jwtSecret);
        req.user = decoded;
        // Ensure role is always set (backward compat for old JWTs without role)
        if (!req.user.role) {
            const dbUser = await db.queryOne('SELECT role, is_admin FROM users WHERE id = $1', [req.user.id]);
            if (dbUser) {
                req.user.role = dbUser.role || (dbUser.is_admin === 1 ? 'admin' : 'user');
            } else {
                req.user.role = 'user';
            }
        }
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Invalid token' });
    }
}

// Optional auth middleware
function optionalAuth(req, res, next) {
    // Read token from httpOnly cookie (preferred) or Authorization header (backward compatibility)
    let token = req.cookies.token;

    if (!token) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split(' ')[1];
        }
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, jwtSecret);
            req.user = decoded;
            // console.log('[Auth] optionalAuth verified token for user:', decoded.id);
        } catch (err) {
            console.error('[Auth] optionalAuth token verification failed:', err.message);
        }
    } else {
        // console.log('[Auth] optionalAuth: No token found');
    }
    next();
}

// Input validation
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidUsername(username) {
    return username.length >= 2 && username.length <= 30 && /^[a-zA-Z0-9_]+$/.test(username);
}

// ============ AUTH ============

registerAuthRoutes({
    app,
    db,
    jwt,
    bcrypt,
    speakeasy,
    QRCode,
    jwtSecret,
    authMiddleware,
    authLimiter,
    speedLimiter,
    generateShareCode,
    isValidEmail,
    isValidUsername
});

// ============ SOCIAL / FRIENDS ============

registerSocialRoutes({ app, db, authMiddleware });

// ============ MESSAGES ============

// Get conversations (list of users you have messages with)
app.get('/api/messages/conversations', authMiddleware, async (req, res) => {
    try {
        const conversations = await db.query(
            `SELECT DISTINCT ON (other_user_id) 
                other_user_id,
                u.username,
                u.avatar,
                m.content as last_message,
                m.message_type as last_message_type,
                m.created_at as last_message_at,
                m.sender_id,
                (SELECT COUNT(*) FROM messages WHERE sender_id = other_user_id AND receiver_id = $1 AND is_read = 0) as unread_count
             FROM (
                SELECT 
                    CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id,
                    id
                FROM messages
                WHERE sender_id = $1 OR receiver_id = $1
             ) sub
             JOIN messages m ON m.id = sub.id
             JOIN users u ON u.id = sub.other_user_id
             ORDER BY other_user_id, m.created_at DESC`,
            [req.user.id]
        );

        res.json(conversations.map(c => ({
            userId: c.other_user_id,
            username: c.username,
            avatar: c.avatar,
            lastMessage: c.last_message,
            lastMessageType: c.last_message_type,
            lastMessageAt: c.last_message_at,
            isOwnMessage: c.sender_id === req.user.id,
            unreadCount: parseInt(c.unread_count)
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get messages with a specific user
app.get('/api/messages/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { limit = 50, before } = req.query;

    try {
        let query = `
            SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
        `;
        const params = [req.user.id, userId];

        if (before) {
            query += ` AND m.created_at < $3`;
            params.push(before);
        }

        query += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
        params.push(parseInt(limit));

        const messages = await db.query(query, params);

        // Mark as read
        await db.execute(
            `UPDATE messages SET is_read = 1 WHERE sender_id = $1 AND receiver_id = $2 AND is_read = 0`,
            [userId, req.user.id]
        );

        res.json(messages.reverse().map(m => ({
            id: m.id,
            senderId: m.sender_id,
            senderUsername: m.sender_username,
            senderAvatar: m.sender_avatar,
            content: m.content,
            messageType: m.message_type,
            deckData: m.deck_data ? JSON.parse(m.deck_data) : null,
            imageUrl: m.image_url,
            isEdited: m.is_edited === 1,
            isRead: m.is_read === 1,
            createdAt: m.created_at,
            isMine: m.sender_id === req.user.id
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send a message
app.post('/api/messages', authMiddleware, async (req, res) => {
    const { receiverId, content, messageType = 'text', deckData, imageUrl } = req.body;

    if (!receiverId) return res.status(400).json({ error: 'Receiver ID is required' });
    if (!content && !imageUrl && !deckData) return res.status(400).json({ error: 'Message content, image or deck is required' });

    try {
        // Verify receiver exists
        const receiver = await db.queryOne('SELECT id FROM users WHERE id = $1', [receiverId]);
        if (!receiver) return res.status(404).json({ error: 'User not found' });

        const message = await db.queryOne(
            `INSERT INTO messages (sender_id, receiver_id, content, message_type, deck_data, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.id, receiverId, content || '', messageType, deckData ? JSON.stringify(deckData) : null, imageUrl || null]
        );

        res.json({
            id: message.id,
            senderId: message.sender_id,
            content: message.content,
            messageType: message.message_type,
            deckData: message.deck_data ? JSON.parse(message.deck_data) : null,
            imageUrl: message.image_url,
            isEdited: message.is_edited === 1,
            createdAt: message.created_at,
            isMine: true
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Edit a message
app.put('/api/messages/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: 'Message content is required' });

    try {
        const message = await db.queryOne('SELECT * FROM messages WHERE id = $1 AND sender_id = $2', [id, req.user.id]);
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        const updated = await db.queryOne(
            `UPDATE messages SET content = $1, is_edited = 1 WHERE id = $2 RETURNING *`,
            [content, id]
        );

        res.json({
            id: updated.id,
            senderId: updated.sender_id,
            content: updated.content,
            messageType: updated.message_type,
            deckData: updated.deck_data ? JSON.parse(updated.deck_data) : null,
            imageUrl: updated.image_url,
            isEdited: updated.is_edited === 1,
            createdAt: updated.created_at,
            isMine: true
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a message
app.delete('/api/messages/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;

    try {
        const message = await db.queryOne('SELECT * FROM messages WHERE id = $1 AND sender_id = $2', [id, req.user.id]);
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        await db.execute('DELETE FROM messages WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get unread message count
app.get('/api/messages/unread/count', authMiddleware, async (req, res) => {
    try {
        const result = await db.queryOne(
            'SELECT COUNT(*) as count FROM messages WHERE receiver_id = $1 AND is_read = 0',
            [req.user.id]
        );
        res.json({ count: parseInt(result.count) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ FOLDERS ============

app.get('/api/folders', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const userFilter = userId ? 'f.user_id = $1' : 'f.user_id IS NULL';
        const params = userId ? [userId] : [];

        // Single query: folders with deck counts via LEFT JOIN
        const folders = await db.query(
            `SELECT f.*, COALESCE(d.count, 0)::int AS "deckCount"
             FROM folders f
             LEFT JOIN (SELECT folder_id, COUNT(*) AS count FROM decks GROUP BY folder_id) d ON d.folder_id = f.id
             WHERE ${userFilter}
             ORDER BY f.created_at DESC`,
            params
        );
        res.json(folders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/folders', optionalAuth, async (req, res) => {
    const { name, color, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    try {
        const userId = req.user?.id || null;
        const result = await db.queryOne(
            'INSERT INTO folders (user_id, name, color, icon) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, name, color || '#6366f1', icon || 'folder']
        );
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/folders/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { name, color, icon } = req.body;

    try {
        const userId = req.user?.id || null;
        const folder = await db.queryOne('SELECT * FROM folders WHERE id = $1', [id]);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (folder.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.queryOne(
            'UPDATE folders SET name = COALESCE($1, name), color = COALESCE($2, color), icon = COALESCE($3, icon) WHERE id = $4 RETURNING *',
            [name, color, icon, id]
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/folders/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const folder = await db.queryOne('SELECT * FROM folders WHERE id = $1', [id]);
        if (!folder) return res.status(404).json({ error: 'Folder not found' });
        if (folder.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute('UPDATE decks SET folder_id = NULL WHERE folder_id = $1', [id]);
        await db.execute('DELETE FROM folders WHERE id = $1', [id]);
        res.json({ message: 'Folder deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ TAGS ============

app.get('/api/tags', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const tags = userId
            ? await db.query('SELECT * FROM tags WHERE user_id = $1 ORDER BY is_preset DESC, name ASC', [userId])
            : await db.query('SELECT * FROM tags WHERE user_id IS NULL ORDER BY is_preset DESC, name ASC');
        res.json(tags);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tags', optionalAuth, async (req, res) => {
    const { name, color } = req.body;
    if (!name || !color) return res.status(400).json({ error: 'Name and color are required' });

    try {
        const userId = req.user?.id || null;
        const result = await db.queryOne(
            'INSERT INTO tags (user_id, name, color, is_preset) VALUES ($1, $2, $3, 0) RETURNING *',
            [userId, name, color]
        );
        res.status(201).json(result);
    } catch (error) {
        if (error.message.includes('duplicate') || error.message.includes('unique')) {
            return res.status(400).json({ error: 'Tag already exists' });
        }
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/tags/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const tag = await db.queryOne('SELECT * FROM tags WHERE id = $1', [id]);
        if (!tag) return res.status(404).json({ error: 'Tag not found' });
        if (tag.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        if (tag.is_preset) return res.status(400).json({ error: 'Cannot delete preset tags' });

        await db.execute('DELETE FROM tags WHERE id = $1', [id]);
        res.json({ message: 'Tag deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ DECKS ============

app.get('/api/decks', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const userFilter = userId ? 'user_id = $1' : 'user_id IS NULL';
        const params = userId ? [userId] : [];

        // Single query: get decks with card counts
        console.log('[Decks] Fetching decks for user:', userId ? `ID ${userId}` : 'Public (NULL)');
        const decks = await db.query(
            `SELECT d.*, COALESCE(c.count, 0)::int AS "cardCount"
             FROM decks d
             LEFT JOIN (SELECT deck_id, COUNT(*) AS count FROM cards GROUP BY deck_id) c ON c.deck_id = d.id
             WHERE d.${userFilter}
             ORDER BY d.created_at DESC`,
            params
        );

        if (decks.length === 0) return res.json([]);

        // Single query: get all tags for all decks at once
        const deckIds = decks.map(d => d.id);
        const tagRows = await db.query(
            `SELECT dt.deck_id, t.* FROM tags t
             JOIN deck_tags dt ON t.id = dt.tag_id
             WHERE dt.deck_id = ANY($1)`,
            [deckIds]
        );

        // Group tags by deck_id
        const tagsByDeck = {};
        for (const row of tagRows) {
            const did = row.deck_id;
            if (!tagsByDeck[did]) tagsByDeck[did] = [];
            tagsByDeck[did].push({ id: row.id, name: row.name, color: row.color, is_preset: row.is_preset, user_id: row.user_id });
        }

        res.json(decks.map(d => ({ ...d, tags: tagsByDeck[d.id] || [] })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/decks', optionalAuth, async (req, res) => {
    const { title, description, folder_id, tagIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const userId = req.user?.id || null;
        const result = await db.queryOne(
            'INSERT INTO decks (user_id, title, description, folder_id) VALUES ($1, $2, $3, $4) RETURNING id',
            [userId, title, description || '', folder_id || null]
        );
        const deckId = result.id;

        if (tagIds?.length > 0) {
            for (const tagId of tagIds) {
                await db.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES ($1, $2)', [deckId, tagId]);
            }
        }

        res.status(201).json({ id: deckId, title, description, folder_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/decks/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const cards = await db.query('SELECT * FROM cards WHERE deck_id = $1 ORDER BY position', [id]);
        const tags = await db.query(
            'SELECT t.* FROM tags t JOIN deck_tags dt ON t.id = dt.tag_id WHERE dt.deck_id = $1',
            [id]
        );
        res.json({ ...deck, cards, tags });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/decks/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { title, description, folder_id, tagIds } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute(
            'UPDATE decks SET title = $1, description = $2, folder_id = $3 WHERE id = $4',
            [title, description || '', folder_id || null, id]
        );

        if (tagIds !== undefined) {
            await db.execute('DELETE FROM deck_tags WHERE deck_id = $1', [id]);
            if (tagIds.length > 0) {
                for (const tagId of tagIds) {
                    await db.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES ($1, $2)', [id, tagId]);
                }
            }
        }

        res.json({ id, title, description, folder_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/decks/:id/move', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { folder_id } = req.body;

    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute('UPDATE decks SET folder_id = $1 WHERE id = $2', [folder_id || null, id]);
        res.json({ id, folder_id });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/decks/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute('DELETE FROM decks WHERE id = $1', [id]);
        res.json({ message: 'Deck deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Duplicate deck
app.post('/api/decks/:id/duplicate', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const newDeck = await db.queryOne(
            'INSERT INTO decks (user_id, title, description, folder_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, `${deck.title} (Copy)`, deck.description, deck.folder_id]
        );

        const cards = await db.query('SELECT * FROM cards WHERE deck_id = $1', [id]);
        for (const card of cards) {
            await db.execute(
                'INSERT INTO cards (deck_id, front, back, front_image, back_image, position) VALUES ($1, $2, $3, $4, $5, $6)',
                [newDeck.id, card.front, card.back, card.front_image, card.back_image, card.position]
            );
        }

        const tags = await db.query('SELECT tag_id FROM deck_tags WHERE deck_id = $1', [id]);
        for (const tag of tags) {
            await db.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES ($1, $2)', [newDeck.id, tag.tag_id]);
        }

        res.status(201).json(newDeck);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ CARDS ============

app.post('/api/decks/:id/cards', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { front, back, front_image, back_image } = req.body;
    // Require either text or image for both front and back
    if ((!front && !front_image) || (!back && !back_image)) {
        return res.status(400).json({ error: 'Front and back content (text or image) are required' });
    }

    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const maxPos = await db.queryOne('SELECT COALESCE(MAX(position), -1) as max FROM cards WHERE deck_id = $1', [id]);
        const result = await db.queryOne(
            'INSERT INTO cards (deck_id, front, back, front_image, back_image, position) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [id, front, back, front_image || null, back_image || null, (maxPos.max || 0) + 1]
        );
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/cards/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { front, back, front_image, back_image } = req.body;
    // Require either text or image for both front and back
    if ((!front && !front_image) || (!back && !back_image)) {
        return res.status(400).json({ error: 'Front and back content (text or image) are required' });
    }

    try {
        const userId = req.user?.id || null;
        const card = await db.queryOne('SELECT c.*, d.user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = $1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.queryOne(
            'UPDATE cards SET front = $1, back = $2, front_image = $3, back_image = $4 WHERE id = $5 RETURNING *',
            [front, back, front_image !== undefined ? front_image : card.front_image, back_image !== undefined ? back_image : card.back_image, id]
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/cards/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const card = await db.queryOne('SELECT c.*, d.user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = $1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute('DELETE FROM cards WHERE id = $1', [id]);
        res.json({ message: 'Card deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update card progress
app.put('/api/cards/:id/progress', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { difficulty, times_reviewed, times_correct, last_reviewed, next_review } = req.body;

    try {
        const userId = req.user?.id || null;
        const card = await db.queryOne('SELECT c.*, d.user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = $1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.queryOne(
            'UPDATE cards SET difficulty = COALESCE($1, difficulty), times_reviewed = COALESCE($2, times_reviewed), times_correct = COALESCE($3, times_correct), last_reviewed = COALESCE($4, last_reviewed), next_review = COALESCE($5, next_review) WHERE id = $6 RETURNING *',
            [difficulty, times_reviewed, times_correct, last_reviewed, next_review, id]
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder cards
app.put('/api/decks/:id/cards/reorder', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { cardIds } = req.body;
    if (!cardIds || !Array.isArray(cardIds)) {
        return res.status(400).json({ error: 'cardIds array is required' });
    }

    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        for (let i = 0; i < cardIds.length; i++) {
            await db.execute('UPDATE cards SET position = $1 WHERE id = $2 AND deck_id = $3', [i, cardIds[i], id]);
        }
        res.json({ message: 'Cards reordered' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Review card (spaced repetition)
app.put('/api/cards/:id/review', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { correct } = req.body;

    try {
        const userId = req.user?.id || null;
        const card = await db.queryOne('SELECT c.*, d.user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = $1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        let newDifficulty = card.difficulty || 0;
        if (correct) {
            newDifficulty = Math.min(5, newDifficulty + 1);
        } else {
            newDifficulty = Math.max(0, newDifficulty - 1);
        }

        const intervals = [1, 3, 7, 14, 30, 60];
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + intervals[newDifficulty]);

        const result = await db.queryOne(
            'UPDATE cards SET difficulty = $1, times_reviewed = times_reviewed + 1, times_correct = times_correct + $2, last_reviewed = NOW(), next_review = $3 WHERE id = $4 RETURNING *',
            [newDifficulty, correct ? 1 : 0, nextReview.toISOString(), id]
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ STUDY SESSIONS ============

app.post('/api/study-sessions', optionalAuth, async (req, res) => {
    const { deck_id, cards_studied, cards_correct, duration_seconds, session_type } = req.body;

    try {
        // Verify deck ownership
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [deck_id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.queryOne(
            'INSERT INTO study_sessions (deck_id, cards_studied, cards_correct, duration_seconds, session_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [deck_id, cards_studied || 0, cards_correct || 0, duration_seconds || 0, session_type || 'study']
        );

        await db.execute('UPDATE decks SET last_studied = CURRENT_TIMESTAMP WHERE id = $1', [deck_id]);
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/study-sessions', optionalAuth, async (req, res) => {
    const { deck_id, limit = 10 } = req.query;

    try {
        let sessions;
        if (deck_id) {
            sessions = await db.query(
                'SELECT * FROM study_sessions WHERE deck_id = $1 ORDER BY created_at DESC LIMIT $2',
                [deck_id, parseInt(limit)]
            );
        } else {
            const userId = req.user?.id || null;
            if (userId) {
                sessions = await db.query(
                    'SELECT ss.* FROM study_sessions ss JOIN decks d ON ss.deck_id = d.id WHERE d.user_id = $1 ORDER BY ss.created_at DESC LIMIT $2',
                    [userId, parseInt(limit)]
                );
            } else {
                sessions = [];
            }
        }
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/decks/:id/stats', optionalAuth, async (req, res) => {
    const { id } = req.params;

    try {
        const sessions = await db.query(
            'SELECT * FROM study_sessions WHERE deck_id = $1 ORDER BY created_at DESC',
            [id]
        );
        const cards = await db.query('SELECT * FROM cards WHERE deck_id = $1', [id]);

        const totalStudied = sessions.reduce((sum, s) => sum + (s.cards_studied || 0), 0);
        const totalCorrect = sessions.reduce((sum, s) => sum + (s.cards_correct || 0), 0);
        const totalTime = sessions.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);

        // Calculate card difficulty distribution based on times_correct
        const cardsByDifficulty = {
            new: cards.filter(c => (c.times_correct || 0) === 0 && (c.times_reviewed || 0) === 0).length,
            learning: cards.filter(c => (c.times_reviewed || 0) > 0 && (c.times_correct || 0) < 2).length,
            familiar: cards.filter(c => (c.times_correct || 0) >= 2 && (c.times_correct || 0) < 5).length,
            mastered: cards.filter(c => (c.times_correct || 0) >= 5).length
        };

        res.json({
            totalSessions: sessions.length,
            totalCardsStudied: totalStudied,
            totalStudied, // alias for compatibility
            totalCorrect,
            accuracy: totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0,
            totalTimeSeconds: totalTime,
            totalTime, // alias for compatibility
            cardCount: cards.length,
            masteredCount: cardsByDifficulty.mastered,
            cardsByDifficulty,
            recentSessions: sessions.slice(0, 10)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ THEMES ============

app.get('/api/themes', optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        let themes = userId
            ? await db.query('SELECT * FROM themes WHERE user_id = $1', [userId])
            : await db.query('SELECT * FROM themes WHERE user_id IS NULL');

        // Auto-migrate old "Claude Dark"/"Claude Light" themes to new Riven palette
        if (userId) {
            for (const theme of themes) {
                if (theme.is_default && (theme.name === 'Claude Dark' || (theme.name === 'Dark' && theme.bg_color === '#0a0a0b'))) {
                    await db.execute(
                        `UPDATE themes SET name = 'Riven', bg_color = '#162a31', surface_color = '#1e3840', text_color = '#e4ddd0', secondary_text_color = '#8fa6a8', border_color = '#233e46', accent_color = '#deb96a' WHERE id = $1`,
                        [theme.id]
                    );
                } else if (theme.is_default && theme.name === 'Claude Light') {
                    await db.execute(
                        `UPDATE themes SET name = 'Riven Light', bg_color = '#f5f0e8', surface_color = '#ffffff', text_color = '#1e3840', secondary_text_color = '#6b7d7f', border_color = '#ddd5c8', accent_color = '#deb96a' WHERE id = $1`,
                        [theme.id]
                    );
                }
            }
            // Re-fetch after migration
            const migrated = themes.some(t => t.is_default && (t.name === 'Claude Dark' || t.name === 'Claude Light' || (t.name === 'Dark' && t.bg_color === '#0a0a0b')));
            if (migrated) {
                themes = await db.query('SELECT * FROM themes WHERE user_id = $1', [userId]);
            }
        }

        res.json(themes);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/themes', optionalAuth, async (req, res) => {
    const { name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color } = req.body;

    try {
        const userId = req.user?.id || null;
        const result = await db.queryOne(
            'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, font_family_display, font_family_body, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0) RETURNING *',
            [userId, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, req.body.font_family_display || 'Cormorant Garamond', req.body.font_family_body || 'Lora']
        );
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/themes/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1', [id]);
        if (!theme) return res.status(404).json({ error: 'Theme not found' });
        if (theme.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        if (theme.is_default) return res.status(400).json({ error: 'Cannot delete default themes' });

        await db.execute('DELETE FROM themes WHERE id = $1', [id]);
        res.json({ message: 'Theme deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/themes/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color } = req.body;

    try {
        const userId = req.user?.id || null;
        const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1', [id]);
        if (!theme) return res.status(404).json({ error: 'Theme not found' });
        if (theme.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });
        if (theme.is_default) return res.status(400).json({ error: 'Cannot edit default themes' });

        const result = await db.queryOne(
            `UPDATE themes SET 
                name = COALESCE($1, name),
                bg_color = COALESCE($2, bg_color),
                surface_color = COALESCE($3, surface_color),
                text_color = COALESCE($4, text_color),
                secondary_text_color = COALESCE($5, secondary_text_color),
                border_color = COALESCE($6, border_color),
                accent_color = COALESCE($7, accent_color),
                font_family_display = COALESCE($8, font_family_display),
                font_family_body = COALESCE($9, font_family_body)
            WHERE id = $10 RETURNING *`,
            [name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, req.body.font_family_display, req.body.font_family_body, id]
        );
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/themes/:id/activate', optionalAuth, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;

        if (userId) {
            await db.execute('UPDATE themes SET is_active = 0 WHERE user_id = $1', [userId]);
        } else {
            await db.execute('UPDATE themes SET is_active = 0 WHERE user_id IS NULL');
        }

        await db.execute('UPDATE themes SET is_active = 1 WHERE id = $1', [id]);
        res.json({ message: 'Theme activated' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ SHARING ============

// Accept a shared deck from a message
app.post('/api/messages/:id/accept-deck', authMiddleware, async (req, res) => {
    const messageId = req.params.id;
    try {
        const message = await db.queryOne('SELECT * FROM messages WHERE id = $1 AND receiver_id = $2', [messageId, req.user.id]);
        if (!message) return res.status(404).json({ error: 'Message not found' });
        if (message.message_type !== 'deck') return res.status(400).json({ error: 'Not a deck message' });

        const deckData = message.deck_data ? JSON.parse(message.deck_data) : null;
        if (!deckData || !deckData.id) return res.status(400).json({ error: 'Invalid deck data in message' });
        if (deckData.acceptedDeckId) return res.status(400).json({ error: 'Deck already accepted' });

        const originalDeckId = deckData.id;
        const originalDeck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [originalDeckId]);
        if (!originalDeck) return res.status(404).json({ error: 'Original deck no longer exists' });

        // Clone deck
        const newDeck = await db.queryOne(
            'INSERT INTO decks (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, originalDeck.title, originalDeck.description]
        );

        // Clone cards
        const cards = await db.query('SELECT * FROM cards WHERE deck_id = $1', [originalDeckId]);
        for (const card of cards) {
            await db.execute(
                'INSERT INTO cards (deck_id, front, back, front_image, back_image, position) VALUES ($1, $2, $3, $4, $5, $6)',
                [newDeck.id, card.front, card.back, card.front_image, card.back_image, card.position]
            );
        }

        // Clone tags
        const tags = await db.query('SELECT tag_id FROM deck_tags WHERE deck_id = $1', [originalDeckId]);
        for (const tag of tags) {
            await db.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES ($1, $2)', [newDeck.id, tag.tag_id]);
        }

        // Update message to mark as accepted
        deckData.acceptedDeckId = newDeck.id;
        await db.execute(
            'UPDATE messages SET deck_data = $1 WHERE id = $2',
            [JSON.stringify(deckData), messageId]
        );

        res.status(201).json({ newDeck, messageId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ADMIN ============
// ============ ADMIN ============

registerAdminRoutes({ app, db, authMiddleware });

// Get active messages for current user (non-dismissed, non-expired)
app.get('/api/messages', authMiddleware, async (req, res) => {
    try {
        const messages = await db.query(`
            SELECT gm.* FROM global_messages gm
            WHERE gm.is_active = 1 
            AND (gm.expires_at IS NULL OR gm.expires_at > NOW())
            AND gm.id NOT IN (
                SELECT message_id FROM user_dismissed_messages WHERE user_id = $1
            )
            ORDER BY gm.created_at DESC
        `, [req.user.id]);

        res.json(messages.map(m => ({
            id: m.id,
            title: m.title,
            content: m.content,
            type: m.type,
            createdAt: m.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Dismiss a message (user)
app.post('/api/messages/:id/dismiss', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        await db.execute(
            `INSERT INTO user_dismissed_messages (user_id, message_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [req.user.id, id]
        );
        res.json({ message: 'Message dismissed' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to dismiss message' });
    }
});

// ============ HEALTH CHECK ============

registerHealthRoutes({ app, db });

if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
