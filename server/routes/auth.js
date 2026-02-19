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
            // Production: sameSite 'none' for cross-origin (frontend/API on different domains)
            // Dev: sameSite 'lax' for localhost different ports
            const isProd = process.env.NODE_ENV === 'production';
            res.cookie('token', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            res.status(201).json({
                token,
                user: { id: userId, username, email: email.toLowerCase(), shareCode, avatar: null, bio: '', streakData: {}, role: 'user', isAdmin: false, twoFAEnabled: false }
            });
        } catch (error) {
            res.status(500).json({ error: 'Verification failed' });
        }
    });

    // Login
    app.post('/api/auth/login', speedLimiter, authLimiter, async (req, res) => {
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

            // Check 2FA
            if (user.two_fa_enabled) {
                const tempToken = jwt.sign({ id: user.id, email: user.email, type: '2fa_pending' }, jwtSecret, { expiresIn: '5m' });
                return res.json({ require2FA: true, tempToken });
            }

            const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
            const token = jwt.sign({ id: user.id, email: user.email, role: userRole }, jwtSecret, { expiresIn: '30d' });

            // Set httpOnly cookie (secure in production)
            const isProd = process.env.NODE_ENV === 'production';
            console.log(`[Auth] Login successful for ${email}:`, { isProd, userRole });
            res.cookie('token', token, {
                httpOnly: true,
                secure: isProd,
                sameSite: isProd ? 'none' : 'lax',
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });

            res.json({
                token,
                require2FA: false,
                user: {
                    id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
                    avatar: user.avatar, bio: user.bio || '', role: userRole,
                    isAdmin: userRole === 'admin' || userRole === 'owner',
                    isOwner: userRole === 'owner',
                    streakData: JSON.parse(user.streak_data || '{}'),
                    twoFAEnabled: !!user.two_fa_enabled
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
            res.status(500).json({ error: '2FA setup failed', details: error.toString() });
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

                res.json({
                    token: newToken,
                    user: {
                        id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
                        avatar: user.avatar, bio: user.bio || '', role: userRole,
                        isAdmin: userRole === 'admin' || userRole === 'owner',
                        isOwner: userRole === 'owner',
                        streakData: JSON.parse(user.streak_data || '{}'),
                        twoFAEnabled: !!user.two_fa_enabled
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

            const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');

            // Ensure robust defaults for potential missing data
            let streakData = {};
            try {
                streakData = user.streak_data ? JSON.parse(user.streak_data) : {};
            } catch (e) { console.error('Error parsing streak_data', e); }

            const petCustomization = user.pet_customization ? JSON.parse(user.pet_customization) : { gardenTheme: 'cottage', decorations: [], specialPlants: [] };

            res.json({
                id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
                avatar: user.avatar, bio: user.bio || '',
                streakData,
                petCustomization,
                role: userRole, isAdmin: userRole === 'admin' || userRole === 'owner',
                isOwner: userRole === 'owner', createdAt: user.created_at,
                twoFAEnabled: !!user.two_fa_enabled
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
            const updatedRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');
            res.json({
                id: user.id, username: user.username, email: user.email, shareCode: user.share_code,
                avatar: user.avatar, bio: user.bio || '', streakData: JSON.parse(user.streak_data || '{}'),
                role: updatedRole, isAdmin: updatedRole === 'admin' || updatedRole === 'owner',
                isOwner: updatedRole === 'owner', createdAt: user.created_at,
                twoFAEnabled: !!user.two_fa_enabled
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

    // Garden customization endpoints (uses pet_customization column)
    app.get('/api/auth/pet', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT pet_customization FROM users WHERE id = $1', [req.user.id]);
            const defaultCustomization = { gardenTheme: 'cottage', decorations: [], specialPlants: [] };
            res.json(user?.pet_customization ? JSON.parse(user.pet_customization) : defaultCustomization);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    app.put('/api/auth/pet', authMiddleware, async (req, res) => {
        const { customization } = req.body;
        try {
            await db.execute('UPDATE users SET pet_customization = $1 WHERE id = $2', [JSON.stringify(customization), req.user.id]);
            res.json({ message: 'Garden customization saved', customization });
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
};

