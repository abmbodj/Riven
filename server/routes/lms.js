const express = require('express');

module.exports = function ({ app, db, authMiddleware }) {

    // 1. Save Canvas credentials (user provides their own token)
    app.post('/api/lms/canvas/connect', authMiddleware, async (req, res) => {
        const { canvasUrl, apiToken } = req.body;

        if (!canvasUrl || !apiToken) {
            return res.status(400).json({ error: 'Canvas URL and API Token are required.' });
        }

        // Normalize URL: strip trailing slash
        const normalizedUrl = canvasUrl.replace(/\/+$/, '');

        // Validate by hitting Canvas API
        try {
            const testRes = await fetch(`${normalizedUrl}/api/v1/users/self`, {
                headers: { 'Authorization': `Bearer ${apiToken}` }
            });
            if (!testRes.ok) {
                return res.status(400).json({ error: 'Invalid Canvas URL or API Token. Check your credentials.' });
            }
        } catch (fetchErr) {
            return res.status(400).json({ error: 'Could not reach Canvas. Check the URL.' });
        }

        try {
            await db.execute(
                'UPDATE users SET canvas_api_url = $1, canvas_api_token = $2 WHERE id = $3',
                [normalizedUrl, apiToken, req.user.id]
            );
            res.json({ message: 'Canvas connected successfully.' });
        } catch (error) {
            console.error('Canvas Connect Error:', error);
            res.status(500).json({ error: 'Failed to save Canvas credentials.' });
        }
    });

    // 2. Disconnect Canvas
    app.post('/api/lms/canvas/disconnect', authMiddleware, async (req, res) => {
        try {
            await db.execute(
                'UPDATE users SET canvas_api_url = NULL, canvas_api_token = NULL WHERE id = $1',
                [req.user.id]
            );
            res.json({ message: 'Canvas disconnected.' });
        } catch (error) {
            console.error('Canvas Disconnect Error:', error);
            res.status(500).json({ error: 'Failed to disconnect Canvas.' });
        }
    });

    // 3. Sync Canvas courses & assignments (with old course filtering)
    app.post('/api/lms/sync', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne(
                'SELECT canvas_api_url, canvas_api_token FROM users WHERE id = $1',
                [req.user.id]
            );

            if (!user?.canvas_api_url || !user?.canvas_api_token) {
                return res.status(400).json({ error: 'Canvas is not connected. Add your Canvas URL and token first.' });
            }

            const { canvas_api_url, canvas_api_token } = user;
            const headers = { 'Authorization': `Bearer ${canvas_api_token}`, 'Accept': 'application/json' };

            // Fetch active + completed courses
            let allCourses = [];
            try {
                const activeRes = await fetch(`${canvas_api_url}/api/v1/courses?enrollment_state=active&per_page=100`, { headers });
                if (activeRes.ok) {
                    const data = await activeRes.json();
                    allCourses.push(...data.map(c => ({ ...c, _isActive: true })));
                }

                const completedRes = await fetch(`${canvas_api_url}/api/v1/courses?enrollment_state=completed&per_page=100`, { headers });
                if (completedRes.ok) {
                    const data = await completedRes.json();
                    allCourses.push(...data.map(c => ({ ...c, _isActive: false })));
                }
            } catch (fetchErr) {
                return res.status(502).json({ error: 'Failed to reach Canvas API. Check your credentials.' });
            }

            if (allCourses.length === 0) {
                return res.json({ message: 'No courses found on Canvas.', classesAdded: 0, assignmentsAdded: 0 });
            }

            let syncedClassesCount = 0;
            let syncedAssignmentsCount = 0;

            for (const course of allCourses) {
                const canvasCourseId = String(course.id);
                const courseName = course.name || course.course_code || 'Untitled Course';
                const isArchived = !course._isActive;

                // Find or create the class
                let mappedClass = await db.queryOne(
                    'SELECT * FROM classes WHERE user_id = $1 AND (canvas_course_id = $2 OR name = $3)',
                    [req.user.id, canvasCourseId, courseName]
                );

                if (!mappedClass) {
                    mappedClass = await db.queryOne(
                        `INSERT INTO classes (user_id, name, canvas_course_id, color, is_archived) 
                         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                        [req.user.id, courseName, canvasCourseId, '#4f46e5', isArchived]
                    );
                    syncedClassesCount++;
                } else {
                    await db.execute(
                        'UPDATE classes SET canvas_course_id = $1, is_archived = $2 WHERE id = $3',
                        [canvasCourseId, isArchived, mappedClass.id]
                    );
                }

                // Skip assignment sync for archived/past courses
                if (isArchived) continue;

                // Fetch assignments for this course
                try {
                    const assignRes = await fetch(
                        `${canvas_api_url}/api/v1/courses/${course.id}/assignments?per_page=100`,
                        { headers }
                    );

                    if (assignRes.ok) {
                        const assignments = await assignRes.json();

                        for (const a of assignments) {
                            if (!a.due_at) continue;

                            const canvasAssignId = String(a.id);
                            const existingAssig = await db.queryOne(
                                'SELECT id FROM assignments WHERE user_id = $1 AND canvas_assignment_id = $2',
                                [req.user.id, canvasAssignId]
                            );

                            if (!existingAssig) {
                                await db.execute(
                                    `INSERT INTO assignments (user_id, class_id, title, description, due_date, status, canvas_assignment_id)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                    [
                                        req.user.id,
                                        mappedClass.id,
                                        a.name || 'Untitled Assignment',
                                        a.description ? a.description.replace(/<[^>]*>?/gm, '') : '',
                                        new Date(a.due_at).toISOString(),
                                        'Todo',
                                        canvasAssignId
                                    ]
                                );
                                syncedAssignmentsCount++;
                            }
                        }
                    }
                } catch (assignFetchErr) {
                    console.error(`Failed to fetch assignments for course ${course.id}:`, assignFetchErr.message);
                }
            }

            res.json({
                message: 'Canvas sync complete!',
                classesAdded: syncedClassesCount,
                assignmentsAdded: syncedAssignmentsCount
            });

        } catch (error) {
            console.error('Canvas Sync Error:', error.message);
            res.status(500).json({ error: 'Sync failed. Please try again.' });
        }
    });

    // 4. Canvas connection status
    app.get('/api/lms/settings', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne(
                'SELECT canvas_api_url, canvas_api_token FROM users WHERE id = $1',
                [req.user.id]
            );
            res.json({
                isConnected: !!(user?.canvas_api_url && user?.canvas_api_token),
                canvasUrl: user?.canvas_api_url || ''
            });
        } catch (error) {
            console.error('LMS Settings Error:', error);
            res.status(500).json({ error: 'Failed to check Canvas status.' });
        }
    });
};
