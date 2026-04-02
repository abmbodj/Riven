const EXAM_PATTERN = /\b(test|quiz|exam|midterm|final|assessment)\b/i;

module.exports = function ({ app, db, authMiddleware }) {

    // POST /api/calendar/sources/:id/sync
    // Fetch an external iCal URL, parse events, upsert into assignments
    app.post('/api/calendar/sources/:id/sync', authMiddleware, async (req, res) => {
        const { id } = req.params;

        try {
            // Load the source (scoped to this user via user_id check)
            const source = await db.queryOne(
                'SELECT * FROM calendar_sources WHERE id = $1 AND user_id = $2',
                [id, req.user.id]
            );

            if (!source) {
                return res.status(404).json({ error: 'Calendar source not found.' });
            }

            if (!source.url) {
                return res.status(400).json({ error: 'No URL configured for this calendar source.' });
            }

            const ical = require('node-ical');
            let events;
            try {
                events = await ical.async.fromURL(source.url);
            } catch (fetchErr) {
                return res.status(502).json({ error: 'Could not reach the calendar URL. Check the link and try again.' });
            }

            // Load existing events from this source to avoid re-inserting
            const existing = await db.query(
                'SELECT canvas_assignment_id FROM assignments WHERE user_id = $1 AND calendar_source_id = $2 AND canvas_assignment_id IS NOT NULL',
                [req.user.id, id]
            );
            const existingUids = new Set(existing.map(a => a.canvas_assignment_id));

            let eventsAdded = 0;
            const now = new Date();

            for (const k in events) {
                const ev = events[k];
                if (ev.type !== 'VEVENT') continue;

                const uid = ev.uid;
                if (!uid || existingUids.has(uid)) continue;

                const summary = ev.summary || 'Untitled Event';
                const description = ev.description || '';
                const due_date = ev.end || ev.start;
                if (!due_date) continue;

                const parsedDue = new Date(due_date);
                if (Number.isNaN(parsedDue.getTime())) continue;

                // Auto-archive items >7 days past due
                const daysPastDue = (now - parsedDue) / (1000 * 60 * 60 * 24);
                const status = daysPastDue > 7 ? 'Archived' : 'Todo';

                // Detect exam/quiz type from title
                const assignmentType = EXAM_PATTERN.test(summary) ? 'exam' : 'assignment';

                try {
                    await db.execute(
                        `INSERT INTO assignments
                             (user_id, title, description, due_date, status, assignment_type, calendar_source_id, canvas_assignment_id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                        [
                            req.user.id,
                            summary,
                            description,
                            parsedDue.toISOString(),
                            status,
                            assignmentType,
                            id,
                            uid,
                        ]
                    );
                    existingUids.add(uid);
                    eventsAdded++;
                } catch (insertErr) {
                    // Unique constraint violation — already exists
                    if (insertErr?.code === '23505') continue;
                    throw insertErr;
                }
            }

            // Update last_synced_at
            await db.execute(
                'UPDATE calendar_sources SET last_synced_at = $1 WHERE id = $2',
                [now.toISOString(), id]
            );

            res.json({ message: 'Sync complete.', eventsAdded });
        } catch (error) {
            console.error('Calendar sync error:', error);
            res.status(500).json({ error: 'Sync failed. Please try again.' });
        }
    });
};
