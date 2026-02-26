const express = require('express');

module.exports = function ({ app, db, authMiddleware }) {

    // 1. Save Canvas credentials (now just an iCal link)
    app.post('/api/lms/canvas/connect', authMiddleware, async (req, res) => {
        const { icalUrl } = req.body;

        if (!icalUrl || typeof icalUrl !== 'string') {
            return res.status(400).json({ error: 'Canvas Calendar Link is required.' });
        }

        // Validate it looks like a Canvas iCal URL
        if (!icalUrl.includes('.instructure.com/feeds/calendars/')) {
            return res.status(400).json({ error: 'Invalid link. Be sure it comes from your Canvas Calendar Feed.' });
        }

        try {
            const ical = require('node-ical');
            const data = await ical.async.fromURL(icalUrl);

            // If data parses correctly, we will save the URL
            if (!data) {
                return res.status(400).json({ error: 'Failed to parse calendar feed. Try again.' });
            }
        } catch (fetchErr) {
            return res.status(400).json({ error: 'Could not reach Canvas Calendar Feed. Check the link.' });
        }

        try {
            await db.execute(
                'UPDATE users SET canvas_ical_url = $1, canvas_api_url = NULL, canvas_api_token = NULL WHERE id = $2',
                [icalUrl, req.user.id]
            );
            res.json({ message: 'Canvas connected successfully.' });
        } catch (error) {
            console.error('Canvas Connect Error:', error);
            res.status(500).json({ error: 'Failed to save Canvas calendar link.' });
        }
    });

    // 2. Disconnect Canvas
    app.post('/api/lms/canvas/disconnect', authMiddleware, async (req, res) => {
        try {
            await db.execute(
                'UPDATE users SET canvas_ical_url = NULL WHERE id = $1',
                [req.user.id]
            );
            res.json({ message: 'Canvas disconnected.' });
        } catch (error) {
            console.error('Canvas Disconnect Error:', error);
            res.status(500).json({ error: 'Failed to disconnect Canvas.' });
        }
    });

    // 3. Sync Canvas courses & assignments via iCal
    app.post('/api/lms/sync', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne(
                'SELECT canvas_ical_url FROM users WHERE id = $1',
                [req.user.id]
            );

            if (!user?.canvas_ical_url) {
                return res.status(400).json({ error: 'Canvas is not connected. Add your Canvas Calendar Link first.' });
            }

            const ical = require('node-ical');
            let events;
            try {
                events = await ical.async.fromURL(user.canvas_ical_url);
            } catch (fetchErr) {
                return res.status(502).json({ error: 'Failed to reach Canvas Calendar. Check your link.' });
            }

            let syncedClassesCount = 0;
            let syncedAssignmentsCount = 0;

            // Simple cache for classes created during this sync
            const mappedClasses = {};

            for (const k in events) {
                const ev = events[k];
                if (ev.type !== 'VEVENT') continue;

                // Canvas usually formats summary as "Assignment Name [Course Name]"
                const summary = ev.summary || 'Untitled Event';
                const description = ev.description || '';
                const uid = ev.uid; // Unique ID from Canvas
                const due_date = ev.end || ev.start; // iCal usually uses end/start for due dates

                if (!due_date) continue;

                // Try to extract course name from summary "Assignment [Course]" -> "Course"
                let courseName = 'Canvas Activities';
                const courseMatch = summary.match(/\[(.*?)\]$/);
                let assignmentTitle = summary;

                if (courseMatch && courseMatch[1]) {
                    courseName = courseMatch[1].trim();
                    assignmentTitle = summary.replace(/\[.*?\]$/, '').trim();
                }

                // Get or create class
                let classId;
                if (mappedClasses[courseName]) {
                    classId = mappedClasses[courseName];
                } else {
                    let existingClass = await db.queryOne(
                        'SELECT id FROM classes WHERE user_id = $1 AND name = $2',
                        [req.user.id, courseName]
                    );

                    if (!existingClass) {
                        const newClass = await db.queryOne(
                            `INSERT INTO classes (user_id, name, color) 
                             VALUES ($1, $2, $3) RETURNING id`,
                            [req.user.id, courseName, '#4f46e5']
                        );
                        classId = newClass.id;
                        syncedClassesCount++;
                    } else {
                        classId = existingClass.id;
                    }
                    mappedClasses[courseName] = classId;
                }

                // Get or create assignment
                const existingAssig = await db.queryOne(
                    'SELECT id FROM assignments WHERE user_id = $1 AND canvas_assignment_id = $2',
                    [req.user.id, uid]
                );

                if (!existingAssig) {
                    await db.execute(
                        `INSERT INTO assignments (user_id, class_id, title, description, due_date, status, canvas_assignment_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            req.user.id,
                            classId,
                            assignmentTitle,
                            description,
                            new Date(due_date).toISOString(),
                            'Todo',
                            uid
                        ]
                    );
                    syncedAssignmentsCount++;
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
                'SELECT canvas_ical_url FROM users WHERE id = $1',
                [req.user.id]
            );
            res.json({
                isConnected: !!user?.canvas_ical_url,
                canvasUrl: user?.canvas_ical_url ? 'Canvas Feed Active' : ''
            });
        } catch (error) {
            console.error('LMS Settings Error:', error);
            res.status(500).json({ error: 'Failed to check Canvas status.' });
        }
    });
};
