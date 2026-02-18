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
            res.status(500).json({ error: error.message });
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
            res.status(500).json({ error: error.message });
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
};

