const { canvasConnectSchema } = require('../schemas/lms');
const { handleValidationErrors } = require('../utils/validate');
const { assertSafePublicUrl } = require('../utils/ssrfGuard');

module.exports = function ({ app, db, authMiddleware }) {

    // 1. Save Canvas credentials (now just an iCal link)
    app.post('/api/lms/canvas/connect', authMiddleware, canvasConnectSchema, handleValidationErrors, async (req, res) => {
        const { icalUrl } = req.body;

        try {
            // RIV-002: block SSRF to internal/metadata addresses before fetching.
            await assertSafePublicUrl(icalUrl);
        } catch (ssrfErr) {
            return res.status(400).json({ error: 'Invalid Canvas Calendar link.' });
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
                `UPDATE users
                 SET canvas_ical_url = $1,
                     canvas_api_url = NULL,
                     canvas_api_token = NULL,
                     canvas_auto_sync_enabled = TRUE,
                     last_canvas_auto_sync_error = NULL
                 WHERE id = $2`,
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
                `UPDATE users
                 SET canvas_ical_url = NULL,
                     canvas_auto_sync_enabled = FALSE,
                     last_canvas_sync_at = NULL,
                     last_canvas_auto_sync_attempt_at = NULL,
                     last_canvas_auto_sync_error = NULL
                 WHERE id = $1`,
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
                'SELECT canvas_ical_url, subscription_tier, role, simulate_free_tier, lms_sync_count, lms_sync_reset_at FROM users WHERE id = $1',
                [req.user.id]
            );

            if (!user?.canvas_ical_url) {
                return res.status(400).json({ error: 'Canvas is not connected. Add your Canvas Calendar Link first.' });
            }

            // Premium gate: free users get 1 free sync per day, then need ad or upgrade
            const isPrivileged = (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier;
            const isPremium = isPrivileged || user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime';

            if (!isPremium) {
                const now = new Date();
                let syncCount = user.lms_sync_count || 0;
                const resetAt = user.lms_sync_reset_at ? new Date(user.lms_sync_reset_at) : null;

                // Reset daily counter
                if (!resetAt || (now - resetAt > 24 * 60 * 60 * 1000)) {
                    syncCount = 0;
                    await db.execute('UPDATE users SET lms_sync_count = 0, lms_sync_reset_at = $1 WHERE id = $2', [now, req.user.id]);
                }

                // Check if ad-based sync was granted (from req body flag)
                const adGranted = req.body?.adGranted === true;

                if (syncCount >= 1 && !adGranted) {
                    return res.status(429).json({
                        error: 'Free sync limit reached for today. Watch an ad or upgrade for more syncs.',
                        canWatchAd: true
                    });
                }

                // Increment sync count
                await db.execute('UPDATE users SET lms_sync_count = lms_sync_count + 1 WHERE id = $1', [req.user.id]);
            }

            const ical = require('node-ical');
            let events;
            try {
                // RIV-002: re-validate the stored URL on each sync (DNS may have changed).
                await assertSafePublicUrl(user.canvas_ical_url);
                events = await ical.async.fromURL(user.canvas_ical_url);
            } catch (fetchErr) {
                return res.status(502).json({ error: 'Failed to reach Canvas Calendar. Check your link.' });
            }

            let syncedClassesCount = 0;
            let syncedAssignmentsCount = 0;

            // Batch-load existing classes and assignments to avoid N+1 queries
            const existingClasses = await db.query(
                'SELECT id, name FROM classes WHERE user_id = $1 AND COALESCE(is_archived, FALSE) = FALSE', [req.user.id]
            );
            const classMap = {};
            for (const c of existingClasses) classMap[c.name] = c.id;

            const existingAssignments = await db.query(
                'SELECT canvas_assignment_id FROM assignments WHERE user_id = $1 AND canvas_assignment_id IS NOT NULL',
                [req.user.id]
            );
            const assignmentUids = new Set(existingAssignments.map(a => a.canvas_assignment_id));

            for (const k in events) {
                const ev = events[k];
                if (ev.type !== 'VEVENT') continue;

                const summary = ev.summary || 'Untitled Event';
                const description = ev.description || '';
                const uid = ev.uid;
                const due_date = ev.end || ev.start;

                if (!due_date) continue;

                let courseName = 'Canvas Activities';
                const courseMatch = summary.match(/\[(.*?)\]$/);
                let assignmentTitle = summary;

                if (courseMatch && courseMatch[1]) {
                    courseName = courseMatch[1].trim();
                    assignmentTitle = summary.replace(/\[.*?\]$/, '').trim();
                }

                // Get or create class (using pre-loaded map)
                let classId = classMap[courseName];
                if (!classId) {
                    const newClass = await db.queryOne(
                        `INSERT INTO classes (user_id, name, color)
                         VALUES ($1, $2, $3) RETURNING id`,
                        [req.user.id, courseName, '#4f46e5']
                    );
                    classId = newClass.id;
                    classMap[courseName] = classId;
                    syncedClassesCount++;
                }

                // Skip if assignment already exists (using pre-loaded set)
                if (assignmentUids.has(uid)) continue;

                // Auto-archive assignments that are more than 7 days past due
                // so they don't flood the Past Due section on the dashboard.
                // Recently-past-due items (≤7 days) still appear as 'Todo'.
                const now = new Date();
                const parsedDue = new Date(due_date);
                const daysPastDue = (now - parsedDue) / (1000 * 60 * 60 * 24);
                const assignmentStatus = daysPastDue > 7 ? 'Archived' : 'Todo';

                try {
                    await db.execute(
                        `INSERT INTO assignments (user_id, class_id, title, description, due_date, status, canvas_assignment_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                        [
                            req.user.id,
                            classId,
                            assignmentTitle,
                            description,
                            parsedDue.toISOString(),
                            assignmentStatus,
                            uid
                        ]
                    );
                    assignmentUids.add(uid);
                    syncedAssignmentsCount++;
                } catch (insertError) {
                    if (insertError?.code === '23505') {
                        assignmentUids.add(uid);
                        continue;
                    }

                    throw insertError;
                }
            }

            await db.execute(
                `UPDATE users
                 SET last_canvas_sync_at = $1,
                     last_canvas_auto_sync_error = NULL
                 WHERE id = $2`,
                [new Date().toISOString(), req.user.id]
            );

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

};
