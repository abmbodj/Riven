module.exports = function registerSocialRoutes({ app, db, authMiddleware }) {
    // Admin middleware for moderation routes
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

    // ==========================================
    // ADMIN MODERATION ROUTES
    // ==========================================

    // List all reports (Admin only)
    app.get('/api/admin/reports', authMiddleware, adminMiddleware, async (req, res) => {
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
    app.post('/api/admin/reports/:id/resolve', authMiddleware, adminMiddleware, async (req, res) => {
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
    app.post('/api/admin/reports/:id/close', authMiddleware, adminMiddleware, async (req, res) => {
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
    app.post('/api/admin/users/:id/ban', authMiddleware, adminMiddleware, async (req, res) => {
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
