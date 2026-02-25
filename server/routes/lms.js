const express = require('express');

module.exports = function ({ app, db, authMiddleware }) {
    // Get Canvas Settings
    app.get('/api/lms/canvas/settings', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT canvas_url, canvas_token FROM users WHERE id = $1', [req.user.id]);
            res.json({
                canvas_url: user.canvas_url || '',
                has_token: !!user.canvas_token // don't send the token back to the client for security
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Update Canvas Settings
    app.put('/api/lms/canvas/settings', authMiddleware, async (req, res) => {
        const { canvas_url, canvas_token } = req.body;
        try {
            if (canvas_token) {
                // Formatting URL to strip trailing slashes just in case
                const cleanUrl = canvas_url ? canvas_url.replace(/\/$/, '') : '';
                await db.execute(
                    'UPDATE users SET canvas_url = $1, canvas_token = $2 WHERE id = $3',
                    [cleanUrl, canvas_token, req.user.id]
                );
            } else if (canvas_url !== undefined) {
                // Only updating URL (or clearing it if empty string is passed)
                const cleanUrl = canvas_url ? canvas_url.replace(/\/$/, '') : '';
                await db.execute(
                    'UPDATE users SET canvas_url = $1 WHERE id = $2',
                    [cleanUrl, req.user.id]
                );
            }
            res.json({ message: 'Canvas settings updated successfully' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Sync Canvas Data
    app.post('/api/lms/canvas/sync', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT canvas_url, canvas_token FROM users WHERE id = $1', [req.user.id]);

            if (!user.canvas_url || !user.canvas_token) {
                return res.status(400).json({ error: 'Canvas credentials not configured' });
            }

            const baseUrl = user.canvas_url;
            const headers = { 'Authorization': `Bearer ${user.canvas_token}`, 'Accept': 'application/json' };

            // 1. Fetch Active Courses
            // The canvas API usually paginates, for MVP we grab the first page (usually 10-50 items)
            const coursesRes = await fetch(`${baseUrl}/api/v1/courses?enrollment_state=active&per_page=100`, { headers });
            if (!coursesRes.ok) {
                throw new Error(`Failed to fetch Canvas courses: ${coursesRes.statusText}`);
            }
            const courses = await coursesRes.json();

            // Filter out restricted or invalid courses
            const validCourses = courses.filter(c => c.name && !c.access_restricted_by_date);

            let syncedClassesCount = 0;
            let syncedAssignmentsCount = 0;

            for (const course of validCourses) {
                // 2. Cross-reference or Map Class
                let mappedClass = await db.queryOne(
                    'SELECT * FROM classes WHERE user_id = $1 AND (canvas_id = $2 OR name = $3)',
                    [req.user.id, course.id.toString(), course.name]
                );

                if (!mappedClass) {
                    // Create if not exists
                    mappedClass = await db.queryOne(
                        `INSERT INTO classes (user_id, name, canvas_id, color) 
                         VALUES ($1, $2, $3, $4) RETURNING *`,
                        [req.user.id, course.name, course.id.toString(), '#e85a4f'] // Default Canvas-ish red
                    );
                    syncedClassesCount++;
                } else if (!mappedClass.canvas_id) {
                    // Update existing matching class to link to canvas
                    await db.execute('UPDATE classes SET canvas_id = $1 WHERE id = $2', [course.id.toString(), mappedClass.id]);
                }

                // 3. Fetch Assignments for Course
                const assignmentsRes = await fetch(`${baseUrl}/api/v1/courses/${course.id}/assignments?per_page=100`, { headers });

                if (assignmentsRes.ok) {
                    const canvasAssignments = await assignmentsRes.json();

                    for (const ca of canvasAssignments) {
                        // Skip assignments without due dates or deeply in the past (optional, but good for cleanliness)
                        if (!ca.due_at) continue;

                        // Check if we already synced this assignment
                        const existingAssig = await db.queryOne(
                            'SELECT id FROM assignments WHERE user_id = $1 AND canvas_id = $2',
                            [req.user.id, ca.id.toString()]
                        );

                        if (!existingAssig) {
                            await db.execute(
                                `INSERT INTO assignments (user_id, class_id, title, description, due_date, status, canvas_id)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                [
                                    req.user.id,
                                    mappedClass.id,
                                    ca.name,
                                    ca.description ? ca.description.replace(/<[^>]*>?/gm, '') : '', // strip basic html from canvas descriptions
                                    new Date(ca.due_at).toISOString(),
                                    'Todo',
                                    ca.id.toString()
                                ]
                            );
                            syncedAssignmentsCount++;
                        }
                    }
                }
            }

            res.json({
                message: 'Sync complete',
                classesAdded: syncedClassesCount,
                assignmentsAdded: syncedAssignmentsCount
            });

        } catch (error) {
            console.error('Canvas Sync Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
};
