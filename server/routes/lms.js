const express = require('express');

module.exports = function ({ app, db, authMiddleware }) {

    // 1. Get Edlink Authorization URL
    app.get('/api/lms/edlink/connect', authMiddleware, (req, res) => {
        try {
            const EDLINK_CLIENT_ID = process.env.EDLINK_CLIENT_ID;
            // The callback must exactly match the Edlink dashboard configuration
            const REDIRECT_URI = `${req.protocol}://${req.get('host')}/api/lms/edlink/callback`;

            const authUrl = `https://ed.link/api/authentication?client_id=${EDLINK_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code`;

            res.json({ url: authUrl });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // 2. Edlink OAuth Callback Handler
    // The user's browser returns here after approving Riven inside the Edlink popup.
    // Because they are coming from the browser, their session cookie is attached, allowing authMiddleware to run.
    app.get('/api/lms/edlink/callback', authMiddleware, async (req, res) => {
        const { code } = req.query;
        if (!code) {
            return res.status(400).send('Authorization code missing.');
        }

        try {
            const REDIRECT_URI = `${req.protocol}://${req.get('host')}/api/lms/edlink/callback`;
            const EDLINK_CLIENT_ID = process.env.EDLINK_CLIENT_ID;
            const EDLINK_SECRET = process.env.EDLINK_SECRET;

            // Exchange the code for an access token
            const tokenRes = await fetch('https://ed.link/api/authentication/token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: EDLINK_CLIENT_ID,
                    client_secret: EDLINK_SECRET,
                    code: code,
                    grant_type: 'authorization_code',
                    redirect_uri: REDIRECT_URI
                })
            });

            if (!tokenRes.ok) {
                const errData = await tokenRes.text();
                throw new Error(`Edlink Token Error: ${errData}`);
            }

            const tokenData = await tokenRes.json();
            const accessToken = tokenData.access_token;

            // Save the token to the user's profile
            await db.execute(
                'UPDATE users SET edlink_access_token = $1 WHERE id = $2',
                [accessToken, req.user.id]
            );

            // Redirect back to the frontend dashboard/settings
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
            res.redirect(`${frontendUrl}/settings?lms=success`);

        } catch (error) {
            console.error('Edlink Callback Error:', error.message);
            res.status(500).send(`Failed to connect to Edlink: ${error.message}`);
        }
    });

    // 3. Sync Edlink Data via the Graph API
    app.post('/api/lms/sync', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT edlink_access_token FROM users WHERE id = $1', [req.user.id]);

            if (!user.edlink_access_token) {
                return res.status(400).json({ error: 'School account not connected via Edlink.' });
            }

            const headers = { 'Authorization': `Bearer ${user.edlink_access_token}`, 'Accept': 'application/json' };

            // 1. Fetch Active Courses from the Edlink Graph API
            const coursesRes = await fetch('https://ed.link/api/v2/graph/courses', { headers });
            if (!coursesRes.ok) {
                throw new Error(`Failed to fetch Edlink courses: ${coursesRes.statusText}`);
            }
            const coursesData = await coursesRes.json();
            const courses = coursesData.$data || [];

            let syncedClassesCount = 0;
            let syncedAssignmentsCount = 0;

            for (const course of courses) {
                // Cross-reference or Map Class
                let mappedClass = await db.queryOne(
                    'SELECT * FROM classes WHERE user_id = $1 AND (edlink_course_id = $2 OR name = $3)',
                    [req.user.id, course.id, course.name]
                );

                if (!mappedClass) {
                    // Create if not exists
                    mappedClass = await db.queryOne(
                        `INSERT INTO classes (user_id, name, edlink_course_id, color) 
                         VALUES ($1, $2, $3, $4) RETURNING *`,
                        [req.user.id, course.name, course.id, '#4f46e5'] // Default Indigo
                    );
                    syncedClassesCount++;
                } else if (!mappedClass.edlink_course_id) {
                    // Update existing matching class to link to edlink
                    await db.execute('UPDATE classes SET edlink_course_id = $1 WHERE id = $2', [course.id, mappedClass.id]);
                }

                // 2. Fetch Assignments for this Course
                const assignmentsRes = await fetch(`https://ed.link/api/v2/graph/courses/${course.id}/assignments`, { headers });

                if (assignmentsRes.ok) {
                    const assignData = await assignmentsRes.json();
                    const edlinkAssignments = assignData.$data || [];

                    for (const ea of edlinkAssignments) {
                        // Skip assignments without due dates
                        if (!ea.due_date) continue;

                        // Check if we already synced this assignment
                        const existingAssig = await db.queryOne(
                            'SELECT id FROM assignments WHERE user_id = $1 AND edlink_assignment_id = $2',
                            [req.user.id, ea.id]
                        );

                        if (!existingAssig) {
                            await db.execute(
                                `INSERT INTO assignments (user_id, class_id, title, description, due_date, status, edlink_assignment_id)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                [
                                    req.user.id,
                                    mappedClass.id,
                                    ea.title,
                                    ea.description ? ea.description.replace(/<[^>]*>?/gm, '') : '', // Strip HTML
                                    new Date(ea.due_date).toISOString(),
                                    'Todo',
                                    ea.id
                                ]
                            );
                            syncedAssignmentsCount++;
                        }
                    }
                }
            }

            res.json({
                message: 'Edlink Sync complete',
                classesAdded: syncedClassesCount,
                assignmentsAdded: syncedAssignmentsCount
            });

        } catch (error) {
            console.error('Edlink Sync Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    // 4. Edlink Settings Status
    app.get('/api/lms/settings', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT edlink_access_token FROM users WHERE id = $1', [req.user.id]);
            res.json({
                isConnected: !!user.edlink_access_token
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};

