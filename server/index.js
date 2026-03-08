if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config({ override: true });
}
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const helmet = require('helmet');
const slowDown = require('express-slow-down');
const xss = require('xss');
const db = require('./db');
const registerAuthRoutes = require('./routes/auth');
const registerSocialRoutes = require('./routes/social');
const registerHealthRoutes = require('./routes/health');
const registerAdminRoutes = require('./routes/admin');
const registerClassesRoutes = require('./routes/classes');
const registerAssignmentsRoutes = require('./routes/assignments');
const registerScheduleRoutes = require('./routes/schedule');
const registerLMSRoutes = require('./routes/lms');
const registerAIRoutes = require('./routes/ai');
const registerGroupsRoutes = require('./routes/groups');
const registerHeartsRoutes = require('./routes/hearts');
const registerWebhooksRoutes = require('./routes/webhooks');
const registerReferralRoutes = require('./routes/referrals');
const registerStripeRoutes = require('./routes/stripe');

const app = express();
const server = http.createServer(app);
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

// Rate limiters (strict in production, relaxed in dev)
const isProdEnv = process.env.NODE_ENV === 'production';
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProdEnv ? 10 : 100,
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: isProdEnv ? 3 : 20,
    delayMs: (hits) => hits * 200
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
    : ['http://localhost:5173', 'http://localhost:3000', 'https://riven-virid.vercel.app', 'capacitor://localhost', 'http://localhost'];

app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, or same-origin in some cases)
        if (!origin) return callback(null, true);

        // In development, allow any origin (e.g. mobile devices on LAN)
        if (process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }

        // Clean origin (remove trailing slash just in case)
        const cleanOrigin = origin.replace(/\/$/, '');

        if (process.env.ALLOWED_ORIGINS) {
            // Check if origin matches allowed list or ends with .vercel.app
            const isAllowed = allowedOrigins.some(o => cleanOrigin === o.replace(/\/$/, '')) ||
                cleanOrigin.endsWith('.vercel.app');

            if (isAllowed) {
                callback(null, true);
            } else {
                console.error(`[CORS] Blocked request from origin: ${cleanOrigin} (Not in ALLOWED_ORIGINS)`);
                // Passing false instead of new Error() prevents Express from returning a 500 status code.
                // It just omits the CORS headers, resulting in a cleaner browser 403/CORS error if needed.
                // However, let's actually just allow it and log the warning for now to prevent users from getting permanently stuck if they misconfigure strings!
                // To be fully safe in production you would pass false, but to fix this issue let's accept it but heavily log.
                // Actually, since they explicitly want strict (Option 1), let's block it securely but without 500ing:
                callback(null, false);
            }
        } else {
            callback(null, true); // Allow all by default if no STRICT whitelist is provided
        }
    },
    credentials: true
}));

// Re-enable Content Security Policy (Helmet default) but allow frontend endpoints
const helmetConnectSrc = process.env.ALLOWED_ORIGINS
    ? ["'self'", ...allowedOrigins, "https://*.vercel.app"]
    : ["'self'", "*"];

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: helmetConnectSrc,
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const io = new Server(server, {
    cors: {
        origin: function (origin, callback) {
            if (!origin) return callback(null, true);

            const cleanOrigin = origin.replace(/\/$/, '');

            if (process.env.ALLOWED_ORIGINS) {
                const isAllowed = allowedOrigins.some(o => cleanOrigin === o.replace(/\/$/, '')) || cleanOrigin.endsWith('.vercel.app');
                if (isAllowed) {
                    callback(null, true);
                } else {
                    return callback(new Error('Not allowed by CORS'));
                }
            } else {
                callback(null, true);
            }
        },
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Map to store connected users: userId -> socketId
const connectedUsers = new Map();

io.on('connection', (socket) => {
    // We expect the client to pass their token or userId in the handshake or auth.
    // However, it's simpler if they just emit a 'register' event shortly after connecting
    // since we use HttpOnly cookies that sockets may not easily read depending on cross-origin setup.

    socket.on('register', (token) => {
        if (!token) return;
        try {
            const decoded = jwt.verify(token, jwtSecret);
            if (decoded?.id) {
                connectedUsers.set(parseInt(decoded.id), socket.id);
            }
        } catch (err) {
            // Invalid token — ignore registration
        }
    });

    socket.on('typing', ({ receiverId, isTyping }) => {
        const parsedReceiverId = parseInt(receiverId);
        if (isNaN(parsedReceiverId)) return;
        const receiverSocketId = connectedUsers.get(parsedReceiverId);
        if (receiverSocketId) {
            let senderId = null;
            for (const [id, sid] of connectedUsers.entries()) {
                if (sid === socket.id) {
                    senderId = id;
                    break;
                }
            }
            if (senderId) {
                io.to(receiverSocketId).emit('typing', { senderId, isTyping });
            }
        }
    });

    socket.on('join-room', (roomId) => {
        if (roomId && typeof roomId === 'string') socket.join(roomId);
    });

    socket.on('leave-room', (roomId) => {
        if (roomId && typeof roomId === 'string') socket.leave(roomId);
    });

    socket.on('disconnect', () => {
        // Remove from map
        for (const [userId, socketId] of connectedUsers.entries()) {
            if (socketId === socket.id) {
                connectedUsers.delete(userId);
                // console.log(`[Socket] User ${userId} disconnected`);
                break;
            }
        }
    });
});

// Make io accessible to routes via app locals
app.locals.io = io;
app.locals.connectedUsers = connectedUsers;

app.use(cookieParser());
// Stripe webhook needs raw body for signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '1mb' }));

// Recursive Deep XSS Sanitization utility function
function sanitizeDeep(obj) {
    if (typeof obj === 'string') {
        return xss(obj);
    }
    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeDeep(item));
    }
    if (typeof obj === 'object' && obj !== null) {
        const sanitizedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitizedObj[key] = sanitizeDeep(value);
        }
        return sanitizedObj;
    }
    return obj;
}

// Input sanitization middleware
app.use((req, res, next) => {
    // Skip sanitization for Stripe webhooks as it needs the raw Buffer body for signature verification
    if (req.path === '/api/webhooks/stripe') return next();

    if (process.env.NODE_ENV !== 'test') {
        if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
            req.body = sanitizeDeep(req.body);
        }
        if (req.query) req.query = sanitizeDeep(req.query);
        if (req.params) req.params = sanitizeDeep(req.params);
    }
    next();
});

app.use('/api/', apiLimiter);

// Ensure DB schema is ready before handling API requests (serverless cold-start safety)
app.use('/api/', async (req, res, next) => {
    try {
        await db.ready();
        next();
    } catch (err) {
        console.error('DB not ready:', err.message);
        res.status(503).json({ error: 'Database initializing, please retry' });
    }
});

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

// ============ CLASSES ============

registerClassesRoutes({ app, db, authMiddleware });

// ============ ASSIGNMENTS ============

registerAssignmentsRoutes({ app, db, authMiddleware });

// ============ SCHEDULE ============

registerScheduleRoutes({ app, db, authMiddleware });

// ============ LMS INTEGRATION ============

registerLMSRoutes({ app, db, authMiddleware });

// ============ AI GENERATION ============

registerAIRoutes({ app, db, authMiddleware, rateLimit, ipKeyGenerator });

// ============ HEARTS / MONETIZATION ============

registerHeartsRoutes({ app, db, authMiddleware });
registerReferralRoutes({ app, db, authMiddleware });

// ============ WEBHOOKS ============

registerWebhooksRoutes({ app, db });

// ============ STRIPE ============
const stripeRouter = registerStripeRoutes({ db });
app.use('/api/stripe', authMiddleware, stripeRouter);

// ============ GROUPS ============

registerGroupsRoutes({ app, db, authMiddleware, io });

// ============ MESSAGES ============

// Get conversations (list of users you have messages with)
app.get('/api/messages/conversations', authMiddleware, async (req, res) => {
    try {
        const conversations = await db.query(
            `WITH unread AS (
                SELECT sender_id, COUNT(*) AS cnt
                FROM messages
                WHERE receiver_id = $1 AND is_read = 0
                GROUP BY sender_id
             )
             SELECT DISTINCT ON (other_user_id)
                other_user_id,
                u.username,
                u.avatar,
                m.content as last_message,
                m.message_type as last_message_type,
                m.created_at as last_message_at,
                m.sender_id,
                COALESCE(ur.cnt, 0) as unread_count
             FROM (
                SELECT
                    CASE WHEN sender_id = $1 THEN receiver_id ELSE sender_id END as other_user_id,
                    id
                FROM messages
                WHERE sender_id = $1 OR receiver_id = $1
             ) sub
             JOIN messages m ON m.id = sub.id
             JOIN users u ON u.id = sub.other_user_id
             LEFT JOIN unread ur ON ur.sender_id = sub.other_user_id
             WHERE NOT EXISTS (
                 SELECT 1 FROM user_blocks
                 WHERE (blocker_id = $1 AND blocked_id = sub.other_user_id)
                    OR (blocked_id = $1 AND blocker_id = sub.other_user_id)
             )
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
        console.error('Fetch conversations error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get messages with a specific user
app.get('/api/messages/:userId', authMiddleware, async (req, res) => {
    const { userId } = req.params;
    const { limit = 50, before } = req.query;
    const cappedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    try {
        let innerQuery = `
            SELECT m.*, u.username as sender_username, u.avatar as sender_avatar
            FROM messages m
            JOIN users u ON u.id = m.sender_id
            WHERE (m.sender_id = $1 AND m.receiver_id = $2) OR (m.sender_id = $2 AND m.receiver_id = $1)
        `;
        const params = [req.user.id, userId];

        if (before) {
            innerQuery += ` AND m.created_at < $3`;
            params.push(before);
        }

        innerQuery += ` ORDER BY m.created_at DESC LIMIT $${params.length + 1}`;
        params.push(cappedLimit);

        // Wrap in subquery to return chronological order without .reverse()
        const query = `SELECT * FROM (${innerQuery}) sub ORDER BY sub.created_at ASC`;
        const messages = await db.query(query, params);

        // Mark as read (fire-and-forget to not block response)
        db.execute(
            `UPDATE messages SET is_read = 1 WHERE sender_id = $1 AND receiver_id = $2 AND is_read = 0`,
            [userId, req.user.id]
        ).catch(() => { });

        res.json(messages.map(m => ({
            id: m.id,
            senderId: m.sender_id,
            senderUsername: m.sender_username,
            senderAvatar: m.sender_avatar,
            content: m.content,
            messageType: m.message_type,
            deckData: m.deck_data ? (() => { try { return JSON.parse(m.deck_data); } catch { return null; } })() : null,
            imageUrl: m.image_url,
            isEdited: m.is_edited === 1,
            isRead: m.is_read === 1,
            createdAt: m.created_at,
            isMine: m.sender_id === req.user.id
        })));
    } catch (error) {
        console.error('Fetch messages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Rate limiter for message sending (30 messages per minute)
const messageLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: isProdEnv ? 30 : 200,
    message: { error: 'Too many messages sent, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Send a message
app.post('/api/messages', authMiddleware, messageLimiter, async (req, res) => {
    const { receiverId, content, messageType = 'text', deckData, imageUrl } = req.body;

    if (!receiverId) return res.status(400).json({ error: 'Receiver ID is required' });
    if (!content && !imageUrl && !deckData) return res.status(400).json({ error: 'Message content, image or deck is required' });
    if (content && (typeof content !== 'string' || content.trim().length === 0 && !imageUrl && !deckData)) {
        return res.status(400).json({ error: 'Message content cannot be empty' });
    }
    if (content && content.length > 5000) {
        return res.status(400).json({ error: 'Message content must be under 5000 characters' });
    }

    try {
        // Check if sender is banned
        const senderCheck = await db.queryOne('SELECT is_banned, username, avatar FROM users WHERE id = $1', [req.user.id]);
        if (senderCheck && senderCheck.is_banned) {
            return res.status(403).json({ error: 'Your account has been restricted from sending messages.' });
        }

        // Verify receiver exists
        const receiver = await db.queryOne('SELECT id FROM users WHERE id = $1', [receiverId]);
        if (!receiver) return res.status(404).json({ error: 'User not found' });

        // Check if either user has blocked the other
        const blockCheck = await db.queryOne(
            `SELECT 1 FROM user_blocks 
             WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocked_id = $1 AND blocker_id = $2)`,
            [req.user.id, receiverId]
        );

        if (blockCheck) {
            return res.status(403).json({ error: 'Cannot send message. You have blocked this user or they have blocked you.' });
        }

        const message = await db.queryOne(
            `INSERT INTO messages (sender_id, receiver_id, content, message_type, deck_data, image_url) 
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [req.user.id, receiverId, content || '', messageType, deckData ? JSON.stringify(deckData) : null, imageUrl || null]
        );

        const responseData = {
            id: message.id,
            senderId: message.sender_id,
            senderUsername: senderCheck?.username,
            senderAvatar: senderCheck?.avatar,
            content: message.content,
            messageType: message.message_type,
            deckData: message.deck_data ? JSON.parse(message.deck_data) : null,
            imageUrl: message.image_url,
            isEdited: message.is_edited === 1,
            isRead: message.is_read === 1,
            createdAt: message.created_at,
            isMine: true
        };

        // Emit real-time event to receiver
        const io = req.app.locals.io;
        const connectedUsers = req.app.locals.connectedUsers;
        if (io && connectedUsers) {
            const receiverSocketId = connectedUsers.get(parseInt(receiverId));
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('new_message', {
                    ...responseData,
                    isMine: false
                });
                // Clear sender's typing indicator for the receiver
                io.to(receiverSocketId).emit('typing', { senderId: req.user.id, isTyping: false });
            }
            // Also notify the sender on other tabs/devices
            const senderSocketId = connectedUsers.get(parseInt(req.user.id));
            if (senderSocketId) {
                io.to(senderSocketId).emit('new_message', {
                    ...responseData,
                    isMine: true,
                    receiverId: parseInt(receiverId)
                });
            }
        }

        res.json(responseData);
    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Edit a message
app.put('/api/messages/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);
    const { content } = req.body;

    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });

    if (!content) return res.status(400).json({ error: 'Message content is required' });

    try {
        const message = await db.queryOne('SELECT * FROM messages WHERE id = $1 AND sender_id = $2', [id, req.user.id]);
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        const updated = await db.queryOne(
            `UPDATE messages SET content = $1, is_edited = 1 WHERE id = $2 RETURNING *`,
            [content, id]
        );

        const responseData = {
            id: updated.id,
            senderId: updated.sender_id,
            content: updated.content,
            messageType: updated.message_type,
            deckData: updated.deck_data ? JSON.parse(updated.deck_data) : null,
            imageUrl: updated.image_url,
            isEdited: updated.is_edited === 1,
            createdAt: updated.created_at,
            isMine: true
        };

        // Emit real-time event
        const io = req.app.locals.io;
        const connectedUsers = req.app.locals.connectedUsers;
        if (io && connectedUsers) {
            const receiverSocketId = connectedUsers.get(parseInt(updated.receiver_id));
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('message_updated', {
                    ...responseData,
                    isMine: false
                });
            }
        }

        res.json(responseData);
    } catch (error) {
        console.error('Edit message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete a message
app.delete('/api/messages/:id', authMiddleware, async (req, res) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) return res.status(400).json({ error: 'Invalid message ID' });

    try {
        const message = await db.queryOne('SELECT * FROM messages WHERE id = $1 AND sender_id = $2', [id, req.user.id]);
        if (!message) return res.status(404).json({ error: 'Message not found or unauthorized' });

        await db.execute('DELETE FROM messages WHERE id = $1', [id]);

        // Emit real-time event
        const io = req.app.locals.io;
        const connectedUsers = req.app.locals.connectedUsers;
        if (io && connectedUsers) {
            const receiverSocketId = connectedUsers.get(parseInt(message.receiver_id));
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('message_deleted', { id: parseInt(id) });
            }
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Delete message error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
        console.error('Fetch unread count error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ FOLDERS ============

app.get('/api/folders', authMiddleware, async (req, res) => {
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
        console.error('Fetch folders error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/folders', authMiddleware, async (req, res) => {
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
        console.error('Create folder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/folders/:id', authMiddleware, async (req, res) => {
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
        console.error('Update folder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/folders/:id', authMiddleware, async (req, res) => {
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
        console.error('Delete folder error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ TAGS ============

app.get('/api/tags', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const tags = userId
            ? await db.query('SELECT * FROM tags WHERE user_id = $1 ORDER BY is_preset DESC, name ASC', [userId])
            : await db.query('SELECT * FROM tags WHERE user_id IS NULL ORDER BY is_preset DESC, name ASC');
        res.json(tags);
    } catch (error) {
        console.error('Fetch tags error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/tags', authMiddleware, async (req, res) => {
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
        console.error('Tag creation error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/tags/:id', authMiddleware, async (req, res) => {
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
        console.error('Delete tag error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ DECKS ============

app.get('/api/decks', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        const userFilter = userId ? 'user_id = $1' : 'user_id IS NULL';
        const params = userId ? [userId] : [];

        // Single query: get decks with card counts
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
        console.error('Fetch decks error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/decks', authMiddleware, async (req, res) => {
    const { title, description, folder_id, tagIds, class_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (title.length > 200) return res.status(400).json({ error: 'Title must be under 200 characters' });
    if (description && description.length > 2000) return res.status(400).json({ error: 'Description must be under 2000 characters' });

    try {
        const userId = req.user?.id || null;
        const result = await db.queryOne(
            'INSERT INTO decks (user_id, title, description, folder_id, class_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [userId, title, description || '', folder_id || null, class_id || null]
        );
        const deckId = result.id;

        if (tagIds?.length > 0) {
            for (const tagId of tagIds) {
                await db.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES ($1, $2)', [deckId, tagId]);
            }
        }

        res.status(201).json({ id: deckId, title, description, folder_id, class_id });

        // Auto-check referral qualification (non-blocking)
        if (userId) {
            db.queryOne('SELECT * FROM referrals WHERE referred_id = $1', [userId]).then(async referral => {
                if (!referral) return;
                const deckCount = await db.queryOne('SELECT COUNT(*) as count FROM decks WHERE user_id = $1', [userId]);
                const hasDeck = parseInt(deckCount.count) >= 1;
                await db.execute('UPDATE referrals SET has_deck = $1 WHERE referred_id = $2', [hasDeck, userId]);
            }).catch(err => console.error('Referral deck check failed:', err));
        }
    } catch (error) {
        console.error('Create deck error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/decks/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        let isAuthorized = false;
        if (deck.user_id === userId) {
            isAuthorized = true;
        } else if (userId) {
            // Check if deck is shared in a group the user is a member of
            const sharedCheck = await db.queryOne(`
                SELECT 1 
                FROM group_decks gd
                JOIN group_members gm ON gd.group_id = gm.group_id
                WHERE gd.deck_id = $1 AND gm.user_id = $2
                LIMIT 1
            `, [id, userId]);
            if (sharedCheck) isAuthorized = true;
        }

        if (!isAuthorized) return res.status(403).json({ error: 'Not authorized' });

        const cards = await db.query('SELECT * FROM cards WHERE deck_id = $1 ORDER BY position', [id]);
        const tags = await db.query(
            'SELECT t.* FROM tags t JOIN deck_tags dt ON t.id = dt.tag_id WHERE dt.deck_id = $1',
            [id]
        );
        res.json({ ...deck, cards, tags });
    } catch (error) {
        console.error('Fetch deck detail error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/decks/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { title, description, folder_id, tagIds, class_id } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });
    if (title.length > 200) return res.status(400).json({ error: 'Title must be under 200 characters' });
    if (description && description.length > 2000) return res.status(400).json({ error: 'Description must be under 2000 characters' });

    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute(
            'UPDATE decks SET title = $1, description = $2, folder_id = $3, class_id = $4 WHERE id = $5',
            [title, description || '', folder_id || null, class_id || null, id]
        );

        if (tagIds !== undefined) {
            await db.execute('DELETE FROM deck_tags WHERE deck_id = $1', [id]);
            if (tagIds.length > 0) {
                for (const tagId of tagIds) {
                    await db.execute('INSERT INTO deck_tags (deck_id, tag_id) VALUES ($1, $2)', [id, tagId]);
                }
            }
        }

        res.json({ id, title, description, folder_id, class_id });
    } catch (error) {
        console.error('Update deck error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/decks/:id/move', authMiddleware, async (req, res) => {
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
        console.error('Move deck error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/decks/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute('DELETE FROM decks WHERE id = $1', [id]);
        res.json({ message: 'Deck deleted' });
    } catch (error) {
        console.error('Delete deck error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Duplicate deck (wrapped in transaction to prevent orphaned data on failure)
app.post('/api/decks/:id/duplicate', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const client = await db.pool.connect();
    try {
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });
        if (deck.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await client.query('BEGIN');

        const { rows: [newDeck] } = await client.query(
            'INSERT INTO decks (user_id, title, description, folder_id) VALUES ($1, $2, $3, $4) RETURNING *',
            [userId, `${deck.title} (Copy)`, deck.description, deck.folder_id]
        );

        const { rows: cards } = await client.query('SELECT front, back, front_image, back_image, position FROM cards WHERE deck_id = $1', [id]);
        if (cards.length > 0) {
            const values = [];
            const placeholders = cards.map((card, i) => {
                const offset = i * 6;
                values.push(newDeck.id, card.front, card.back, card.front_image, card.back_image, card.position);
                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
            });
            await client.query(
                `INSERT INTO cards (deck_id, front, back, front_image, back_image, position) VALUES ${placeholders.join(', ')}`,
                values
            );
        }

        const { rows: tags } = await client.query('SELECT tag_id FROM deck_tags WHERE deck_id = $1', [id]);
        if (tags.length > 0) {
            const values = [];
            const placeholders = tags.map((tag, i) => {
                const offset = i * 2;
                values.push(newDeck.id, tag.tag_id);
                return `($${offset + 1}, $${offset + 2})`;
            });
            await client.query(
                `INSERT INTO deck_tags (deck_id, tag_id) VALUES ${placeholders.join(', ')}`,
                values
            );
        }

        await client.query('COMMIT');
        res.status(201).json(newDeck);
    } catch (error) {
        await client.query('ROLLBACK').catch(() => { });
        console.error('Duplicate deck error:', error);
        res.status(500).json({ error: 'Internal server error' });
    } finally {
        client.release();
    }
});

// ============ CARDS ============

app.post('/api/decks/:id/cards', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { front, back, front_image, back_image } = req.body;
    // Require either text or image for both front and back
    if ((!front && !front_image) || (!back && !back_image)) {
        return res.status(400).json({ error: 'Front and back content (text or image) are required' });
    }
    if (front && front.length > 5000) return res.status(400).json({ error: 'Front content must be under 5000 characters' });
    if (back && back.length > 5000) return res.status(400).json({ error: 'Back content must be under 5000 characters' });

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
        console.error('Create card error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/cards/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { front, back, front_image, back_image } = req.body;
    // Require either text or image for both front and back
    if ((!front && !front_image) || (!back && !back_image)) {
        return res.status(400).json({ error: 'Front and back content (text or image) are required' });
    }
    if (front && front.length > 5000) return res.status(400).json({ error: 'Front content must be under 5000 characters' });
    if (back && back.length > 5000) return res.status(400).json({ error: 'Back content must be under 5000 characters' });

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
        console.error('Update card error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/cards/:id', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;
        const card = await db.queryOne('SELECT c.*, d.user_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = $1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });
        if (card.user_id !== userId) return res.status(403).json({ error: 'Not authorized' });

        await db.execute('DELETE FROM cards WHERE id = $1', [id]);
        res.json({ message: 'Card deleted' });
    } catch (error) {
        console.error('Delete card error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update card progress
app.put('/api/cards/:id/progress', authMiddleware, async (req, res) => {
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
        console.error('Update card progress error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Reorder cards
app.put('/api/decks/:id/cards/reorder', authMiddleware, async (req, res) => {
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

        if (cardIds.length > 0) {
            const cases = cardIds.map((_, i) => `WHEN id = $${i * 2 + 1}::int THEN $${i * 2 + 2}::int`).join(' ');
            const values = cardIds.flatMap((cardId, i) => [cardId, i]);
            const idPlaceholders = cardIds.map((_, i) => `$${i * 2 + 1}::int`).join(', ');
            values.push(id);
            await db.execute(
                `UPDATE cards SET position = CASE ${cases} END WHERE deck_id = $${values.length} AND id IN (${idPlaceholders})`,
                values
            );
        }
        res.json({ message: 'Cards reordered' });
    } catch (error) {
        console.error('Reorder cards error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Review card (spaced repetition)
app.put('/api/cards/:id/review', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const { correct } = req.body;

    try {
        const userId = req.user?.id || null;
        const card = await db.queryOne('SELECT c.*, d.user_id, d.id as deck_id FROM cards c JOIN decks d ON c.deck_id = d.id WHERE c.id = $1', [id]);
        if (!card) return res.status(404).json({ error: 'Card not found' });

        let isAuthorized = false;
        if (card.user_id === userId) {
            isAuthorized = true;
        } else if (userId) {
            const sharedCheck = await db.queryOne(`
                SELECT 1 
                FROM group_decks gd
                JOIN group_members gm ON gd.group_id = gm.group_id
                WHERE gd.deck_id = $1 AND gm.user_id = $2
                LIMIT 1
            `, [card.deck_id, userId]);
            if (sharedCheck) isAuthorized = true;
        }

        if (!isAuthorized) return res.status(403).json({ error: 'Not authorized' });

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
        console.error('Review card error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ STUDY SESSIONS ============

app.post('/api/study-sessions', authMiddleware, async (req, res) => {
    const { deck_id, cards_studied, cards_correct, duration_seconds, session_type } = req.body;

    try {
        // Verify deck ownership
        const userId = req.user?.id || null;
        const deck = await db.queryOne('SELECT * FROM decks WHERE id = $1', [deck_id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        let isAuthorized = false;
        if (deck.user_id === userId) {
            isAuthorized = true;
        } else if (userId) {
            const sharedCheck = await db.queryOne(`
                SELECT 1 
                FROM group_decks gd
                JOIN group_members gm ON gd.group_id = gm.group_id
                WHERE gd.deck_id = $1 AND gm.user_id = $2
                LIMIT 1
            `, [deck_id, userId]);
            if (sharedCheck) isAuthorized = true;
        }

        if (!isAuthorized) return res.status(403).json({ error: 'Not authorized' });

        const result = await db.queryOne(
            'INSERT INTO study_sessions (deck_id, cards_studied, cards_correct, duration_seconds, session_type) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [deck_id, cards_studied || 0, cards_correct || 0, duration_seconds || 0, session_type || 'study']
        );

        await db.execute('UPDATE decks SET last_studied = CURRENT_TIMESTAMP WHERE id = $1', [deck_id]);

        // Auto-check referral qualification for this user (transactional to prevent race conditions)
        if (userId) {
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');
                const { rows: [referral] } = await client.query(
                    'SELECT * FROM referrals WHERE referred_id = $1 FOR UPDATE', [userId]
                );
                if (referral) {
                    const { rows: [deckCount] } = await client.query(
                        'SELECT COUNT(*) as count FROM decks WHERE user_id = $1', [userId]
                    );
                    const hasDeck = parseInt(deckCount.count) >= 1;
                    const { rows: [sessionCount] } = await client.query(
                        'SELECT COUNT(*) as count FROM study_sessions ss JOIN decks d ON d.id = ss.deck_id WHERE d.user_id = $1', [userId]
                    );
                    const sessions = parseInt(sessionCount.count);
                    const qualified = hasDeck && sessions >= 10;
                    await client.query(
                        'UPDATE referrals SET has_deck = $1, session_count = $2, qualified = $3 WHERE referred_id = $4',
                        [hasDeck, sessions, qualified, userId]
                    );
                    if (qualified) {
                        const { rows: [qualCount] } = await client.query(
                            'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1 AND qualified = TRUE',
                            [referral.referrer_id]
                        );
                        if (parseInt(qualCount.count) >= 5) {
                            await client.query(
                                "UPDATE users SET subscription_tier = 'lifetime' WHERE id = $1 AND subscription_tier != 'lifetime'",
                                [referral.referrer_id]
                            );
                        }
                    }
                }
                await client.query('COMMIT');
            } catch (e) {
                await client.query('ROLLBACK').catch(() => { });
                console.error('Referral qualification check failed:', e);
            } finally {
                client.release();
            }
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Create study session error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/study-sessions', authMiddleware, async (req, res) => {
    const { deck_id, limit = 10 } = req.query;
    const cappedLimit = Math.min(Math.max(parseInt(limit) || 10, 1), 100);

    try {
        let sessions;
        if (deck_id) {
            // Verify the user owns this deck or it's shared with them
            const userId = req.user?.id || null;
            const deck = await db.queryOne('SELECT user_id FROM decks WHERE id = $1', [deck_id]);
            if (!deck) return res.status(404).json({ error: 'Deck not found' });

            let isAuthorized = deck.user_id === userId;
            if (!isAuthorized && userId) {
                const sharedCheck = await db.queryOne(`
                    SELECT 1 FROM group_decks gd
                    JOIN group_members gm ON gd.group_id = gm.group_id
                    WHERE gd.deck_id = $1 AND gm.user_id = $2 LIMIT 1
                `, [deck_id, userId]);
                if (sharedCheck) isAuthorized = true;
            }
            if (!isAuthorized) return res.status(403).json({ error: 'Not authorized' });

            sessions = await db.query(
                'SELECT * FROM study_sessions WHERE deck_id = $1 ORDER BY created_at DESC LIMIT $2',
                [deck_id, cappedLimit]
            );
        } else {
            const userId = req.user?.id || null;
            if (userId) {
                sessions = await db.query(
                    'SELECT ss.* FROM study_sessions ss JOIN decks d ON ss.deck_id = d.id WHERE d.user_id = $1 ORDER BY ss.created_at DESC LIMIT $2',
                    [userId, cappedLimit]
                );
            } else {
                sessions = [];
            }
        }
        res.json(sessions);
    } catch (error) {
        console.error('Fetch study sessions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.get('/api/decks/:id/stats', authMiddleware, async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id || null;

    try {
        // Verify ownership or group membership
        const deck = await db.queryOne('SELECT user_id FROM decks WHERE id = $1', [id]);
        if (!deck) return res.status(404).json({ error: 'Deck not found' });

        let isAuthorized = deck.user_id === userId;
        if (!isAuthorized && userId) {
            const sharedCheck = await db.queryOne(`
                SELECT 1 FROM group_decks gd
                JOIN group_members gm ON gd.group_id = gm.group_id
                WHERE gd.deck_id = $1 AND gm.user_id = $2 LIMIT 1
            `, [id, userId]);
            if (sharedCheck) isAuthorized = true;
        }
        if (!isAuthorized) return res.status(403).json({ error: 'Not authorized' });

        // Use SQL aggregation instead of fetching all rows
        const [sessionStats, cardStats, recentSessions] = await Promise.all([
            db.queryOne(
                `SELECT COUNT(*) as total_sessions,
                        COALESCE(SUM(cards_studied), 0) as total_studied,
                        COALESCE(SUM(cards_correct), 0) as total_correct,
                        COALESCE(SUM(duration_seconds), 0) as total_time
                 FROM study_sessions WHERE deck_id = $1`,
                [id]
            ),
            db.queryOne(
                `SELECT COUNT(*) as card_count,
                        COUNT(*) FILTER (WHERE COALESCE(times_correct, 0) = 0 AND COALESCE(times_reviewed, 0) = 0) as new_count,
                        COUNT(*) FILTER (WHERE COALESCE(times_reviewed, 0) > 0 AND COALESCE(times_correct, 0) < 2) as learning_count,
                        COUNT(*) FILTER (WHERE COALESCE(times_correct, 0) >= 2 AND COALESCE(times_correct, 0) < 5) as familiar_count,
                        COUNT(*) FILTER (WHERE COALESCE(times_correct, 0) >= 5) as mastered_count
                 FROM cards WHERE deck_id = $1`,
                [id]
            ),
            db.query(
                'SELECT * FROM study_sessions WHERE deck_id = $1 ORDER BY created_at DESC LIMIT 10',
                [id]
            )
        ]);

        const totalStudied = parseInt(sessionStats.total_studied);
        const totalCorrect = parseInt(sessionStats.total_correct);
        const totalTime = parseInt(sessionStats.total_time);

        const cardsByDifficulty = {
            new: parseInt(cardStats.new_count),
            learning: parseInt(cardStats.learning_count),
            familiar: parseInt(cardStats.familiar_count),
            mastered: parseInt(cardStats.mastered_count)
        };

        res.json({
            totalSessions: parseInt(sessionStats.total_sessions),
            totalCardsStudied: totalStudied,
            totalStudied,
            totalCorrect,
            accuracy: totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0,
            totalTimeSeconds: totalTime,
            totalTime,
            cardCount: parseInt(cardStats.card_count),
            masteredCount: cardsByDifficulty.mastered,
            cardsByDifficulty,
            recentSessions
        });
    } catch (error) {
        console.error('Fetch deck stats error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ============ THEMES ============

app.get('/api/themes', authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id || null;
        let themes = userId
            ? await db.query('SELECT * FROM themes WHERE user_id = $1', [userId])
            : await db.query('SELECT * FROM themes WHERE user_id IS NULL');

        // Auto-migrate old "Claude Dark"/"Claude Light" themes to new Riven palette and insert missing default themes
        if (userId) {
            let migrated = false;
            for (const theme of themes) {
                if (theme.is_default && (theme.name === 'Claude Dark' || (theme.name === 'Dark' && theme.bg_color === '#0a0a0b'))) {
                    await db.execute(
                        `UPDATE themes SET name = 'Riven', bg_color = '#162a31', surface_color = '#1e3840', text_color = '#e4ddd0', secondary_text_color = '#8fa6a8', border_color = '#233e46', accent_color = '#deb96a' WHERE id = $1`,
                        [theme.id]
                    );
                    migrated = true;
                } else if (theme.is_default && theme.name === 'Claude Light') {
                    await db.execute(
                        `UPDATE themes SET name = 'Riven Light', bg_color = '#f5f0e8', surface_color = '#ffffff', text_color = '#1e3840', secondary_text_color = '#6b7d7f', border_color = '#ddd5c8', accent_color = '#deb96a' WHERE id = $1`,
                        [theme.id]
                    );
                    migrated = true;
                }
            }

            const proThemes = [
                { name: 'Riven', bg_color: '#162a31', surface_color: '#1e3840', text_color: '#e4ddd0', secondary_text_color: '#8fa6a8', border_color: '#233e46', accent_color: '#deb96a', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 1, is_default: 1 },
                { name: 'Riven Light', bg_color: '#f5f0e8', surface_color: '#ffffff', text_color: '#1e3840', secondary_text_color: '#6b7d7f', border_color: '#ddd5c8', accent_color: '#deb96a', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Arctic Frost', bg_color: '#fafafa', surface_color: '#d4e4f7', text_color: '#4a6fa5', secondary_text_color: '#c0c0c0', border_color: '#d4e4f7', accent_color: '#4a6fa5', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Botanical Garden', bg_color: '#f5f3ed', surface_color: '#e9e6da', text_color: '#4a7c59', secondary_text_color: '#b7472a', border_color: '#4a7c59', accent_color: '#f9a620', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Desert Rose', bg_color: '#e8d5c4', surface_color: '#dfccba', text_color: '#5d2e46', secondary_text_color: '#b87d6d', border_color: '#d4a5a5', accent_color: '#d4a5a5', font_family_display: 'Lora', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Forest Canopy', bg_color: '#faf9f6', surface_color: '#f0ede4', text_color: '#2d4a2b', secondary_text_color: '#7d8471', border_color: '#a4ac86', accent_color: '#2d4a2b', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Golden Hour', bg_color: '#d4b896', surface_color: '#cbb08d', text_color: '#4a403a', secondary_text_color: '#c1666b', border_color: '#f4a900', accent_color: '#f4a900', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Midnight Galaxy', bg_color: '#2b1e3e', surface_color: '#362a4d', text_color: '#e6e6fa', secondary_text_color: '#a490c2', border_color: '#4a4e8f', accent_color: '#a490c2', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Modern Minimal', bg_color: '#ffffff', surface_color: '#f3f4f6', text_color: '#36454f', secondary_text_color: '#708090', border_color: '#d3d3d3', accent_color: '#36454f', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Ocean Depths', bg_color: '#1a2332', surface_color: '#243045', text_color: '#f1faee', secondary_text_color: '#a8dadc', border_color: '#2d8b8b', accent_color: '#2d8b8b', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 },
                { name: 'Sunset Blvd', bg_color: '#264653', surface_color: '#2f5565', text_color: '#fafafa', secondary_text_color: '#f4a261', border_color: '#e76f51', accent_color: '#e76f51', font_family_display: 'Cormorant Garamond', font_family_body: 'Lora', is_active: 0, is_default: 1 },
                { name: 'Tech Innovation', bg_color: '#1e1e1e', surface_color: '#2a2a2a', text_color: '#ffffff', secondary_text_color: '#00ffff', border_color: '#0066ff', accent_color: '#0066ff', font_family_display: 'Inter', font_family_body: 'Inter', is_active: 0, is_default: 1 }
            ];

            let missingThemesAdded = false;
            for (const pro of proThemes) {
                const hasTheme = themes.some(t => t.name === pro.name && t.is_default);
                if (!hasTheme) {
                    await db.execute(
                        'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, font_family_display, font_family_body, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 1)',
                        [userId, pro.name, pro.bg_color, pro.surface_color, pro.text_color, pro.secondary_text_color, pro.border_color, pro.accent_color, pro.font_family_display, pro.font_family_body]
                    );
                    missingThemesAdded = true;
                }
            }

            // Re-fetch after migration if needed
            if (migrated || missingThemesAdded) {
                themes = await db.query('SELECT * FROM themes WHERE user_id = $1', [userId]);
            }
        }

        res.json(themes);
    } catch (error) {
        console.error('Fetch themes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.post('/api/themes', authMiddleware, async (req, res) => {
    const { name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color } = req.body;

    try {
        const userId = req.user?.id || null;
        const result = await db.queryOne(
            'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, font_family_display, font_family_body, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0, 0) RETURNING *',
            [userId, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, req.body.font_family_display || 'Cormorant Garamond', req.body.font_family_body || 'Lora']
        );
        res.status(201).json(result);
    } catch (error) {
        console.error('Create theme error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.delete('/api/themes/:id', authMiddleware, async (req, res) => {
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
        console.error('Delete theme error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/themes/:id', authMiddleware, async (req, res) => {
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
        console.error('Update theme error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

app.put('/api/themes/:id/activate', authMiddleware, async (req, res) => {
    const { id } = req.params;
    try {
        const userId = req.user?.id || null;

        // Check if this is a PRO theme and if user has access
        const theme = await db.queryOne('SELECT * FROM themes WHERE id = $1', [id]);
        if (!theme) return res.status(404).json({ error: 'Theme not found' });

        const FREE_THEMES = ['Riven', 'Riven Light'];
        const isProTheme = theme.is_default && !FREE_THEMES.includes(theme.name);

        if (isProTheme && userId) {
            const user = await db.queryOne(
                'SELECT subscription_tier, role, simulate_free_tier, theme_trial_id, theme_trial_expires_at FROM users WHERE id = $1',
                [userId]
            );
            const isPrivileged = (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier;
            const isPremium = isPrivileged || user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime';
            const hasActiveTrial = user.theme_trial_id === parseInt(id) && user.theme_trial_expires_at && new Date(user.theme_trial_expires_at) > new Date();

            if (!isPremium && !hasActiveTrial) {
                return res.status(403).json({ error: 'Upgrade or watch an ad to use this theme.', canWatchAd: true });
            }
        }

        if (userId) {
            await db.execute('UPDATE themes SET is_active = 0 WHERE user_id = $1', [userId]);
        } else {
            await db.execute('UPDATE themes SET is_active = 0 WHERE user_id IS NULL');
        }

        await db.execute('UPDATE themes SET is_active = 1 WHERE id = $1', [id]);
        res.json({ message: 'Theme activated' });
    } catch (error) {
        console.error('Activate theme error:', error);
        res.status(500).json({ error: 'Internal server error' });
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

        // Clone cards (bulk insert)
        const cards = await db.query('SELECT front, back, front_image, back_image, position FROM cards WHERE deck_id = $1', [originalDeckId]);
        if (cards.length > 0) {
            const values = [];
            const placeholders = cards.map((card, i) => {
                const offset = i * 6;
                values.push(newDeck.id, card.front, card.back, card.front_image, card.back_image, card.position);
                return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
            });
            await db.execute(
                `INSERT INTO cards (deck_id, front, back, front_image, back_image, position) VALUES ${placeholders.join(', ')}`,
                values
            );
        }

        // Clone tags (bulk insert)
        const tags = await db.query('SELECT tag_id FROM deck_tags WHERE deck_id = $1', [originalDeckId]);
        if (tags.length > 0) {
            const values = [];
            const placeholders = tags.map((tag, i) => {
                const offset = i * 2;
                values.push(newDeck.id, tag.tag_id);
                return `($${offset + 1}, $${offset + 2})`;
            });
            await db.execute(
                `INSERT INTO deck_tags (deck_id, tag_id) VALUES ${placeholders.join(', ')}`,
                values
            );
        }

        // Update message to mark as accepted
        deckData.acceptedDeckId = newDeck.id;
        await db.execute(
            'UPDATE messages SET deck_data = $1 WHERE id = $2',
            [JSON.stringify(deckData), messageId]
        );

        res.status(201).json({ newDeck, messageId });
    } catch (error) {
        console.error('Accept deck error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
