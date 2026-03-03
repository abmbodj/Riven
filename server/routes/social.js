module.exports = function registerSocialRoutes({ app, db, authMiddleware }) {
    // Search users by username or share code
    app.get('/api/users/search', authMiddleware, async (req, res) => {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json([]);

        try {
            const users = await db.query(
                `SELECT id, username, avatar, bio, share_code, role, is_admin FROM users 
             WHERE id != $1 AND (LOWER(username) LIKE LOWER($2) OR UPPER(share_code) = UPPER($3))
             LIMIT 20`,
                [req.user.id, `%${q}%`, q]
            );
            res.json(users.map(u => {
                const r = u.role || (u.is_admin === 1 ? 'admin' : 'user');
                return {
                    id: u.id, username: u.username, avatar: u.avatar, bio: u.bio, shareCode: u.share_code,
                    role: r, isAdmin: r === 'admin' || r === 'owner', isOwner: r === 'owner'
                };
            }));
        } catch (error) {
            console.error('GET /api/users/search error:', error);
            res.status(500).json({ error: 'Search failed' });
        }
    });

    // Get user profile by ID
    app.get('/api/users/:id', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne(
                'SELECT id, username, avatar, bio, share_code, role, is_admin, created_at FROM users WHERE id = $1',
                [req.params.id]
            );
            if (!user) return res.status(404).json({ error: 'User not found' });

            const userRole = user.role || (user.is_admin === 1 ? 'admin' : 'user');

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
                role: userRole,
                isAdmin: userRole === 'admin' || userRole === 'owner',
                isOwner: userRole === 'owner',
                deckCount: parseInt(deckCount.count),
                friendshipStatus: friendship ? friendship.status : null,
                friendshipDirection: friendship ? (friendship.user_id === req.user.id ? 'outgoing' : 'incoming') : null
            });
        } catch (error) {
            console.error('GET /api/users/:id error:', error);
            res.status(500).json({ error: 'Failed to fetch user profile' });
        }
    });

    // Get friends list
    app.get('/api/friends', authMiddleware, async (req, res) => {
        try {
            const friends = await db.query(
                `SELECT u.id, u.username, u.avatar, u.bio, u.role, u.is_admin, f.status, f.user_id as requester_id, f.created_at
             FROM friendships f
             JOIN users u ON (CASE WHEN f.user_id = $1 THEN f.friend_id ELSE f.user_id END) = u.id
             WHERE (f.user_id = $1 OR f.friend_id = $1)
             ORDER BY f.created_at DESC`,
                [req.user.id]
            );

            res.json(friends.map(f => {
                const r = f.role || (f.is_admin === 1 ? 'admin' : 'user');
                return {
                    id: f.id,
                    username: f.username,
                    avatar: f.avatar,
                    bio: f.bio,
                    status: f.status,
                    role: r,
                    isAdmin: r === 'admin' || r === 'owner',
                    isOwner: r === 'owner',
                    isOutgoing: f.requester_id === req.user.id,
                    createdAt: f.created_at
                };
            }));
        } catch (error) {
            console.error('GET /api/friends error:', error);
            res.status(500).json({ error: 'Failed to fetch friends' });
        }
    });

    // Send friend request
    app.post('/api/friends/request', authMiddleware, async (req, res) => {
        const { userId } = req.body;
        if (!userId) return res.status(400).json({ error: 'User ID is required' });
        if (userId === req.user.id) return res.status(400).json({ error: 'Cannot friend yourself' });

        try {
            // Check if current user is banned
            const currentUser = await db.queryOne('SELECT is_banned FROM users WHERE id = $1', [req.user.id]);
            if (currentUser && currentUser.is_banned) {
                return res.status(403).json({ error: 'Your account has been restricted from social features.' });
            }
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
            console.error('POST /api/friends/request error:', error);
            res.status(500).json({ error: 'Failed to send friend request' });
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
            console.error('POST /api/friends/accept error:', error);
            res.status(500).json({ error: 'Failed to accept friend request' });
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
            console.error('DELETE /api/friends error:', error);
            res.status(500).json({ error: 'Failed to remove friend' });
        }
    });

    // ==========================================
    // BLOCK & REPORT SYSTEM
    // ==========================================

    // Get blocked users list
    app.get('/api/blocked-users', authMiddleware, async (req, res) => {
        try {
            const blockedUsers = await db.query(
                `SELECT u.id, u.username, u.avatar, b.created_at as blocked_at
                 FROM user_blocks b
                 JOIN users u ON b.blocked_id = u.id
                 WHERE b.blocker_id = $1
                 ORDER BY b.created_at DESC`,
                [req.user.id]
            );
            res.json(blockedUsers);
        } catch (error) {
            console.error('GET /api/blocked-users error:', error);
            res.status(500).json({ error: 'Failed to fetch blocked users' });
        }
    });

    // Block a user
    app.post('/api/users/:id/block', authMiddleware, async (req, res) => {
        const blockId = parseInt(req.params.id);
        if (blockId === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });

        try {
            // Remove any existing friendship in both directions
            await db.execute(
                `DELETE FROM friendships 
                 WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
                [req.user.id, blockId]
            );

            // Insert block
            await db.execute(
                `INSERT INTO user_blocks (blocker_id, blocked_id) 
                 VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [req.user.id, blockId]
            );

            res.json({ message: 'User blocked successfully' });
        } catch (error) {
            console.error('POST /api/users/:id/block error:', error);
            res.status(500).json({ error: 'Failed to block user' });
        }
    });

    // Unblock a user
    app.delete('/api/users/:id/block', authMiddleware, async (req, res) => {
        const blockId = parseInt(req.params.id);

        try {
            await db.execute(
                `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
                [req.user.id, blockId]
            );
            res.json({ message: 'User unblocked successfully' });
        } catch (error) {
            console.error('DELETE /api/users/:id/block error:', error);
            res.status(500).json({ error: 'Failed to unblock user' });
        }
    });

    // Submit a report
    app.post('/api/reports', authMiddleware, async (req, res) => {
        const { reportedUserId, contentType, contentId, reason, details } = req.body;

        if (!contentType || !reason) {
            return res.status(400).json({ error: 'Missing required report fields' });
        }

        try {
            await db.execute(
                `INSERT INTO reports (reporter_id, reported_user_id, content_type, content_id, reason, details)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [req.user.id, reportedUserId || null, contentType, contentId || null, reason, details || '']
            );
            res.json({ message: 'Report submitted successfully. Our team will review it shortly.' });
        } catch (error) {
            console.error('POST /api/reports error:', error);
            res.status(500).json({ error: 'Failed to submit report' });
        }
    });

    // ==========================================
    // ADMIN MODERATION ROUTES
    // ==========================================

    // List all reports (Admin only)
    app.get('/api/admin/reports', authMiddleware, async (req, res) => {
        if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.is_admin !== 1) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        try {
            const reports = await db.query(`
                SELECT r.*, 
                       reporter.username as reporter_name,
                       reported.username as reported_name,
                       resolver.username as resolver_name
                FROM reports r
                LEFT JOIN users reporter ON r.reporter_id = reporter.id
                LEFT JOIN users reported ON r.reported_user_id = reported.id
                LEFT JOIN users resolver ON r.resolved_by = resolver.id
                ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
            `);
            res.json(reports);
        } catch (error) {
            console.error('GET /api/admin/reports error:', error);
            res.status(500).json({ error: 'Failed to fetch reports' });
        }
    });

    // Resolve a report (Admin only)
    app.post('/api/admin/reports/:id/resolve', authMiddleware, async (req, res) => {
        if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.is_admin !== 1) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        try {
            await db.execute(
                `UPDATE reports SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1 WHERE id = $2`,
                [req.user.id, req.params.id]
            );
            res.json({ message: 'Report resolved' });
        } catch (error) {
            console.error('POST /api/admin/reports/:id/resolve error:', error);
            res.status(500).json({ error: 'Failed to resolve report' });
        }
    });

    // Close a report (Admin only)
    app.post('/api/admin/reports/:id/close', authMiddleware, async (req, res) => {
        if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.is_admin !== 1) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        try {
            await db.execute(
                `UPDATE reports SET status = 'closed', resolved_at = CURRENT_TIMESTAMP, resolved_by = $1 WHERE id = $2`,
                [req.user.id, req.params.id]
            );
            res.json({ message: 'Report closed' });
        } catch (error) {
            console.error('POST /api/admin/reports/:id/close error:', error);
            res.status(500).json({ error: 'Failed to close report' });
        }
    });

    // Ban a user (Admin only)
    app.post('/api/admin/users/:id/ban', authMiddleware, async (req, res) => {
        if (req.user.role !== 'admin' && req.user.role !== 'owner' && req.user.is_admin !== 1) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const targetId = parseInt(req.params.id);
        if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot ban yourself' });

        try {
            // Get user to ensure we don't ban an owner
            const targetUser = await db.queryOne('SELECT role FROM users WHERE id = $1', [targetId]);
            if (!targetUser) return res.status(404).json({ error: 'User not found' });
            if (targetUser.role === 'owner') return res.status(403).json({ error: 'Cannot ban the owner' });
            if (targetUser.role === 'admin' && req.user.role !== 'owner') return res.status(403).json({ error: 'Only owner can ban an admin' });

            await db.execute(`UPDATE users SET is_banned = TRUE WHERE id = $1`, [targetId]);
            res.json({ message: 'User has been banned' });
        } catch (error) {
            console.error('POST /api/admin/users/:id/ban error:', error);
            res.status(500).json({ error: 'Failed to ban user' });
        }
    });
};

