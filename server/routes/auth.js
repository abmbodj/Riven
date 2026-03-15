module.exports = function registerAuthRoutes({
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
}) {
    const rateLimit = require('express-rate-limit');
    const isProdEnv = process.env.NODE_ENV === 'production';

    const { OAuth2Client } = require('google-auth-library');
    const appleSigninAuth = require('apple-signin-auth');

    // The Google Client ID must match the one sent from the frontend
    const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_GOOGLE_CLIENT_ID');

    // Stricter rate limiter for password reset (3 requests per hour in production)
    const passwordResetLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: isProdEnv ? 3 : 50,
        message: { error: 'Too many password reset attempts, please try again later' },
        standardHeaders: true,
        legacyHeaders: false,
    });

    const getSupabaseConfig = () => {
        const baseUrl = process.env.SUPABASE_URL?.replace(/\/$/, '');
        return {
            authUrl: baseUrl ? `${baseUrl}/auth/v1` : null,
            anonKey: process.env.SUPABASE_ANON_KEY,
            serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
            jwtSecret: process.env.SUPABASE_JWT_SECRET,
        };
    };

    const getBearerToken = (req) => {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            return authHeader.split(' ')[1];
        }
        return req.cookies?.token || null;
    };

    const getSupabaseSessionToken = (req) => {
        const token = getBearerToken(req);
        const { jwtSecret } = getSupabaseConfig();
        if (!token || !jwtSecret) return null;

        try {
            const tokenHeader = jwt.decode(token, { complete: true })?.header;
            const alg = tokenHeader?.alg;
            if (!alg || !['HS256', 'HS384', 'HS512'].includes(alg)) return null;

            const decoded = jwt.verify(token, jwtSecret, { algorithms: [alg] });
            const aud = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
            if (!aud.includes('authenticated') || !decoded.sub) return null;

            return { token, authUserId: decoded.sub };
        } catch {
            return null;
        }
    };

    const buildRedirectUrl = (req, path) => {
        const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
        return `${baseUrl.replace(/\/$/, '')}${path}`;
    };

    const supabaseFetch = async (path, { method = 'POST', apiKey, accessToken, body, query } = {}) => {
        const { authUrl } = getSupabaseConfig();
        if (!authUrl || !apiKey) {
            throw new Error('Supabase auth is not configured');
        }

        const url = new URL(`${authUrl}${path}`);
        if (query) {
            Object.entries(query).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') {
                    url.searchParams.set(key, value);
                }
            });
        }

        const headers = {
            apikey: apiKey,
            'Content-Type': 'application/json',
        };

        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        const response = await fetch(url.toString(), {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
        });

        const responseText = await response.text();
        const responseBody = responseText ? JSON.parse(responseText) : {};

        if (!response.ok) {
            const message = responseBody.msg
                || responseBody.message
                || responseBody.error_description
                || responseBody.error
                || 'Supabase auth request failed';
            const error = new Error(message);
            error.status = response.status;
            error.body = responseBody;
            throw error;
        }

        return responseBody;
    };

    const verifySupabaseTokenHash = async (tokenHash, type, redirectTo) => {
        const { anonKey } = getSupabaseConfig();
        return supabaseFetch('/verify', {
            method: 'POST',
            apiKey: anonKey,
            query: { redirect_to: redirectTo },
            body: { token_hash: tokenHash, type },
        });
    };

    // Register
    app.post('/api/auth/register', speedLimiter, authLimiter, async (req, res) => {
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
        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
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
            // Default display_name to username
            const displayName = username;

            // Create or find a Supabase Auth user so supabase_auth_id is linked and RLS works
            let supabaseAuthId = null;
            try {
                const { serviceRoleKey } = getSupabaseConfig();
                if (serviceRoleKey) {
                    try {
                        // Try creating a new Supabase Auth user
                        const authUser = await supabaseFetch('/admin/users', {
                            method: 'POST',
                            apiKey: serviceRoleKey,
                            accessToken: serviceRoleKey,
                            body: {
                                email: email.toLowerCase(),
                                password,
                                email_confirm: true,
                                user_metadata: { username },
                            },
                        });
                        supabaseAuthId = authUser?.id || null;
                    } catch (createErr) {
                        // User may already exist (e.g. frontend signUp created an unconfirmed user).
                        // Look them up and confirm their email so signInWithPassword works.
                        console.warn('[register] Create failed, looking up existing Supabase Auth user:', createErr.message);
                        const listRes = await supabaseFetch('/admin/users', {
                            method: 'GET',
                            apiKey: serviceRoleKey,
                            accessToken: serviceRoleKey,
                            query: { email: email.toLowerCase() },
                        });
                        const existing = Array.isArray(listRes?.users) && listRes.users[0];
                        if (existing?.id) {
                            supabaseAuthId = existing.id;
                            // Confirm email + update password so signInWithPassword works
                            await supabaseFetch(`/admin/users/${existing.id}`, {
                                method: 'PUT',
                                apiKey: serviceRoleKey,
                                accessToken: serviceRoleKey,
                                body: { email_confirm: true, password },
                            });
                        }
                    }
                }
            } catch (err) {
                console.warn('[register] Supabase Auth user setup failed (continuing with legacy):', err.message);
            }

            const result = await db.queryOne(
                'INSERT INTO users (username, display_name, email, password, share_code, supabase_auth_id, email_verified) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id',
                [username, displayName, email.toLowerCase(), hashedPassword, shareCode, supabaseAuthId, supabaseAuthId ? true : false]
            );
            const userId = result.id;

            // Create default themes
            await db.execute(
                'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [userId, 'Riven', '#162a31', '#1e3840', '#e4ddd0', '#8fa6a8', '#233e46', '#deb96a', 1, 1]
            );
            await db.execute(
                'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [userId, 'Riven Light', '#f5f0e8', '#ffffff', '#1e3840', '#6b7d7f', '#ddd5c8', '#deb96a', 0, 1]
            );

            // Create preset tags
            const presetTags = [
                ['Language', '#3b82f6'], ['Science', '#22c55e'], ['Math', '#f59e0b'], ['History', '#8b5cf6'],
                ['Programming', '#06b6d4'], ['Medical', '#ef4444'], ['Business', '#ec4899'], ['Art', '#f97316']
            ];
            for (const [name, color] of presetTags) {
                await db.execute('INSERT INTO tags (user_id, name, color, is_preset) VALUES ($1, $2, $3, 1) ON CONFLICT DO NOTHING', [userId, name, color]);
            }

            const token = jwt.sign({ id: userId, email: email.toLowerCase(), role: 'user' }, jwtSecret, { expiresIn: '30d' });

            // Set httpOnly cookie (secure in production)
            // Cross-origin (Vercel frontend → Render backend) requires sameSite 'none' + secure
            // Client also sends JWT via Authorization header as fallback for iOS PWA
            const isProd = process.env.NODE_ENV === 'production';
            res.cookie('token', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            res.status(201).json({
                token,
                user: { id: userId, username, displayName, email: email.toLowerCase(), shareCode, avatar: null, banner: null, bio: '', streakData: {}, role: 'user', isAdmin: false, twoFAEnabled: false, email_verified: false }
            });

            // Send welcome email (fire-and-forget, don't block registration)
            const baseUrl = process.env.FRONTEND_URL || 'https://riven.rocks';
            sendWelcomeEmail(email.toLowerCase(), username, baseUrl).catch(() => { });
        } catch (error) {
            console.error('POST /api/auth/register error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    });

    // Login (via email or username)
    app.post('/api/auth/login', speedLimiter, authLimiter, async (req, res) => {
        const { email, password } = req.body; // 'email' holds either email or username
        if (!email || !password) {
            return res.status(400).json({ error: 'Email/Username and password are required' });
        }

        try {
            const user = await db.queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)', [email]);
            if (!user) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) {
                return res.status(401).json({ error: 'Invalid credentials' });
            }

            // Check 2FA
            if (user.two_fa_enabled) {
                const tempToken = jwt.sign({ id: user.id, email: user.email, type: '2fa_pending' }, jwtSecret, { expiresIn: '5m' });
                return res.json({ require2FA: true, tempToken });
            }

            const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
            const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, jwtSecret, { expiresIn: '30d' });


            const isProd = process.env.NODE_ENV === 'production';
            res.cookie('token', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            const effectiveTier = (userRole === 'owner' || userRole === 'admin') && !user.simulate_free_tier ? 'lifetime' : (user.subscription_tier || 'free');

            res.json({
                token,
                require2FA: false,
                user: {
                    id: user.id, username: user.username, displayName: user.display_name || user.username, email: user.email, shareCode: user.share_code,
                    avatar: user.avatar, banner: user.banner, bio: user.bio || '', role: userRole,
                    isAdmin: userRole === 'admin' || userRole === 'owner',
                    isOwner: userRole === 'owner',
                    streakData: JSON.parse(user.streak_data || '{}'),
                    twoFAEnabled: !!user.two_fa_enabled,
                    subscription_tier: effectiveTier,
                    simulate_free_tier: !!user.simulate_free_tier,
                    email_verified: !!user.email_verified
                }
            });
        } catch (error) {
            res.status(500).json({ error: 'Login failed' });
        }
    });

    const handleOAuthUser = async (email, name) => {
        let user = await db.queryOne('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [email]);

        if (!user) {
            const baseUsername = (name || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();
            let username = baseUsername;
            let counter = 1;
            while (await db.queryOne('SELECT id FROM users WHERE username = $1', [username])) {
                username = `${baseUsername}${counter}`;
                counter++;
            }

            const shareCode = generateShareCode();
            const displayName = name || username;

            const result = await db.queryOne(
                "INSERT INTO users (username, display_name, email, password, share_code, email_verified) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id",
                [username, displayName, email.toLowerCase(), 'OAUTH_MANAGED', shareCode]
            );
            const userId = result.id;

            // Create default themes
            await db.execute(
                'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [userId, 'Riven', '#162a31', '#1e3840', '#e4ddd0', '#8fa6a8', '#233e46', '#deb96a', 1, 1]
            );
            await db.execute(
                'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [userId, 'Riven Light', '#f5f0e8', '#ffffff', '#1e3840', '#6b7d7f', '#ddd5c8', '#deb96a', 0, 1]
            );

            // Create preset tags
            const presetTags = [
                ['Language', '#3b82f6'], ['Science', '#22c55e'], ['Math', '#f59e0b'], ['History', '#8b5cf6'],
                ['Programming', '#06b6d4'], ['Medical', '#ef4444'], ['Business', '#ec4899'], ['Art', '#f97316']
            ];
            for (const [tagName, color] of presetTags) {
                await db.execute('INSERT INTO tags (user_id, name, color, is_preset) VALUES ($1, $2, $3, 1) ON CONFLICT DO NOTHING', [userId, tagName, color]);
            }

            user = await db.queryOne('SELECT * FROM users WHERE id = $1', [userId]);

            // Welcome email
            try {
                const { sendWelcomeEmail } = require('../utils/email');
                const baseUrl = process.env.FRONTEND_URL || 'https://riven.rocks';
                sendWelcomeEmail(email.toLowerCase(), username, baseUrl).catch(() => { });
            } catch (e) { }
        }
        return user;
    };

    const processOAuthLogin = async (user, res) => {
        if (user.is_banned) {
            return res.status(403).json({ error: 'Your account has been banned due to violations of our terms of service.' });
        }
        if (user.two_fa_enabled) {
            const tempToken = jwt.sign({ id: user.id, email: user.email, type: '2fa_pending' }, jwtSecret, { expiresIn: '5m' });
            return res.json({ require2FA: true, tempToken });
        }

        const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
        const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, jwtSecret, { expiresIn: '30d' });

        const isProd = process.env.NODE_ENV === 'production';
        res.cookie('token', token, {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000
        });

        const effectiveTier = (userRole === 'owner' || userRole === 'admin') && !user.simulate_free_tier ? 'lifetime' : (user.subscription_tier || 'free');

        res.json({
            token,
            require2FA: false,
            user: {
                id: user.id, username: user.username, displayName: user.display_name || user.username, email: user.email, shareCode: user.share_code,
                avatar: user.avatar, banner: user.banner, bio: user.bio || '', role: userRole,
                isAdmin: userRole === 'admin' || userRole === 'owner',
                isOwner: userRole === 'owner',
                streakData: JSON.parse(user.streak_data || '{}'),
                twoFAEnabled: !!user.two_fa_enabled,
                subscription_tier: effectiveTier,
                simulate_free_tier: !!user.simulate_free_tier,
                email_verified: !!user.email_verified
            }
        });
    };

    app.post('/api/auth/oauth/google', speedLimiter, authLimiter, async (req, res) => {
        const { credential } = req.body;
        if (!credential) return res.status(400).json({ error: 'Credential is required' });

        try {
            // Verify access token/ID token
            // The frontend is configured for standard GoogleOAuthProvider which can return access_token OR id_token
            // Here we assume it might be an info fetching requirement if it's an access_token.
            let payload;
            try {
                const ticket = await googleClient.verifyIdToken({
                    idToken: credential,
                    audience: process.env.GOOGLE_CLIENT_ID || 'PLACEHOLDER_GOOGLE_CLIENT_ID'
                });
                payload = ticket.getPayload();
            } catch (err) {
                // Fallback for access_token fetching user info
                const userInfoRes = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo?access_token=${credential}`);
                if (!userInfoRes.ok) throw new Error("Invalid credential");
                payload = await userInfoRes.json();
            }

            if (!payload.email) return res.status(400).json({ error: 'Could not extract email from Google identity' });

            const user = await handleOAuthUser(payload.email, payload.name);
            await processOAuthLogin(user, res);
        } catch (error) {
            console.error('[Auth] Google OAuth Error:', error);
            res.status(500).json({ error: 'Google authentication failed' });
        }
    });

    app.post('/api/auth/oauth/apple', speedLimiter, authLimiter, async (req, res) => {
        const { identityToken, user: appleUser } = req.body;
        if (!identityToken) return res.status(400).json({ error: 'Identity token is required' });

        try {
            const payload = await appleSigninAuth.verifyIdToken(identityToken, {
                audience: process.env.APPLE_CLIENT_ID || 'com.example.web',
                ignoreExpiration: true,
            });

            if (!payload.email) return res.status(400).json({ error: 'Could not extract email from Apple identity' });

            const name = appleUser && appleUser.name ? `${appleUser.name.firstName} ${appleUser.name.lastName}`.trim() : null;
            const user = await handleOAuthUser(payload.email, name);
            await processOAuthLogin(user, res);
        } catch (error) {
            console.error('[Auth] Apple OAuth Error:', error);
            res.status(500).json({ error: 'Apple authentication failed' });
        }
    });

    // 2FA Setup
    app.post('/api/auth/2fa/setup', authMiddleware, async (req, res) => {
        try {
            const secret = speakeasy.generateSecret({ length: 20, name: `Riven (${req.user.email})`, issuer: 'Riven' });
            await db.execute('UPDATE users SET two_fa_secret = $1 WHERE id = $2', [secret.base32, req.user.id]);

            QRCode.toDataURL(secret.otpauth_url, (err, data_url) => {
                if (err) return res.status(500).json({ error: 'Error generating QR code' });
                res.json({ secret: secret.base32, qrCode: data_url });
            });
        } catch (error) {
            console.error('Setup Error:', error);
            res.status(500).json({ error: '2FA setup failed' });
        }
    });

    // 2FA Verify (Enable)
    app.post('/api/auth/2fa/verify', authMiddleware, async (req, res) => {
        let { token } = req.body;
        if (token) token = token.toString().trim();

        try {
            const user = await db.queryOne('SELECT two_fa_secret FROM users WHERE id = $1', [req.user.id]);
            if (!user || !user.two_fa_secret) return res.status(400).json({ error: '2FA not initialized' });

            const verified = speakeasy.totp.verify({
                secret: user.two_fa_secret,
                encoding: 'base32',
                token,
                window: 2 // Allow for 60s clock drift
            });

            if (verified) {
                await db.execute('UPDATE users SET two_fa_enabled = TRUE WHERE id = $1', [req.user.id]);
                res.json({ message: '2FA enabled successfully' });
            } else {
                res.status(400).json({ error: 'Invalid token' });
            }
        } catch (error) {
            res.status(500).json({ error: '2FA verification failed' });
        }
    });

    // 2FA Disable
    app.post('/api/auth/2fa/disable', authMiddleware, async (req, res) => {
        const { password } = req.body;
        try {
            const user = await db.queryOne('SELECT password FROM users WHERE id = $1', [req.user.id]);
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Invalid password' });

            await db.execute('UPDATE users SET two_fa_enabled = FALSE, two_fa_secret = NULL WHERE id = $1', [req.user.id]);
            res.json({ message: '2FA disabled successfully' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to disable 2FA' });
        }
    });

    // 2FA Login Step 2
    app.post('/api/auth/2fa/login', speedLimiter, authLimiter, async (req, res) => {
        let { tempToken, token } = req.body;
        if (!tempToken || !token) return res.status(400).json({ error: 'Missing token' });

        token = token.toString().trim();

        try {
            const decoded = jwt.verify(tempToken, jwtSecret);
            if (decoded.type !== '2fa_pending') return res.status(401).json({ error: 'Invalid session' });

            const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [decoded.id]);
            if (!user) return res.status(401).json({ error: 'User not found' });

            const verified = speakeasy.totp.verify({
                secret: user.two_fa_secret,
                encoding: 'base32',
                token,
                window: 2 // Allow for 60s clock drift
            });

            if (verified) {
                const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
                const newToken = jwt.sign({ id: user.id, email: user.email, role: userRole }, jwtSecret, { expiresIn: '30d' });

                const isProd = process.env.NODE_ENV === 'production';
                res.cookie('token', newToken, {
                    httpOnly: true,
                    secure: isProd,
                    sameSite: isProd ? 'none' : 'lax',
                    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
                });

                const effectiveTier2FA = (userRole === 'owner' || userRole === 'admin') && !user.simulate_free_tier ? 'lifetime' : (user.subscription_tier || 'free');

                res.json({
                    token: newToken,
                    user: {
                        id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
                        avatar: user.avatar, banner: user.banner, bio: user.bio || '', role: userRole,
                        isAdmin: userRole === 'admin' || userRole === 'owner',
                        isOwner: userRole === 'owner',
                        streakData: JSON.parse(user.streak_data || '{}'),
                        twoFAEnabled: !!user.two_fa_enabled,
                        subscription_tier: effectiveTier2FA,
                        simulate_free_tier: !!user.simulate_free_tier,
                        email_verified: !!user.email_verified
                    }
                });
            } else {
                res.status(400).json({ error: 'Invalid 2FA code' });
            }
        } catch (error) {
            res.status(401).json({ error: 'Invalid or expired session' });
        }
    });

    // Logout
    app.post('/api/auth/logout', (req, res) => {
        const isProd = process.env.NODE_ENV === 'production';
        res.clearCookie('token', {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax'
        });
        res.json({ message: 'Logged out successfully' });
    });

    // Get current user
    app.get('/api/auth/me', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (user.is_banned) {
                return res.status(403).json({ error: 'Your account has been banned due to violations of our terms of service.' });
            }

            const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');

            // Ensure robust defaults for potential missing data
            let streakData = {};
            try {
                streakData = user.streak_data ? JSON.parse(user.streak_data) : {};
            } catch (e) { console.error('Error parsing streak_data', e); }

            const petCustomization = user.pet_customization ? JSON.parse(user.pet_customization) : { gardenTheme: 'cottage', decorations: [], specialPlants: [] };

            const effectiveTierMe = (userRole === 'owner' || userRole === 'admin') && !user.simulate_free_tier ? 'lifetime' : (user.subscription_tier || 'free');

            res.json({
                id: user.id, username: user.username, displayName: user.display_name || user.username, email: user.email, shareCode: user.share_code,
                avatar: user.avatar, banner: user.banner, bio: user.bio || '',
                streakData,
                petCustomization,
                role: userRole, isAdmin: userRole === 'admin' || userRole === 'owner',
                isOwner: userRole === 'owner', createdAt: user.created_at,
                twoFAEnabled: !!user.two_fa_enabled,
                subscription_tier: effectiveTierMe,
                simulate_free_tier: !!user.simulate_free_tier,
                email_verified: !!user.email_verified
            });
        } catch (error) {
            console.error('GET /api/auth/me error:', error);
            res.status(500).json({ error: 'Failed to fetch user profile' });
        }
    });

    // Change password
    app.put('/api/auth/password', authMiddleware, async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        if (!newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        try {
            const supabaseSession = getSupabaseSessionToken(req);
            if (supabaseSession) {
                const { anonKey } = getSupabaseConfig();
                await supabaseFetch('/user', {
                    method: 'PUT',
                    apiKey: anonKey,
                    accessToken: supabaseSession.token,
                    body: { password: newPassword },
                });
                return res.json({ message: 'Password changed successfully' });
            }

            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: 'Current and new password are required' });
            }

            const user = await db.queryOne('SELECT password FROM users WHERE id = $1', [req.user.id]);
            const isMatch = await bcrypt.compare(currentPassword, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Current password is incorrect' });

            const hashedPassword = await bcrypt.hash(newPassword, 12);
            await db.execute('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, req.user.id]);
            res.json({ message: 'Password changed successfully' });
        } catch (error) {
            console.error('PUT /api/auth/password error:', error);
            res.status(500).json({ error: 'Failed to change password' });
        }
    });

    // Delete account
    app.delete('/api/auth/account', authMiddleware, async (req, res) => {
        const { password } = req.body;
        try {
            const user = await db.queryOne('SELECT password, supabase_auth_id FROM users WHERE id = $1', [req.user.id]);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const supabaseSession = getSupabaseSessionToken(req);
            if (supabaseSession && user.supabase_auth_id) {
                const { serviceRoleKey } = getSupabaseConfig();
                if (!serviceRoleKey) {
                    return res.status(500).json({ error: 'Supabase service role key is not configured' });
                }

                await supabaseFetch(`/admin/users/${user.supabase_auth_id}`, {
                    method: 'DELETE',
                    apiKey: serviceRoleKey,
                    accessToken: serviceRoleKey,
                    body: { should_soft_delete: false },
                });
            } else {
                const isMatch = await bcrypt.compare(password, user.password);
                if (!isMatch) return res.status(400).json({ error: 'Password is incorrect' });
            }

            await db.execute('DELETE FROM users WHERE id = $1', [req.user.id]);
            res.json({ message: 'Account deleted successfully' });
        } catch (error) {
            console.error('DELETE /api/auth/account error:', error);
            res.status(500).json({ error: 'Failed to delete account' });
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

    app.post('/api/auth/simulate-free', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne(
                'SELECT role, is_admin, simulate_free_tier FROM users WHERE id = $1',
                [req.user.id]
            );

            if (!user) {
                return res.status(404).json({ error: 'User not found' });
            }

            const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
            if (userRole !== 'owner' && userRole !== 'admin') {
                return res.status(403).json({ error: 'Owner or Admin only' });
            }

            const nextValue = !Boolean(user.simulate_free_tier);
            await db.execute(
                'UPDATE users SET simulate_free_tier = $1 WHERE id = $2',
                [nextValue, req.user.id]
            );

            res.json({
                simulate_free_tier: nextValue,
                subscription_tier: nextValue ? 'free' : 'lifetime',
            });
        } catch (error) {
            console.error('POST /api/auth/simulate-free error:', error);
            res.status(500).json({ error: 'Failed to update simulate free tier' });
        }
    });

    // ============ FORGOT / RESET PASSWORD ============

    const crypto = require('crypto');
    const { sendPasswordResetEmail, sendEmailVerification, sendWelcomeEmail } = require('../utils/email');

    // Request password reset
    app.post('/api/auth/forgot-password', speedLimiter, passwordResetLimiter, async (req, res) => {
        const { email } = req.body;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        try {
            // Always return success to prevent email enumeration
            const user = await db.queryOne(
                'SELECT id, email, supabase_auth_id FROM users WHERE LOWER(email) = LOWER($1)',
                [email]
            );

            if (user) {
                let usedSupabaseRecovery = false;
                if (user.supabase_auth_id) {
                    try {
                        const { anonKey } = getSupabaseConfig();
                        await supabaseFetch('/recover', {
                            method: 'POST',
                            apiKey: anonKey,
                            query: { redirect_to: buildRedirectUrl(req, '/reset-password') },
                            body: { email: user.email },
                        });
                        usedSupabaseRecovery = true;
                    } catch (supabaseError) {
                        console.warn('[Auth] Supabase password recovery failed, falling back to legacy flow:', supabaseError.message);
                    }
                }

                if (!usedSupabaseRecovery) {
                    // Invalidate any existing tokens for this user
                    await db.execute('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

                    // Generate secure token
                    const resetToken = crypto.randomBytes(32).toString('hex');
                    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

                    await db.execute(
                        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                        [user.id, resetToken, expiresAt.toISOString()]
                    );

                    await sendPasswordResetEmail(user.email, resetToken, buildRedirectUrl(req, ''));
                }
            }

            // Always return 200 to prevent email enumeration
            res.json({ message: 'If an account with that email exists, a reset link has been sent.' });
        } catch (error) {
            console.error('[Auth] Forgot password error:', error);
            res.status(500).json({ error: 'Failed to process request' });
        }
    });

    // Reset password with token
    app.post('/api/auth/reset-password', speedLimiter, passwordResetLimiter, async (req, res) => {
        const { token, password } = req.body;
        if (!token || !password) return res.status(400).json({ error: 'Token and new password are required' });
        if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

        try {
            const resetRecord = await db.queryOne(
                'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = FALSE AND expires_at > NOW()',
                [token]
            );

            if (!resetRecord) {
                try {
                    const verifyData = await verifySupabaseTokenHash(
                        token,
                        'recovery',
                        buildRedirectUrl(req, '/reset-password')
                    );
                    const accessToken = verifyData?.access_token || verifyData?.session?.access_token;
                    if (!accessToken) {
                        return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
                    }

                    const { anonKey } = getSupabaseConfig();
                    await supabaseFetch('/user', {
                        method: 'PUT',
                        apiKey: anonKey,
                        accessToken,
                        body: { password },
                    });
                    return res.json({ message: 'Password has been reset successfully. You can now log in.' });
                } catch {
                    return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
                }
            }

            // Hash new password and update
            const hashedPassword = await bcrypt.hash(password, 12);
            await db.execute('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, resetRecord.user_id]);

            // Mark token as used
            await db.execute('UPDATE password_reset_tokens SET used = TRUE WHERE id = $1', [resetRecord.id]);

            // Clean up old tokens for this user
            await db.execute('DELETE FROM password_reset_tokens WHERE user_id = $1 AND id != $2', [resetRecord.user_id, resetRecord.id]);

            res.json({ message: 'Password has been reset successfully. You can now log in.' });
        } catch (error) {
            console.error('[Auth] Reset password error:', error);
            res.status(500).json({ error: 'Failed to reset password' });
        }
    });

    // ============ EMAIL VERIFICATION ============

    // Send verification email
    app.post('/api/auth/send-verification', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne(
                'SELECT id, email, email_verified, supabase_auth_id FROM users WHERE id = $1',
                [req.user.id]
            );
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (user.email_verified) return res.json({ message: 'Email already verified' });

            let usedSupabaseVerification = false;
            if (user.supabase_auth_id) {
                try {
                    const { anonKey } = getSupabaseConfig();
                    await supabaseFetch('/resend', {
                        method: 'POST',
                        apiKey: anonKey,
                        query: { redirect_to: buildRedirectUrl(req, '/verify-email') },
                        body: { email: user.email, type: 'signup' },
                    });
                    usedSupabaseVerification = true;
                } catch (supabaseError) {
                    console.warn('[Auth] Supabase resend verification failed, falling back to legacy flow:', supabaseError.message);
                }
            }

            if (!usedSupabaseVerification) {
                // Invalidate existing tokens
                await db.execute('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);

                const verifyToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

                await db.execute(
                    'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                    [user.id, verifyToken, expiresAt.toISOString()]
                );

                await sendEmailVerification(user.email, verifyToken, buildRedirectUrl(req, ''));
            }

            res.json({ message: 'Verification email sent' });
        } catch (error) {
            console.error('[Auth] Send verification error:', error);
            res.status(500).json({ error: 'Failed to send verification email' });
        }
    });

    // Verify email with token
    app.post('/api/auth/verify-email', async (req, res) => {
        const { token } = req.body;
        if (!token) return res.status(400).json({ error: 'Token is required' });

        try {
            const record = await db.queryOne(
                'SELECT * FROM email_verification_tokens WHERE token = $1 AND expires_at > NOW()',
                [token]
            );

            if (!record) {
                try {
                    const verifyData = await verifySupabaseTokenHash(
                        token,
                        'signup',
                        buildRedirectUrl(req, '/verify-email')
                    );
                    const supabaseUserId = verifyData?.user?.id;
                    if (!supabaseUserId) {
                        return res.status(400).json({ error: 'Invalid or expired verification link' });
                    }

                    await db.execute(
                        'UPDATE users SET email_verified = TRUE WHERE supabase_auth_id = $1',
                        [supabaseUserId]
                    );
                    return res.json({ message: 'Email verified successfully' });
                } catch {
                    return res.status(400).json({ error: 'Invalid or expired verification link' });
                }
            }

            await db.execute('UPDATE users SET email_verified = TRUE WHERE id = $1', [record.user_id]);
            await db.execute('DELETE FROM email_verification_tokens WHERE user_id = $1', [record.user_id]);

            res.json({ message: 'Email verified successfully' });
        } catch (error) {
            console.error('[Auth] Verify email error:', error);
            res.status(500).json({ error: 'Failed to verify email' });
        }
    });

    // ============ SUPABASE AUTH BRIDGE ============

    // Complete registration for Supabase Auth users.
    // Called after supabase.auth.signUp() or first OAuth login.
    // Creates (or links) the app user row in our `users` table.
    app.post('/api/auth/complete-registration', speedLimiter, authLimiter, async (req, res) => {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }
        const token = authHeader.split(' ')[1];

        // Verify the token by asking Supabase directly — avoids any JWT secret/algorithm issues
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
        if (!supabaseUrl || !supabaseAnonKey) {
            console.error('[complete-registration] SUPABASE_URL or SUPABASE_ANON_KEY is not set');
            return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_URL/SUPABASE_ANON_KEY missing' });
        }

        let supabaseUser;
        try {
            const verifyRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'apikey': supabaseAnonKey,
                }
            });
            if (!verifyRes.ok) {
                const errBody = await verifyRes.text();
                console.error('[complete-registration] Supabase token verify failed:', verifyRes.status, errBody);
                return res.status(401).json({ error: 'Invalid Supabase token' });
            }
            supabaseUser = await verifyRes.json();
        } catch (err) {
            console.error('[complete-registration] Supabase verify request failed:', err.message);
            return res.status(500).json({ error: 'Failed to verify token' });
        }

        const supabaseAuthId = supabaseUser.id;
        const email = supabaseUser.email;

        // Derive username: body > user_metadata.username > full_name slug > email prefix
        const meta = supabaseUser.user_metadata || {};
        let username = req.body.username
            || meta.username
            || (meta.full_name || '').replace(/[^a-zA-Z0-9_]/g, '').toLowerCase()
            || email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase();

        username = username.slice(0, 30);
        if (!isValidUsername(username)) {
            return res.status(400).json({ error: 'Username must be 2-30 characters, alphanumeric and underscores only' });
        }

        try {
            // Already linked — return existing user
            const existingLinked = await db.queryOne(
                'SELECT * FROM users WHERE supabase_auth_id = $1',
                [supabaseAuthId]
            );
            if (existingLinked) {
                const userRole = existingLinked.role || (existingLinked.is_admin === 1 ? 'admin' : 'user');
                const effectiveTier = (userRole === 'owner' || userRole === 'admin') && !existingLinked.simulate_free_tier
                    ? 'lifetime' : (existingLinked.subscription_tier || 'free');
                return res.json({
                    user: {
                        id: existingLinked.id, username: existingLinked.username,
                        displayName: existingLinked.display_name || existingLinked.username,
                        email: existingLinked.email, shareCode: existingLinked.share_code,
                        avatar: existingLinked.avatar, banner: existingLinked.banner,
                        bio: existingLinked.bio || '', role: userRole,
                        isAdmin: userRole === 'admin' || userRole === 'owner',
                        isOwner: userRole === 'owner',
                        streakData: JSON.parse(existingLinked.streak_data || '{}'),
                        twoFAEnabled: !!existingLinked.two_fa_enabled,
                        subscription_tier: effectiveTier,
                        simulate_free_tier: !!existingLinked.simulate_free_tier,
                        email_verified: true
                    }
                });
            }

            // Legacy user with same email — link the accounts
            const existingEmail = await db.queryOne(
                'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
                [email]
            );
            if (existingEmail) {
                await db.execute(
                    'UPDATE users SET supabase_auth_id = $1, email_verified = TRUE WHERE id = $2',
                    [supabaseAuthId, existingEmail.id]
                );
                const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [existingEmail.id]);
                const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
                const effectiveTier = (userRole === 'owner' || userRole === 'admin') && !user.simulate_free_tier
                    ? 'lifetime' : (user.subscription_tier || 'free');
                return res.json({
                    user: {
                        id: user.id, username: user.username,
                        displayName: user.display_name || user.username,
                        email: user.email, shareCode: user.share_code,
                        avatar: user.avatar, banner: user.banner,
                        bio: user.bio || '', role: userRole,
                        isAdmin: userRole === 'admin' || userRole === 'owner',
                        isOwner: userRole === 'owner',
                        streakData: JSON.parse(user.streak_data || '{}'),
                        twoFAEnabled: !!user.two_fa_enabled,
                        subscription_tier: effectiveTier,
                        simulate_free_tier: !!user.simulate_free_tier,
                        email_verified: true
                    }
                });
            }

            // Ensure username is unique
            let finalUsername = username;
            let counter = 1;
            while (await db.queryOne('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [finalUsername])) {
                finalUsername = `${username}${counter}`;
                counter++;
            }

            // Create new user
            const shareCode = generateShareCode();
            const displayName = meta.full_name || finalUsername;
            const result = await db.queryOne(
                'INSERT INTO users (username, display_name, email, supabase_auth_id, share_code, email_verified) VALUES ($1, $2, $3, $4, $5, TRUE) RETURNING id',
                [finalUsername, displayName, email.toLowerCase(), supabaseAuthId, shareCode]
            );
            const userId = result.id;

            // Default themes
            await db.execute(
                'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [userId, 'Riven', '#162a31', '#1e3840', '#e4ddd0', '#8fa6a8', '#233e46', '#deb96a', 1, 1]
            );
            await db.execute(
                'INSERT INTO themes (user_id, name, bg_color, surface_color, text_color, secondary_text_color, border_color, accent_color, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
                [userId, 'Riven Light', '#f5f0e8', '#ffffff', '#1e3840', '#6b7d7f', '#ddd5c8', '#deb96a', 0, 1]
            );

            // Preset tags
            const presetTags = [
                ['Language', '#3b82f6'], ['Science', '#22c55e'], ['Math', '#f59e0b'], ['History', '#8b5cf6'],
                ['Programming', '#06b6d4'], ['Medical', '#ef4444'], ['Business', '#ec4899'], ['Art', '#f97316']
            ];
            for (const [tagName, color] of presetTags) {
                await db.execute('INSERT INTO tags (user_id, name, color, is_preset) VALUES ($1, $2, $3, 1) ON CONFLICT DO NOTHING', [userId, tagName, color]);
            }

            // Welcome email (fire-and-forget)
            try {
                const { sendWelcomeEmail } = require('../utils/email');
                const baseUrl = process.env.FRONTEND_URL || 'https://riven.rocks';
                sendWelcomeEmail(email.toLowerCase(), finalUsername, baseUrl).catch(() => {});
            } catch (e) {}

            res.status(201).json({
                user: {
                    id: userId, username: finalUsername, displayName, email: email.toLowerCase(),
                    shareCode, avatar: null, banner: null, bio: '', role: 'user',
                    isAdmin: false, isOwner: false, streakData: {}, twoFAEnabled: false,
                    subscription_tier: 'free', simulate_free_tier: false, email_verified: true
                }
            });
        } catch (error) {
            console.error('[Auth] complete-registration error:', error);
            res.status(500).json({ error: 'Registration failed' });
        }
    });

    // Link a Supabase account to an existing user (for legacy users upgrading).
    // Requires a valid legacy JWT in the Authorization header.
    app.post('/api/auth/link-supabase', authMiddleware, async (req, res) => {
        const { supabaseAuthId } = req.body;
        if (!supabaseAuthId) return res.status(400).json({ error: 'supabaseAuthId is required' });

        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(supabaseAuthId)) {
            return res.status(400).json({ error: 'Invalid Supabase auth ID' });
        }

        try {
            const existing = await db.queryOne(
                'SELECT id FROM users WHERE supabase_auth_id = $1',
                [supabaseAuthId]
            );
            if (existing && existing.id !== req.user.id) {
                return res.status(400).json({ error: 'This Supabase account is already linked to another user' });
            }

            await db.execute(
                'UPDATE users SET supabase_auth_id = $1 WHERE id = $2',
                [supabaseAuthId, req.user.id]
            );
            res.json({ success: true });
        } catch (error) {
            console.error('[Auth] link-supabase error:', error);
            res.status(500).json({ error: 'Failed to link account' });
        }
    });
};
