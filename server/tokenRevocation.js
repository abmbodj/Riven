// RIV-005: revocation for legacy Express JWTs.
//
// Two mechanisms, both gated on the token carrying a `jti`:
//   1. jti denylist  — explicit per-token revocation (logout).
//   2. tokens_invalid_before — bulk invalidation of every token a user held
//      before a sensitive event (password change).
//
// Tokens minted before this feature shipped have no `jti`; they are not
// checked here and simply expire on their own 30-day clock. Supabase access
// tokens are short-lived and validated upstream, so they are out of scope.

const NodeCache = require('node-cache');
const jwt = require('jsonwebtoken');
const db = require('./db');

// Short TTLs keep the hot auth path off Postgres without making revocation
// take more than ~60s to propagate. Password change busts the cache eagerly.
const revokedJtiCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
const invalidBeforeCache = new NodeCache({ stdTTL: 60, checkperiod: 120 });

async function isTokenRevoked(decoded) {
    if (!decoded || !decoded.jti) return false;

    // 1. Explicit jti denylist
    let revoked = revokedJtiCache.get(decoded.jti);
    if (revoked === undefined) {
        const row = await db.queryOne('SELECT 1 AS ok FROM revoked_tokens WHERE jti = $1 LIMIT 1', [decoded.jti]);
        revoked = !!row;
        revokedJtiCache.set(decoded.jti, revoked);
    }
    if (revoked) return true;

    // 2. Bulk invalidation by issue time
    const userId = decoded.id;
    const iat = decoded.iat;
    if (userId && iat) {
        let invalidBeforeMs = invalidBeforeCache.get(String(userId));
        if (invalidBeforeMs === undefined) {
            const row = await db.queryOne('SELECT tokens_invalid_before FROM users WHERE id = $1', [userId]);
            invalidBeforeMs = row && row.tokens_invalid_before ? new Date(row.tokens_invalid_before).getTime() : 0;
            invalidBeforeCache.set(String(userId), invalidBeforeMs);
        }
        if (invalidBeforeMs && iat * 1000 < invalidBeforeMs) return true;
    }

    return false;
}

// Revoke a single token. Accepts a raw JWT string; decodes (without verifying,
// since logout should work even for an expired token the client still holds).
async function revokeToken(rawToken) {
    if (!rawToken) return;
    let decoded;
    try {
        decoded = jwt.decode(rawToken);
    } catch {
        return;
    }
    if (!decoded || !decoded.jti) return;

    const expiresAt = decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null;
    await db.execute(
        'INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT (jti) DO NOTHING',
        [decoded.jti, decoded.id || null, expiresAt]
    );
    revokedJtiCache.set(decoded.jti, true);
}

// Invalidate every token issued before now for a user (password change).
async function invalidateUserTokens(userId) {
    if (!userId) return;
    await db.execute('UPDATE users SET tokens_invalid_before = now() WHERE id = $1', [userId]);
    invalidBeforeCache.del(String(userId));
}

module.exports = { isTokenRevoked, revokeToken, invalidateUserTokens };
