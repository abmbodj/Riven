const queryCache = require('../utils/queryCache');

module.exports = function registerClassesRoutes({ app, db, authMiddleware }) {
    // GET /api/classes
    app.get('/api/classes', authMiddleware, async (req, res) => {
        try {
            const classes = await queryCache.wrap(req.user.id, 'classes', () =>
                db.query(
                    `SELECT * FROM classes WHERE user_id = $1 ORDER BY created_at DESC`,
                    [req.user.id]
                )
            );
            res.json(classes);
        } catch (error) {
            console.error('GET /api/classes error:', error);
            res.status(500).json({ error: 'Failed to fetch classes' });
        }
    });

    // POST /api/classes
    app.post('/api/classes', authMiddleware, async (req, res) => {
        const { name, color, professor, room, zoom_link } = req.body;
        if (!name) return res.status(400).json({ error: 'Class name is required' });

        try {
            const result = await db.queryOne(
                `INSERT INTO classes (user_id, name, color, professor, room, zoom_link) 
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [req.user.id, name, color || null, professor || null, room || null, zoom_link || null]
            );
            queryCache.invalidate(req.user.id, 'classes');
            res.status(201).json(result);
        } catch (error) {
            console.error('POST /api/classes error:', error);
            res.status(500).json({ error: 'Failed to create class' });
        }
    });

    // PUT /api/classes/:id
    app.put('/api/classes/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { name, color, professor, room, zoom_link } = req.body;

        try {
            const cls = await db.queryOne('SELECT * FROM classes WHERE id = $1', [id]);
            if (!cls) return res.status(404).json({ error: 'Class not found' });
            if (cls.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

            const result = await db.queryOne(
                `UPDATE classes 
                 SET name = COALESCE($1, name), 
                     color = $2, 
                     professor = $3, 
                     room = $4, 
                     zoom_link = $5 
                 WHERE id = $6 RETURNING *`,
                [name, color !== undefined ? color : cls.color,
                    professor !== undefined ? professor : cls.professor,
                    room !== undefined ? room : cls.room,
                    zoom_link !== undefined ? zoom_link : cls.zoom_link,
                    id]
            );
            queryCache.invalidate(req.user.id, 'classes');
            res.json(result);
        } catch (error) {
            console.error('PUT /api/classes error:', error);
            res.status(500).json({ error: 'Failed to update class' });
        }
    });

    // DELETE /api/classes/:id
    app.delete('/api/classes/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            const cls = await db.queryOne('SELECT * FROM classes WHERE id = $1', [id]);
            if (!cls) return res.status(404).json({ error: 'Class not found' });
            if (cls.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

            await db.execute('DELETE FROM classes WHERE id = $1', [id]);
            queryCache.invalidate(req.user.id, 'classes');
            res.json({ message: 'Class deleted' });
        } catch (error) {
            console.error('DELETE /api/classes error:', error);
            res.status(500).json({ error: 'Failed to delete class' });
        }
    });
};
