module.exports = function registerAdminRoutes({ app, db, authMiddleware }) {
    async function adminMiddleware(req, res, next) {
        try {
            const user = await db.queryOne('SELECT role, is_admin FROM users WHERE id = $1', [req.user.id]);
            if (!user) return res.status(404).json({ error: 'User not found' });

            const role = user.role || (user.is_admin === 1 ? 'admin' : 'user');
            if (role !== 'admin' && role !== 'owner') {
                return res.status(403).json({ error: 'Admin access required' });
            }

            req.user.role = role;
            next();
        } catch (error) {
            res.status(500).json({ error: 'Failed to verify permissions' });
        }
    }

    async function ownerMiddleware(req, res, next) {
        try {
            const user = await db.queryOne('SELECT role FROM users WHERE id = $1', [req.user.id]);
            if (!user) return res.status(404).json({ error: 'User not found' });

            if (user.role !== 'owner') {
                return res.status(403).json({ error: 'Owner access required' });
            }

            req.user.role = 'owner';
            next();
        } catch (error) {
            res.status(500).json({ error: 'Failed to verify permissions' });
        }
    }

    app.get('/api/admin/users', authMiddleware, adminMiddleware, async (req, res) => {
        try {
            const users = await db.query('SELECT id, username, email, share_code, avatar, bio, streak_data, is_admin, role, created_at FROM users ORDER BY created_at DESC');
            res.json(users.map(u => {
                const r = u.role || (u.is_admin === 1 ? 'admin' : 'user');
                return {
                    id: u.id, username: u.username, email: u.email, shareCode: u.share_code,
                    avatar: u.avatar, bio: u.bio || '', streakData: JSON.parse(u.streak_data || '{}'),
                    role: r, isAdmin: r === 'admin' || r === 'owner', isOwner: r === 'owner',
                    createdAt: u.created_at
                };
            }));
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    });

    // Change a user's role (Owner only)
    app.put('/api/admin/users/:id/role', authMiddleware, ownerMiddleware, async (req, res) => {
        const { id } = req.params;
        const { role } = req.body;

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Role must be "user" or "admin"' });
        }

        try {
            const target = await db.queryOne('SELECT * FROM users WHERE id = $1', [id]);
            if (!target) return res.status(404).json({ error: 'User not found' });

            if (target.role === 'owner') {
                return res.status(400).json({ error: 'Cannot change the owner\'s role' });
            }
            if (parseInt(id) === req.user.id) {
                return res.status(400).json({ error: 'Cannot change your own role' });
            }

            const isAdminVal = role === 'admin' ? 1 : 0;
            await db.execute('UPDATE users SET role = $1, is_admin = $2 WHERE id = $3', [role, isAdminVal, id]);

            res.json({ id: target.id, username: target.username, role, isAdmin: role === 'admin' });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update user role' });
        }
    });

    app.put('/api/admin/users/:id', authMiddleware, adminMiddleware, async (req, res) => {
        const { id } = req.params;
        const { username, email, bio } = req.body;

        try {
            await db.execute(
                'UPDATE users SET username = COALESCE($1, username), email = COALESCE($2, email), bio = COALESCE($3, bio) WHERE id = $4',
                [username, email, bio, id]
            );

            const user = await db.queryOne('SELECT * FROM users WHERE id = $1', [id]);
            if (!user) return res.status(404).json({ error: 'User not found' });
            const r = user.role || (user.is_admin === 1 ? 'admin' : 'user');

            res.json({ id: user.id, username: user.username, email: user.email, role: r, isAdmin: r === 'admin' || r === 'owner' });
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

            // Check if target user is an owner — prevent deletion
            const target = await db.queryOne('SELECT role FROM users WHERE id = $1', [id]);
            if (!target) return res.status(404).json({ error: 'User not found' });
            if (target.role === 'owner') {
                return res.status(400).json({ error: 'Cannot delete the owner account' });
            }
            // Only owners can delete admins
            if ((target.role === 'admin') && req.user.role !== 'owner') {
                return res.status(403).json({ error: 'Only owners can delete admin accounts' });
            }

            await db.execute('DELETE FROM users WHERE id = $1', [id]);
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

            // Get recent signups (last 30 days)
            const recentUsers = await db.queryOne(`
            SELECT COUNT(*) as count FROM users 
            WHERE created_at > NOW() - INTERVAL '30 days'
        `);

            // Get study sessions in last 30 days
            const recentSessions = await db.queryOne(`
            SELECT COUNT(*) as count FROM study_sessions 
            WHERE created_at > NOW() - INTERVAL '30 days'
        `);

            // Daily Activity (Last 30 Days)
            const dailyActivity = await db.query(`
            SELECT TO_CHAR(created_at, 'YYYY-MM-DD') as date, COUNT(*) as count
            FROM study_sessions
            WHERE created_at > NOW() - INTERVAL '30 days'
            GROUP BY date
            ORDER BY date ASC
        `);

            // Fill in missing days for the last 30 days
            const filledDailyActivity = [];
            for (let i = 29; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const found = dailyActivity.find(a => a.date === dateStr);
                filledDailyActivity.push({ date: dateStr, count: found ? parseInt(found.count) : 0 });
            }

            // Top Decks (by study session count in the last 30 days)
            const topDecks = await db.query(`
            SELECT d.title, u.username as creator, COUNT(ss.id) as session_count
            FROM study_sessions ss
            JOIN decks d ON ss.deck_id = d.id
            LEFT JOIN users u ON d.user_id = u.id
            WHERE ss.created_at > NOW() - INTERVAL '30 days'
            GROUP BY d.id, d.title, u.username
            ORDER BY session_count DESC
            LIMIT 5
        `);

            res.json({
                users: parseInt(userCount.count),
                decks: parseInt(deckCount.count),
                cards: parseInt(cardCount.count),
                sharedDecks: parseInt(sharedCount.count),
                activeMessages: parseInt(messageCount.count),
                recentSignups: parseInt(recentUsers.count),
                recentSessions: parseInt(recentSessions.count),
                dailyActivity: filledDailyActivity,
                topDecks: topDecks.map(d => ({
                    title: d.title,
                    creator: d.creator || 'Unknown',
                    sessions: parseInt(d.session_count)
                }))
            });
        } catch (error) {
            res.status(500).json({ error: 'Registration failed' });
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
};

