module.exports = function registerScheduleRoutes({ app, db, authMiddleware }) {
    // GET /api/schedule
    app.get('/api/schedule', authMiddleware, async (req, res) => {
        try {
            const query = `
                SELECT s.* 
                FROM schedule_slots s
                JOIN classes c ON s.class_id = c.id
                WHERE s.user_id = $1
            `;
            const slots = await db.query(query, [req.user.id]);
            res.json(slots);
        } catch (error) {
            console.error('GET /api/schedule error:', error);
            res.status(500).json({ error: 'Failed to fetch schedule' });
        }
    });

    // POST /api/schedule
    app.post('/api/schedule', authMiddleware, async (req, res) => {
        const { class_id, day_of_week, start_time, end_time } = req.body;

        if (!class_id || day_of_week === undefined || !start_time || !end_time) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        try {
            // Verify class exists and belongs to user
            const cls = await db.queryOne('SELECT * FROM classes WHERE id = $1 AND user_id = $2', [class_id, req.user.id]);
            if (!cls) return res.status(403).json({ error: 'Class not found or not authorized' });

            const result = await db.queryOne(
                `INSERT INTO schedule_slots (user_id, class_id, day_of_week, start_time, end_time)
                 VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                [req.user.id, class_id, day_of_week, start_time, end_time]
            );
            res.status(201).json(result);
        } catch (error) {
            console.error('POST /api/schedule error:', error);
            res.status(500).json({ error: 'Failed to create schedule slot' });
        }
    });

    // DELETE /api/schedule/:id
    app.delete('/api/schedule/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            const slot = await db.queryOne('SELECT * FROM schedule_slots WHERE id = $1', [id]);
            if (!slot) return res.status(404).json({ error: 'Schedule slot not found' });
            if (slot.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

            await db.execute('DELETE FROM schedule_slots WHERE id = $1', [id]);
            res.json({ message: 'Schedule slot deleted' });
        } catch (error) {
            console.error('DELETE /api/schedule error:', error);
            res.status(500).json({ error: 'Failed to delete schedule slot' });
        }
    });
};
