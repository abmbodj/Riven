const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET environment variable is required in production');
    process.exit(1);
}
const jwtSecret = JWT_SECRET || 'dev-only-secret-do-not-use-in-production';

// Rate limiters
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
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
    : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
    origin: function(origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
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

// Optional auth middleware
function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        try {
            const decoded = jwt.verify(token, jwtSecret);
            req.user = decoded;
        } catch (err) {}
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

// Register
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
        const existingEmail = await db.queryOne('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email]);
        if (existingEmail) {
            return res.status(400).json({ error: 'Account with this email or username already exists' });
        }

        const existingUsername = await db.queryOne('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username]);
        if (existingUsername) {
            return res.status(400).json({ error: 'Account with this email or username already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 12);
        const shareCode = generateShareCode();

        const result = await db.queryOne(
            'INSERT INTO users (username, email, password, share_code) VALUES ($1, $2, $3, $4) RETURNING id',
            [username, email.toLowerCase(), hashedPassword, shareCode]
        );
        const userId = result.id;

        // Create default themes
        await db.execute(
            'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [userId, 'Claude Dark', '#1a1a18', '#242422', '#e8e8e3', '#a1a19a', '#3d3d3a', '#d97757', 1, 1]
        );
        await db.execute(
            'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
            [userId, 'Claude Light', '#f9f7f2', '#ffffff', '#1d1d1b', '#6b6b6b', '#e5e2da', '#d97757', 0, 1]
        );

        // Create preset tags
        const presetTags = [
            ['Language', '#3b82f6'], ['Science', '#22c55e'], ['Math', '#f59e0b'], ['History', '#8b5cf6'],
            ['Programming', '#06b6d4'], ['Medical', '#ef4444'], ['Business', '#ec4899'], ['Art', '#f97316']
        ];
        for (const [name, color] of presetTags) {
            await db.execute('INSERT INTO tags (user_id, name, color, is_preset) VALUES ($1, $2, $3, 1)', [userId, name, color]);
        }

        const token = jwt.sign({ id: userId, email: email.toLowerCase() }, jwtSecret, { expiresIn: '30d' });

        res.status(201).json({
            token,
            user: { id: userId, username, email: email.toLowerCase(), shareCode, avatar: null, bio: '', streakData: {} }
        });
    } catch (error) {
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
app.post('/api/auth/login', authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        const user = await db.queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);
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
                id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
                avatar: user.avatar, bio: user.bio || '', isAdmin: user.is_admin === 1,
                streakData: JSON.parse(user.streak_data || '{}')
            }
        });
    } catch (error) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
app.get('/api/auth/me', authMiddleware, async (req, res) => {
    try {
        const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
            avatar: user.avatar, bio: user.bio || '', streakData: JSON.parse(user.streak_data || '{}'),
            isAdmin: user.is_admin === 1, createdAt: user.created_at
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update profile
app.put('/api/auth/profile', authMiddleware, async (req, res) => {
    const { username, bio, avatar } = req.body;
    try {
        if (username) {
            const existing = await db.queryOne('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [username, req.user.id]);
            if (existing) return res.status(400).json({ error: 'Username already taken' });
        }

        await db.execute(
            'UPDATE users SET username = COALESCE($1, username), bio = COALESCE($2, bio), avatar = COALESCE($3, avatar) WHERE id = $4',
            [username, bio, avatar, req.user.id]
        );

        const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
        res.json({
            id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
            avatar: user.avatar, bio: user.bio || '', streakData: JSON.parse(user.streak_data || '{}'),
            isAdmin: user.is_admin === 1, createdAt: user.created_at
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
        const user = await db.queryOne('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

        const hashedPassword = await bcrypt.hash(newPassword, 12);
        await db.execute('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);
        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete account
app.delete('/api/auth/account', authMiddleware, async (req, res) => {
    const { password } = req.body;
    try {
        const user = await db.queryOne('SELECT password FROM users WHERE id = $1', [req.user.id]);
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Password is incorrect' });

        await db.execute('DELETE FROM users WHERE id = $1', [req.user.id]);
        res.json({ message: 'Account deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Streak endpoints
app.put('/api/auth/streak', authMiddleware, async (req, res) => {
    const { streakData } = req.body;
    try {
        await db.execute('UPDATE users SET streak_data = $1 WHERE id = $2', [JSON.stringify(streakData), req.user.id]);
        res.json({ message: 'Streak data saved' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/auth/streak', authMiddleware, async (req, res) => {
    try {
        const user = await db.queryOne('SELECT streak_data FROM users WHERE id = $1', [req.user.id]);
        res.json(JSON.parse(user.streak_data || '{}'));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Migrate guest data
app.post('/api/auth/migrate-guest-data', authMiddleware, async (req, res) => {
    const { folders, tags, decks, cards, studySessions, deckTags } = req.body;
    const userId = req.user.id;

    try {
        const folderIdMap = {};
        const tagIdMap = {};
        const deckIdMap = {};

        if (folders?.length > 0) {
            for (const folder of folders) {
                const result = await db.queryOne(
                    'INSERT INTO folders (user_id, name, color, icon, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                    [userId, folder.name, folder.color || '#6366f1', folder.icon || 'folder', folder.created_at || new Date().toISOString()]
                );
                folderIdMap[folder.id] = result.id;
            }
        }

        if (tags?.length > 0) {
            const existingTags = await db.query('SELECT name FROM tags WHERE user_id = $1', [userId]);
            const existingNames = existingTags.map(t => t.name.toLowerCase());
            
            for (const tag of tags.filter(t => !t.is_preset)) {
                if (!existingNames.includes(tag.name.toLowerCase())) {
                    const result = await db.queryOne(
                        'INSERT INTO tags (user_id, name, color, is_preset, created_at) VALUES ($1, $2, $3, 0, $4) RETURNING id',
                        [userId, tag.name, tag.color, tag.created_at || new Date().toISOString()]
                    );
                    tagIdMap[tag.id] = result.id;
                }
            }
        }

        if (decks?.length > 0) {
            for (const deck of decks) {
                const newFolderId = deck.folder_id ? folderIdMap[deck.folder_id] : null;
                const result = await db.queryOne(
                    'INSERT INTO decks (user_id, title, description, folder_id, created_at, last_studied) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                    [userId, deck.title, deck.description || '', newFolderId, deck.created_at || new Date().toISOString(), deck.last_studied || null]
                );
                deckIdMap[deck.id] = result.id;
            }
        }

        if (cards?.length > 0) {
            for (const card of cards) {
                const newDeckId = deckIdMap[card.deck_id];
                if (newDeckId) {
                    await db.execute(
                        'INSERT INTO cards (deck_id, front, back, position, difficulty, times_reviewed, times_correct, last_reviewed, next_review, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                        [newDeckId, card.front, card.back, card.position || 0, card.difficulty || 0, card.times_reviewed || 0, card.times_correct || 0, card.last_reviewed || null, card.next_review || null, card.created_at || new Date().toISOString()]
                    );
                }
            }
        }

        if (deckTags?.length > 0) {
            for (const dt of deckTags) {
                const newDeckId = deckIdMap[dt.deck_id];
                const newTagId = tagIdMap[dt.tag_id];
                if (newDeckId && newTagId) {
                    await db.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newDeckId, newTagId]);
                }
            }
        }

        if (studySessions?.length > 0) {
            for (const session of studySessions) {
                const newDeckId = deckIdMap[session.deck_id];
                if (newDeckId) {
                    await db.execute(
                        'INSERT INTO study_sessions (deck_id, cards_studied, cards_correct, duration_seconds, session_type, created_at) VALUES ($1, $2, $3, $4, $5, $6)',
                        [newDeckId, session.cards_studied || 0, session.cards_correct || 0, session.duration_seconds || 0, session.session_type || 'study', session.created_at || new Date().toISOString()]
                    );
                }
            }
        }

        res.json({ 
            message: 'Guest data migrated successfully',
            imported: { folders: Object.keys(folderIdMap).length, tags: Object.keys(tagIdMap).length, decks: Object.keys(deckIdMap).length }
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to migrate guest data' });
    }
});

// ============ SOCIAL / FRIENDS ============

// Search users by username or share code
app.get('/api/users/search', authMiddleware, async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);
    
    try {
        const users = await db.query(
            `SELECT id, username, avatar, bio, share_code FROM users 
             WHERE id != $1 AND (LOWER(username) LIKE LOWER($2) OR UPPER(share_code) = UPPER($3))
             LIMIT 20`,
            [req.user.id, `%${q}%`, q]
        );
        res.json(users.map(u => ({
            id: u.id, username: u.username, avatar: u.avatar, bio: u.bio, shareCode: u.share_code
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get user profile by ID
app.get('/api/users/:id', authMiddleware, async (req, res) => {
    try {
        const user = await db.queryOne(
            'SELECT id, username, avatar, bio, share_code, created_at FROM users WHERE id = $1',
            [req.params.id]
        );
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Check friendship status
        const friendship = await db.queryOne(
            `SELECT * FROM friendships 
             WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [req.user.id, req.params.id]
        );
        
        // Count public stats
        const deckCount = await db.queryOne('SELECT COUNT(*) as count FROM decks WHERE user_id = $1', [req.params.id]);
        
        res.json({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            bio: user.bio,
            shareCode: user.share_code,
            createdAt: user.created_at,
            deckCount: parseInt(deckCount.count),
            friendshipStatus: friendship ? friendship.status : null,
            friendshipDirection: friendship ? (friendship.user_id === req.user.id ? 'outgoing' : 'incoming') : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get friends list
app.get('/api/friends', authMiddleware, async (req, res) => {
    try {
        const friends = await db.query(
            `SELECT u.id, u.username, u.avatar, u.bio, f.status, f.user_id as requester_id, f.created_at
             FROM friendships f
             JOIN users u ON (CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END) = u.id
             WHERE (f.user_id = $1 OR f.friend_id = $1)
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );
        
        res.json(friends.map(f => ({
            id: f.id,
            username: f.username,
            avatar: f.avatar,
            bio: f.bio,
            status: f.status,
            isOutgoing: f.requester_id === req.user.id,
            createdAt: f.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Send friend request
app.post('/api/friends/request', authMiddleware, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    if (userId === req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });
    
    try {
        // Check if user exists
        const targetUser = await db.queryOne('SELECT id, username FROM users WHERE id = $1', [userId]);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });
        
        // Check existing friendship
        const existing = await db.queryOne(
            `SELECT * FROM friendships 
             WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [req.user.id, userId]
        );
        
        if (existing) {
            if (existing.status === 'accepted') return res.status(400).json({ error: 'Already friends' });
            if (existing.status === 'pending') return res.status(400).json({ error: 'Friend request already pending' });
        }
        
        await db.execute(
            'INSERT INTO friendships (user_id, friend_id, status) VALUES ($1, $2, $3)',
            [req.user.id, userId, 'pending']
        );
        
        res.json({ message: 'Friend request sent', username: targetUser.username });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Accept friend request
app.post('/api/friends/accept', authMiddleware, async (req, res) => {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'User ID is required' });
    
    try {
        const friendship = await db.queryOne(
            `SELECT * FROM friendships WHERE user_id = $1 AND friend_id = $2 AND status = 'pending'`,
            [userId, req.user.id]
        );
        
        if (!friendship) return res.status(404).json({ error: 'No pending request found' });
        
        await db.execute(
            `UPDATE friendships SET status = 'accepted' WHERE user_id = $1 AND friend_id = $2`,
            [userId, req.user.id]
        );
        
        res.json({ message: 'Friend request accepted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Decline/remove friend
app.delete('/api/friends/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    
    try {
        await db.execute(
            `DELETE FROM friendships 
             WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
            [req.user.id, userId]
        );
        
        res.json({ message: 'Friend removed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

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
    const { receiverId, content, messageType = 'text', deckData } = req.body;
    
    if (!receiverId) return res.status(400).json({ error: 'Receiver ID is required' });
    if (!content && messageType === 'text') return res.status(400).json({ error: 'Message content is required' });
    
    try {
        // Verify receiver exists
        const receiver = await db.queryOne('SELECT id FROM users WHERE id = $1', [receiverId]);
        if (!receiver) return res.status(404).json({ error: 'User not found' });
        
        const message = await db.queryOne(
            `INSERT INTO messages (sender_id, receiver_id, content, message_type, deck_data) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [req.user.id, receiverId, content, messageType, deckData ? JSON.stringify(deckData) : null]
        );
        
        res.json({
            id: message.id,
            senderId: message.sender_id,
            content: message.content,
            messageType: message.message_type,
            deckData: message.deck_data ? JSON.parse(message.deck_data) : null,
            createdAt: message.created_at,
            isMine: true
        });
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
        const folders = userId 
            ? await db.query('SELECT * FROM folders WHERE user_id = $1 ORDER BY created_at DESC', [userId])
            : await db.query('SELECT * FROM folders WHERE user_id IS NULL ORDER BY created_at DESC');
        
        const foldersWithCount = await Promise.all(folders.map(async folder => {
            const count = await db.queryOne('SELECT COUNT(*) as count FROM decks WHERE folder_id = $1', [folder.id]);
            return { ...folder, deckCount: parseInt(count.count) };
        }));
        res.json(foldersWithCount);
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
        const decks = userId
            ? await db.query('SELECT * FROM decks WHERE user_id = $1 ORDER BY created_at DESC', [userId])
            : await db.query('SELECT * FROM decks WHERE user_id IS NULL ORDER BY created_at DESC');
        
        const decksWithDetails = await Promise.all(decks.map(async deck => {
            const count = await db.queryOne('SELECT COUNT(*) as count FROM cards WHERE deck_id = $1', [deck.id]);
            const tags = await db.query(
                'SELECT t.* FROM tags t JOIN deck_tags dt ON t.id = dt.tag_id WHERE dt.deck_id = $1',
                [deck.id]
            );
            return { ...deck, cardCount: parseInt(count.count), tags };
        }));
        res.json(decksWithDetails);
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
                'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4)',
                [newDeck.id, card.front, card.back, card.position]
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
    const { front, back } = req.body;
    if (!front || !back) return res.status(400).json({ error: 'Front and back are required' });

    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const maxPos = await db.queryOne('SELECT COALESCE(MAX(position), -1) as max FROM cards WHERE deck_id = $1', [id]);
        const result = await db.queryOne(
            'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4) RETURNING *',
            [id, front, back, (maxPos.max || 0) + 1]
        );
        res.status(201).json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.put('/api/cards/:id', optionalAuth, async (req, res) => {
    const { id } = req.params;
    const { front, back } = req.body;
    if (!front || !back) return res.status(400).json({ error: 'Front and back are required' });

    try {
        const userId = req.user?.id || null;
        const card = await db.queryOne('SELECT c.*, d.user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = $1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.queryOne('UPDATE cards SET front = $1, back = $2 WHERE id = $3 RETURNING *', [front, back, id]);
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
        const result = await db.queryOne(
            'UPDATE cards SET difficulty = COALESCE($1, difficulty), times_reviewed = COALESCE($2, times_reviewed), times_correct = COALESCE($3, times_correct), last_reviewed = COALESCE($4, last_reviewed), next_review = COALESCE($5, next_review) WHERE id = $6 RETURNING *',
            [difficulty, times_reviewed, times_correct, last_reviewed, next_review, id]
        );
        if (!result) return res.status(404).json({ error: 'Card not found' });
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

// ============ STUDY SESSIONS ============

app.post('/api/study-sessions', optionalAuth, async (req, res) => {
    const { deck_id, cards_studied, cards_correct, duration_seconds, session_type } = req.body;
    
    try {
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
            new: cards.filter(c => (c.times_correct || 0) === 0 && (c.times_studied || 0) === 0).length,
            learning: cards.filter(c => (c.times_studied || 0) > 0 && (c.times_correct || 0) < 2).length,
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
        const themes = userId
            ? await db.query('SELECT * FROM themes WHERE user_id = $1', [userId])
            : await db.query('SELECT * FROM themes WHERE user_id IS NULL');
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
            'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0) RETURNING *',
            [userId, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color]
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
                accent_color = COALESCE($7, accent_color)
            WHERE id = $8 RETURNING *`,
            [name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, id]
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

app.post('/api/decks/:id/share', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1 AND user_id = $2', [id, req.user.id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        const cards = await db.query('SELECT front, back, position FROM cards WHERE deck_id = $1 ORDER BY position', [id]);
        const deckData = JSON.stringify({ title: deck.title, description: deck.description, cards });

        const shareId = uuidv4().slice(0, 8);
        await db.execute(
            'INSERT INTO shared_decks (share_id, user_id, deck_id, deck_data) VALUES ($1, $2, $3, $4)',
            [shareId, req.user.id, id, deckData]
        );

        res.json({ shareId, shareUrl: `/share/${shareId}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/share/:shareId', async (req, res) => {
    const { shareId } = req.params;
    try {
        const shared = await db.queryOne('SELECT * FROM shared_decks WHERE share_id = $1', [shareId]);
        if (!shared) return res.status(404).json({ error: 'Shared deck not found' });

        const deckData = JSON.parse(shared.deck_data);
        res.json({ ...deckData, shareId, createdAt: shared.created_at });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/share/:shareId/import', authMiddleware, async (req, res) => {
    const { shareId } = req.params;
    try {
        const shared = await db.queryOne('SELECT * FROM shared_decks WHERE share_id = $1', [shareId]);
        if (!shared) return res.status(404).json({ error: 'Shared deck not found' });

        const deckData = JSON.parse(shared.deck_data);
        const newDeck = await db.queryOne(
            'INSERT INTO decks (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, deckData.title, deckData.description || '']
        );

        for (const card of deckData.cards || []) {
            await db.execute(
                'INSERT INTO cards (deck_id, front, back, position) VALUES ($1, $2, $3, $4)',
                [newDeck.id, card.front, card.back, card.position || 0]
            );
        }

        res.status(201).json(newDeck);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/my-shares', authMiddleware, async (req, res) => {
    try {
        const shared = await db.query('SELECT * FROM shared_decks WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
        res.json(shared.map(s => ({ ...s, deckData: JSON.parse(s.deck_data) })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.delete('/api/share/:shareId', authMiddleware, async (req, res) => {
    const { shareId } = req.params;
    try {
        const result = await db.execute('DELETE FROM shared_decks WHERE share_id = $1 AND user_id = $2', [shareId, req.user.id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Shared deck not found' });
        res.json({ message: 'Share link deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============ ADMIN ============

function adminMiddleware(req, res, next) {
    if (!req.user?.isAdmin) return res.status(403).json({ error: 'Admin access required' });
    next();
}

app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const users = await db.query('SELECT id, username, email, share_code, avatar, bio, streak_data, is_admin, created_at FROM users ORDER BY created_at DESC');
        res.json(users.map(u => ({
            id: u.id, username: u.username, email: u.email, shareCode: u.share_code,
            avatar: u.avatar, bio: u.bio || '', streakData: JSON.parse(u.streak_data || '{}'),
            isAdmin: u.is_admin === 1, createdAt: u.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { username, email, bio, isAdmin } = req.body;
    
    try {
        if (parseInt(id) === req.user.id && isAdmin === false) {
            return res.status(400).json({ error: 'Cannot remove your own admin status' });
        }
        
        await db.execute(
            'UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email), bio = COALESCE($3, bio), is_admin = COALESCE($4, is_admin) WHERE id = $5',
            [username, email, bio, isAdmin ? 1 : 0, id]
        );
        
        const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [id]);
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        res.json({ id: user.id, username: user.username, email: user.email, isAdmin: user.is_admin === 1 });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

app.delete('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        if (parseInt(id) === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }
        
        const result = await db.execute('DELETE FROM users WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

app.get('/api/admin/stats', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const userCount = await db.queryOne('SELECT COUNT(*) as count FROM users');
        const deckCount = await db.queryOne('SELECT COUNT(*) as count FROM decks');
        const cardCount = await db.queryOne('SELECT COUNT(*) as count FROM cards');
        const sharedCount = await db.queryOne('SELECT COUNT(*) as count FROM shared_decks');
        const messageCount = await db.queryOne('SELECT COUNT(*) as count FROM global_messages WHERE is_active = 1');
        
        // Get recent signups (last 7 days)
        const recentUsers = await db.queryOne(`
            SELECT COUNT(*) as count FROM users 
            WHERE created_at > NOW() - INTERVAL '7 days'
        `);
        
        // Get study sessions in last 7 days
        const recentSessions = await db.queryOne(`
            SELECT COUNT(*) as count FROM study_sessions 
            WHERE created_at > NOW() - INTERVAL '7 days'
        `);
        
        res.json({
            users: parseInt(userCount.count),
            decks: parseInt(deckCount.count),
            cards: parseInt(cardCount.count),
            sharedDecks: parseInt(sharedCount.count),
            activeMessages: parseInt(messageCount.count),
            recentSignups: parseInt(recentUsers.count),
            recentSessions: parseInt(recentSessions.count)
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// ============ GLOBAL MESSAGES ============

// Get all messages (admin)
app.get('/api/admin/messages', authMiddleware, adminMiddleware, async (req, res) => {
    try {
        const messages = await db.query(`
            SELECT gm.*, u.username as created_by_username 
            FROM global_messages gm 
            LEFT JOIN users u ON gm.created_by = u.id 
            ORDER BY gm.created_at DESC
        `);
        res.json(messages.map(m => ({
            id: m.id,
            title: m.title,
            content: m.content,
            type: m.type,
            isActive: m.is_active === 1,
            createdBy: m.created_by_username || 'System',
            createdAt: m.created_at,
            expiresAt: m.expires_at
        })));
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch messages' });
    }
});

// Create a global message (admin)
app.post('/api/admin/messages', authMiddleware, adminMiddleware, async (req, res) => {
    const { title, content, type, expiresAt } = req.body;
    
    if (!title || !content) {
        return res.status(400).json({ error: 'Title and content are required' });
    }
    
    if (title.length > 100) {
        return res.status(400).json({ error: 'Title must be under 100 characters' });
    }
    
    if (content.length > 1000) {
        return res.status(400).json({ error: 'Content must be under 1000 characters' });
    }
    
    const validTypes = ['info', 'warning', 'success', 'error'];
    const messageType = validTypes.includes(type) ? type : 'info';
    
    try {
        const result = await db.queryOne(
            `INSERT INTO global_messages (title, content, type, created_by, expires_at) 
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [title, content, messageType, req.user.id, expiresAt || null]
        );
        
        res.status(201).json({
            id: result.id,
            title: result.title,
            content: result.content,
            type: result.type,
            isActive: result.is_active === 1,
            createdAt: result.created_at,
            expiresAt: result.expires_at
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to create message' });
    }
});

// Toggle message active status (admin)
app.put('/api/admin/messages/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    const { isActive, title, content, type } = req.body;
    
    try {
        await db.execute(
            `UPDATE global_messages SET 
                is_active = COALESCE($1, is_active),
                title = COALESCE($2, title),
                content = COALESCE($3, content),
                type = COALESCE($4, type)
             WHERE id = $5`,
            [isActive !== undefined ? (isActive ? 1 : 0) : null, title, content, type, id]
        );
        
        const message = await db.queryOne('SELECT * FROM global_messages WHERE id = $1', [id]);
        if (!message) return res.status(404).json({ error: 'Message not found' });
        
        res.json({
            id: message.id,
            title: message.title,
            content: message.content,
            type: message.type,
            isActive: message.is_active === 1
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update message' });
    }
});

// Delete a global message (admin)
app.delete('/api/admin/messages/:id', authMiddleware, adminMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const result = await db.execute('DELETE FROM global_messages WHERE id = $1', [id]);
        if (result.rowCount === 0) return res.status(404).json({ error: 'Message not found' });
        res.json({ message: 'Message deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete message' });
    }
});

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

app.get('/api/health', async (req, res) => {
    try {
        await db.queryOne('SELECT 1');
        res.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(503).json({ status: 'error', message: 'Database unavailable' });
    }
});

app.listen(PORT, () => {
    // Server started on PORT
});
