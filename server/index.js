if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config({ override: true });
}
const express = require('express');
const http = require('http');
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
const HOST = process.env.HOST || '0.0.0.0';

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

app.use(cookieParser());
// Stripe webhook needs raw body for signature verification
app.use('/api/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '10mb' }));

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
async function verifySupabaseTokenViaAuthApi(token) {
    const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || !token) {
        return null;
    }

    try {
        const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
                Authorization: `Bearer ${token}`,
                apikey: supabaseAnonKey,
            },
        });

        if (!response.ok) {
            return null;
        }

        const authUser = await response.json();
        if (!authUser?.id) {
            return null;
        }

        return authUser;
    } catch {
        return null;
    }
}

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

    // Try Supabase JWT first (new auth system)
    const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;
    if (supabaseJwtSecret) {
        try {
            // Detect algorithm from token header (Supabase typically uses HS256)
            const tokenHeader = jwt.decode(token, { complete: true })?.header;
            const alg = tokenHeader?.alg;
            if (!alg || !['HS256', 'HS384', 'HS512'].includes(alg)) throw new Error(`Unsupported alg: ${alg}`);
            const decoded = jwt.verify(token, supabaseJwtSecret, { algorithms: [alg] });
            const aud = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
            if (aud.includes('authenticated') && decoded.sub) {
                const dbUser = await db.queryOne(
                    'SELECT id, email, role, is_admin FROM users WHERE supabase_auth_id = $1',
                    [decoded.sub]
                );
                if (dbUser) {
                    req.user = {
                        id: dbUser.id,
                        email: dbUser.email,
                        role: dbUser.role || (dbUser.is_admin === 1 ? 'admin' : 'user')
                    };
                    return next();
                }
                // Supabase token valid but user not yet linked — needs complete-registration
                return res.status(401).json({ error: 'Account setup required', code: 'ACCOUNT_SETUP_REQUIRED' });
            }
        } catch (supabaseErr) {
            // Not a valid Supabase JWT — fall through to legacy JWT check
        }
    }

    // Legacy JWT (custom JWT signed with JWT_SECRET)
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
        const authUser = await verifySupabaseTokenViaAuthApi(token);
        if (authUser?.id) {
            const dbUser = await db.queryOne(
                'SELECT id, email, role, is_admin FROM users WHERE supabase_auth_id = $1',
                [authUser.id]
            );
            if (dbUser) {
                req.user = {
                    id: dbUser.id,
                    email: dbUser.email,
                    role: dbUser.role || (dbUser.is_admin === 1 ? 'admin' : 'user')
                };
                return next();
            }
            return res.status(401).json({ error: 'Account setup required', code: 'ACCOUNT_SETUP_REQUIRED' });
        }

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

registerGroupsRoutes({ app, db, authMiddleware });

// ============ MESSAGES ============

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

// ============ HEALTH CHECK ============

registerHealthRoutes({ app, db });

if (process.env.NODE_ENV !== 'test') {
    server.on('error', (error) => {
        console.error('Server startup error:', error);
        process.exit(1);
    });

    server.listen(PORT, HOST, () => {
        console.log(`Server running on ${HOST}:${PORT}`);
    });
}

module.exports = app;
