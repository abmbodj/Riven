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

    // Stricter rate limiter for password reset (3 requests per hour in production)
    const passwordResetLimiter = rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: isProdEnv ? 3 : 50,
        message: { error: 'Too many password reset attempts, please try again later' },
        standardHeaders: true,
        legacyHeaders: false,
    });

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

            const result = await db.queryOne(
                'INSERT INTO users (username, display_name, email, password, share_code) VALUES ($1, $2, $3, $4, $5) RETURNING id',
                [username, displayName, email.toLowerCase(), hashedPassword, shareCode]
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
                await db.execute('INSERT INTO tags (user_id, name, color, is_preset) VALUES ($1, $2, $3, 1)', [userId, name, color]);
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
                user: { id: userId, username, displayName, email: email.toLowerCase(), shareCode, avatar: null, bio: '', streakData: {}, role: 'user', isAdmin: false, twoFAEnabled: false, email_verified: false }
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
                    avatar: user.avatar, bio: user.bio || '', role: userRole,
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
                        avatar: user.avatar, bio: user.bio || '', role: userRole,
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
                avatar: user.avatar, bio: user.bio || '',
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

    // Update profile
    app.put('/api/auth/profile', authMiddleware, async (req, res) => {
        const { username, displayName, bio, avatar } = req.body;
        try {
            // Uniqueness check for username if it's changing
            if (username) {
                if (!isValidUsername(username)) {
                    return res.status(400).json({ error: 'Username must be 2-30 characters, alphanumeric and underscores only' });
                }
                const existing = await db.queryOne('SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2', [username, req.user.id]);
                if (existing) return res.status(400).json({ error: 'Username already taken' });
            }

            await db.execute(
                'UPDATE users SET username = COALESCE($1, username), display_name = COALESCE($2, display_name), bio = COALESCE($3, bio), avatar = COALESCE($4, avatar) WHERE id = $5',
                [username, displayName, bio, avatar, req.user.id]
            );

            const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [req.user.id]);
            const updatedRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
            const effectiveTierProfile = (updatedRole === 'owner' || updatedRole === 'admin') && !user.simulate_free_tier ? 'lifetime' : (user.subscription_tier || 'free');
            res.json({
                id: user.id, username: user.username, displayName: user.display_name || user.username, email: user.email, shareCode: user.share_code,
                avatar: user.avatar, bio: user.bio || '', streakData: JSON.parse(user.streak_data || '{}'),
                role: updatedRole, isAdmin: updatedRole === 'admin' || updatedRole === 'owner',
                isOwner: updatedRole === 'owner', createdAt: user.created_at,
                twoFAEnabled: !!user.two_fa_enabled,
                subscription_tier: effectiveTierProfile,
                simulate_free_tier: !!user.simulate_free_tier
            });
        } catch (error) {
            console.error('PUT /api/auth/profile error:', error);
            res.status(500).json({ error: 'Failed to update profile' });
        }
    });

    // Change password
    app.put('/api/auth/password', authMiddleware, async (req, res) => {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current and new password are required' });
        }
        if (newPassword.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters' });
        }

        try {
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
            const user = await db.queryOne('SELECT password FROM users WHERE id = $1', [req.user.id]);
            const isMatch = await bcrypt.compare(password, user.password);
            if (!isMatch) return res.status(400).json({ error: 'Password is incorrect' });

            await db.execute('DELETE FROM users WHERE id = $1', [req.user.id]);
            res.json({ message: 'Account deleted successfully' });
        } catch (error) {
            console.error('DELETE /api/auth/account error:', error);
            res.status(500).json({ error: 'Failed to delete account' });
        }
    });

    // Streak endpoints
    app.put('/api/auth/streak', authMiddleware, async (req, res) => {
        const { streakData } = req.body;
        try {
            await db.execute('UPDATE users SET streak_data = $1 WHERE id = $2', [JSON.stringify(streakData), req.user.id]);
            res.json({ message: 'Streak data saved' });
        } catch (error) {
            console.error('PUT /api/auth/streak error:', error);
            res.status(500).json({ error: 'Failed to save streak data' });
        }
    });

    app.get('/api/auth/streak', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT streak_data FROM users WHERE id = $1', [req.user.id]);
            res.json(JSON.parse(user.streak_data || '{}'));
        } catch (error) {
            console.error('GET /api/auth/streak error:', error);
            res.status(500).json({ error: 'Failed to fetch streak data' });
        }
    });

    // Garden customization endpoints (uses pet_customization column)
    app.get('/api/auth/pet', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT pet_customization FROM users WHERE id = $1', [req.user.id]);
            const defaultCustomization = { gardenTheme: 'cottage', decorations: [], specialPlants: [] };
            res.json(user?.pet_customization ? JSON.parse(user.pet_customization) : defaultCustomization);
        } catch (error) {
            console.error('GET /api/auth/pet error:', error);
            res.status(500).json({ error: 'Failed to fetch garden customization' });
        }
    });

    app.put('/api/auth/pet', authMiddleware, async (req, res) => {
        const { customization } = req.body;
        try {
            await db.execute('UPDATE users SET pet_customization = $1 WHERE id = $2', [JSON.stringify(customization), req.user.id]);
            res.json({ message: 'Garden customization saved', customization });
        } catch (error) {
            console.error('PUT /api/auth/pet error:', error);
            res.status(500).json({ error: 'Failed to save garden customization' });
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

    // Toggle simulate free tier (owner only)
    app.post('/api/auth/simulate-free', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT role, simulate_free_tier FROM users WHERE id = $1', [req.user.id]);
            const userRole = user.role || 'user';
            if (userRole !== 'owner' && userRole !== 'admin') return res.status(403).json({ error: 'Owner or Admin only' });

            const newVal = !user.simulate_free_tier;
            await db.execute('UPDATE users SET simulate_free_tier = $1 WHERE id = $2', [newVal, req.user.id]);
            res.json({ simulate_free_tier: newVal, subscription_tier: newVal ? 'free' : 'lifetime' });
        } catch (error) {
            console.error('POST /api/auth/simulate-free error:', error);
            res.status(500).json({ error: 'Failed to toggle free tier' });
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
            const user = await db.queryOne('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [email]);

            if (user) {
                // Invalidate any existing tokens for this user
                await db.execute('DELETE FROM password_reset_tokens WHERE user_id = $1', [user.id]);

                // Generate secure token
                const resetToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

                await db.execute(
                    'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                    [user.id, resetToken, expiresAt.toISOString()]
                );

                // Determine base URL for the reset link
                const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';

                await sendPasswordResetEmail(user.email, resetToken, baseUrl);
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
                return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
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
            const user = await db.queryOne('SELECT id, email, email_verified FROM users WHERE id = $1', [req.user.id]);
            if (!user) return res.status(404).json({ error: 'User not found' });
            if (user.email_verified) return res.json({ message: 'Email already verified' });

            // Invalidate existing tokens
            await db.execute('DELETE FROM email_verification_tokens WHERE user_id = $1', [user.id]);

            const verifyToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

            await db.execute(
                'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
                [user.id, verifyToken, expiresAt.toISOString()]
            );

            const baseUrl = process.env.FRONTEND_URL || req.headers.origin || 'http://localhost:5173';
            await sendEmailVerification(user.email, verifyToken, baseUrl);

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
                return res.status(400).json({ error: 'Invalid or expired verification link' });
            }

            await db.execute('UPDATE users SET email_verified = TRUE WHERE id = $1', [record.user_id]);
            await db.execute('DELETE FROM email_verification_tokens WHERE user_id = $1', [record.user_id]);

            res.json({ message: 'Email verified successfully' });
        } catch (error) {
            console.error('[Auth] Verify email error:', error);
            res.status(500).json({ error: 'Failed to verify email' });
        }
    });
};

