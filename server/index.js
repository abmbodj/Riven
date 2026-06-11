if (process.env.NODE_ENV !== 'test') {
    require('dotenv').config({ override: true });
}
const Sentry = require('@sentry/node');
const crypto = require('crypto');
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const slowDown = require('express-slow-down');
const xss = require('xss');
const db = require('./db');
const { isTokenRevoked } = require('./tokenRevocation');
const registerAuthRoutes = require('./routes/auth');
const registerHealthRoutes = require('./routes/health');
const registerLMSRoutes = require('./routes/lms');
const registerHeartsRoutes = require('./routes/hearts');
const registerWebhooksRoutes = require('./routes/webhooks');
const registerReferralRoutes = require('./routes/referrals');
const registerStripeRoutes = require('./routes/stripe');
const registerStudyRoutes = require('./routes/study');

let acceptSharedResourceCorePromise = null;
const loadAcceptSharedResourceCore = async () => {
    if (!acceptSharedResourceCorePromise) {
        acceptSharedResourceCorePromise = import('../supabase/functions/_shared/acceptSharedDeckCore.mjs');
    }

    return acceptSharedResourceCorePromise;
};

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

let sentryEnabled = false;
if (process.env.NODE_ENV !== 'test' && process.env.SENTRY_DSN) {
    sentryEnabled = true;
    const tracesSampleRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.05');
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV,
        release: process.env.SENTRY_RELEASE,
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.05,
        integrations: [
            Sentry.expressIntegration(),
            Sentry.captureConsoleIntegration({ levels: ['error'] }),
        ],
    });
}

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

// Rate limiters — default to production-safe values; only relax when
// NODE_ENV is explicitly set to 'development' or 'test'.
const isDevEnv = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isDevEnv ? 100 : 10,
    message: { error: 'Too many attempts, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});

const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: isDevEnv ? 20 : 3,
    delayMs: (hits) => hits * 200
});

const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please slow down' },
    standardHeaders: true,
    legacyHeaders: false,
});

// CORS — always enforce an allowlist. ALLOWED_ORIGINS overrides the defaults.
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [
        'https://riven.rocks',
        'https://riven-virid.vercel.app',
        'http://localhost:5173',
        'http://localhost:3000',
        'capacitor://localhost',
        'http://localhost',
    ];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        if (isDevEnv) {
            return callback(null, true);
        }

        const cleanOrigin = origin.replace(/\/$/, '');
        // RIV-015: match only the explicit allowlist (extend via ALLOWED_ORIGINS env).
        // The previous `.endsWith('.vercel.app')` wildcard trusted every attacker-created
        // *.vercel.app subdomain for credentialed requests.
        const isAllowed = allowedOrigins.some(o => cleanOrigin === o.replace(/\/$/, ''));

        if (isAllowed) {
            callback(null, true);
        } else {
            console.error(`[CORS] Blocked origin: ${cleanOrigin}`);
            callback(null, false);
        }
    },
    credentials: true
}));

// Security headers via Helmet
const helmetConnectSrc = [
    "'self'",
    ...allowedOrigins,
    'https://*.vercel.app',
    'https://*.ingest.sentry.io',
    'https://*.ingest.us.sentry.io',
];

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: helmetConnectSrc,
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    permissionsPolicy: {
        features: {
            camera: [],
            microphone: [],
            geolocation: [],
        },
    },
}));

app.use(compression());
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

// CSRF protection via double-submit cookie pattern.
// A random token is set in a readable cookie; the client must echo it
// back in the X-CSRF-Token header on state-changing requests.
const CSRF_COOKIE = 'riven_csrf';
const CSRF_HEADER = 'x-csrf-token';
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

app.use('/api/', (req, res, next) => {
    // Skip for webhook endpoints (server-to-server, verified by signature)
    if (req.path.startsWith('/webhooks/')) return next();

    const existingCsrf = req.cookies[CSRF_COOKIE];
    const csrfToken = existingCsrf || crypto.randomBytes(32).toString('hex');
    res.locals.csrfToken = csrfToken;

    // Issue a CSRF token cookie if one doesn't exist yet so the client can echo it back.
    if (!existingCsrf) {
        res.cookie(CSRF_COOKIE, csrfToken, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 * 1000,
        });
    }

    // Safe methods never need CSRF validation.
    if (CSRF_SAFE_METHODS.has(req.method)) return next();

    // CSRF only applies when the browser would attach an ambient credential — the auth
    // cookie. Bearer-only clients (Capacitor/iOS has no cookie jar) present their token
    // explicitly and are not cross-site forgeable, so they are exempt. (RIV-008)
    if (!req.cookies.token) return next();

    // Auth cookie present → require a matching double-submit CSRF token. This now also
    // covers the very first mutating request (no csrf cookie yet → rejected), closing the
    // prior first-request bypass. The client primes via GET /api/csrf and auto-retries.
    const headerToken = req.headers[CSRF_HEADER];
    if (!existingCsrf || !headerToken || headerToken !== existingCsrf) {
        return res.status(403).json({ error: 'CSRF token mismatch' });
    }

    next();
});

// Lightweight endpoint for the client to prime the CSRF cookie before making mutating requests.
app.get('/api/csrf', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({
        ok: true,
        csrfToken: res.locals.csrfToken || req.cookies[CSRF_COOKIE] || null,
    });
});

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
        // RIV-005: reject tokens that were revoked (logout) or invalidated (password change).
        if (await isTokenRevoked(decoded)) {
            return res.status(401).json({ error: 'Token has been revoked', code: 'TOKEN_REVOKED' });
        }
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

// ============ LMS INTEGRATION ============

registerLMSRoutes({ app, db, authMiddleware });

// ============ HEARTS / MONETIZATION ============

registerHeartsRoutes({ app, db, authMiddleware });
registerReferralRoutes({ app, db, authMiddleware });
registerStudyRoutes({ app, db, authMiddleware });

// ============ WEBHOOKS ============

registerWebhooksRoutes({ app, db });

// ============ STRIPE ============
const stripeRouter = registerStripeRoutes({ db });
app.use('/api/stripe', authMiddleware, stripeRouter);

// ============ SHARING ============

const handleAcceptSharedResource = async (req, res) => {
    const messageId = Number(req.params.id);
    if (!Number.isInteger(messageId) || messageId <= 0) {
        return res.status(400).json({ error: 'Message id must be a valid id' });
    }

    try {
        const { acceptSharedResourceCore } = await loadAcceptSharedResourceCore();
        const result = await acceptSharedResourceCore({
            messageId,
            receiverId: req.user.id,
            loadMessageForReceiver: (targetMessageId, targetUserId) =>
                db.queryOne(
                    'SELECT id, receiver_id, message_type, deck_data FROM messages WHERE id = $1 AND receiver_id = $2',
                    [targetMessageId, targetUserId]
                ),
            loadDeck: (deckId) =>
                db.queryOne('SELECT id, title, description FROM decks WHERE id = $1', [deckId]),
            loadDeckCards: (deckId) =>
                db.query(
                    'SELECT front, back, front_image, back_image, position FROM cards WHERE deck_id = $1 ORDER BY position ASC',
                    [deckId]
                ),
            loadDeckTags: async (deckId) => {
                const tags = await db.query('SELECT tag_id FROM deck_tags WHERE deck_id = $1', [deckId]);
                return tags.map((tag) => tag.tag_id);
            },
            createDeck: (userId, originalDeck) =>
                db.queryOne(
                    'INSERT INTO decks (user_id, title, description) VALUES ($1, $2, $3) RETURNING *',
                    [userId, originalDeck.title, originalDeck.description]
                ),
            insertDeckCards: async (newDeckId, cards) => {
                if (!cards.length) return;

                const values = [];
                const placeholders = cards.map((card, index) => {
                    const offset = index * 6;
                    values.push(newDeckId, card.front, card.back, card.front_image, card.back_image, card.position);
                    return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`;
                });

                await db.execute(
                    `INSERT INTO cards (deck_id, front, back, front_image, back_image, position) VALUES ${placeholders.join(', ')}`,
                    values
                );
            },
            insertDeckTags: async (newDeckId, tagIds) => {
                if (!tagIds.length) return;

                const values = [];
                const placeholders = tagIds.map((tagId, index) => {
                    const offset = index * 2;
                    values.push(newDeckId, tagId);
                    return `($${offset + 1}, $${offset + 2})`;
                });

                await db.execute(
                    `INSERT INTO deck_tags (deck_id, tag_id) VALUES ${placeholders.join(', ')}`,
                    values
                );
            },
            loadNote: (noteId) =>
                db.queryOne('SELECT id, title, content, enhanced_content FROM notes WHERE id = $1', [noteId]),
            createNote: (userId, note) =>
                db.queryOne(
                    `INSERT INTO notes
                        (user_id, title, content, enhanced_content, class_id, audio_url, audio_duration_seconds, source_type)
                     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
                     RETURNING *`,
                    [
                        userId,
                        note.title,
                        JSON.stringify(note.content || {}),
                        note.enhanced_content ? JSON.stringify(note.enhanced_content) : null,
                        null,
                        null,
                        null,
                        'import',
                    ]
                ),
            loadGuide: (guideId) =>
                db.queryOne('SELECT id, title, format_version, guide_data, study_state, content FROM study_guides WHERE id = $1', [guideId]),
            createGuide: (userId, guide) =>
                db.queryOne(
                    `INSERT INTO study_guides
                        (user_id, title, format_version, guide_data, study_state, content, note_id, class_id)
                     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)
                     RETURNING *`,
                    [
                        userId,
                        guide.title,
                        guide.format_version ?? 1,
                        JSON.stringify(guide.guide_data || null),
                        JSON.stringify(guide.study_state || {}),
                        JSON.stringify(guide.content || {}),
                        null,
                        null,
                    ]
                ),
            updateMessageSharedData: (targetMessageId, sharedData) =>
                db.execute('UPDATE messages SET deck_data = $1 WHERE id = $2', [
                    JSON.stringify(sharedData),
                    targetMessageId,
                ]),
        });

        res.status(201).json(result);
    } catch (error) {
        console.error('Accept shared resource error:', error);
        res.status(error.status || 500).json({ error: error.message || 'Internal server error' });
    }
};

// Accept a shared resource from a message
app.post('/api/messages/:id/accept-share', authMiddleware, handleAcceptSharedResource);
app.post('/api/messages/:id/accept-deck', authMiddleware, handleAcceptSharedResource);

// ============ HEALTH CHECK ============

registerHealthRoutes({ app, db });

// RIV-014: terminal 404 for any unmatched route (returns JSON, not an HTML stack page).
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

if (sentryEnabled) {
    Sentry.setupExpressErrorHandler(app);
}

// RIV-014: centralized error handler — sanitize output so stack traces and internals
// never reach the client regardless of NODE_ENV.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('[Unhandled error]', err);
    const status = err.status || err.statusCode || 500;
    res.status(status).json({
        error: status >= 500 ? 'Internal server error' : (err.message || 'Request failed'),
    });
});

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
