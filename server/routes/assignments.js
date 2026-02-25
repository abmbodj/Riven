module.exports = function registerAssignmentsRoutes({ app, db, authMiddleware }) {
    // GET /api/assignments?class_id=xxx
    app.get('/api/assignments', authMiddleware, async (req, res) => {
        const { class_id } = req.query;
        try {
            let query = 'SELECT * FROM assignments WHERE user_id = $1';
            const params = [req.user.id];

            if (class_id) {
                query += ' AND class_id = $2';
                params.push(class_id);
            }
            query += ' ORDER BY created_at DESC';

            const assignments = await db.query(query, params);
            res.json(assignments);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST /api/assignments
    app.post('/api/assignments', authMiddleware, async (req, res) => {
        const { class_id, title, description, due_date, type } = req.body;
        if (!class_id) return res.status(400).json({ error: 'class_id is required' });
        if (!title) return res.status(400).json({ error: 'title is required' });

        try {
            // Verify class exists and belongs to user
            const cls = await db.queryOne('SELECT * FROM classes WHERE id = $1 AND user_id = $2', [class_id, req.user.id]);
            if (!cls) return res.status(403).json({ error: 'Class not found or not authorized' });

            const result = await db.queryOne(
                `INSERT INTO assignments (user_id, class_id, title, description, status, due_date, type)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [req.user.id, class_id, title, description || null, 'Todo', due_date || null, type || 'homework']
            );
            res.status(201).json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // PUT /api/assignments/:id
    app.put('/api/assignments/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        const { title, description, status, due_date, type } = req.body;

        try {
            const assignment = await db.queryOne('SELECT * FROM assignments WHERE id = $1', [id]);
            if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
            if (assignment.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

            const result = await db.queryOne(
                `UPDATE assignments 
                 SET title = COALESCE($1, title), 
                     description = $2, 
                     status = COALESCE($3, status), 
                     due_date = $4,
                     type = COALESCE($5, type)
                 WHERE id = $6 RETURNING *`,
                [title,
                    description !== undefined ? description : assignment.description,
                    status,
                    due_date !== undefined ? due_date : assignment.due_date,
                    type,
                    id]
            );
            res.json(result);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // DELETE /api/assignments/:id
    app.delete('/api/assignments/:id', authMiddleware, async (req, res) => {
        const { id } = req.params;
        try {
            const assignment = await db.queryOne('SELECT * FROM assignments WHERE id = $1', [id]);
            if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
            if (assignment.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });

            await db.execute('DELETE FROM assignments WHERE id = $1', [id]);
            res.json({ message: 'Assignment deleted' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};
