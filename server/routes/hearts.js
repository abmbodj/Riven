const express = require('express');

module.exports = function ({ app, db, authMiddleware }) {

    const REGEN_MINUTES = 15;
    const GLOBAL_MAX = 40;

    // Helper to calculate time-based heart regeneration
    async function getUpdatedHearts(userId) {
        const userRes = await db.query('SELECT subscription_tier, hearts, last_heart_refill, role, simulate_free_tier FROM users WHERE id = $1', [userId]);
        if (!userRes.length) throw new Error('User not found');
        const user = userRes[0];

        const isPrivileged = (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier;
        if (isPrivileged || user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime') {
            return { hearts: 'Unlimited', max: 'Unlimited', isUnlimited: true };
        }

        let currentHearts = user.hearts;
        let lastRefill = user.last_heart_refill ? new Date(user.last_heart_refill) : new Date();

        // Initialize if -1 (first time usage after monetization update)
        if (currentHearts === -1) {
            currentHearts = GLOBAL_MAX;
            lastRefill = new Date();
            await db.execute('UPDATE users SET hearts = $1, last_heart_refill = $2 WHERE id = $3', [currentHearts, lastRefill, userId]);
        } else {
            const now = new Date();
            const elapsedMs = now.getTime() - lastRefill.getTime();
            const elapsedMinutes = Math.floor(elapsedMs / 1000 / 60);

            // If we are below max and time has passed for a refill
            if (elapsedMinutes >= REGEN_MINUTES && currentHearts < GLOBAL_MAX) {
                const heartsToAdd = Math.floor(elapsedMinutes / REGEN_MINUTES);
                currentHearts = Math.min(GLOBAL_MAX, currentHearts + heartsToAdd);

                // Advance the refill timer without losing remainder seconds
                lastRefill = new Date(lastRefill.getTime() + (heartsToAdd * REGEN_MINUTES * 60 * 1000));

                // If we reached max, reset the timer to prevent immediate refill on next drop
                if (currentHearts === GLOBAL_MAX) {
                    lastRefill = now;
                }

                await db.execute('UPDATE users SET hearts = $1, last_heart_refill = $2 WHERE id = $3', [currentHearts, lastRefill, userId]);
            }
        }

        return {
            hearts: currentHearts,
            max: GLOBAL_MAX,
            isUnlimited: false,
            nextRefill: currentHearts < GLOBAL_MAX ? new Date(lastRefill.getTime() + (REGEN_MINUTES * 60 * 1000)) : null
        };
    }

    // GET: Fetch current hearts
    app.get('/api/users/hearts/status', authMiddleware, async (req, res) => {
        try {
            const status = await getUpdatedHearts(req.user.id);
            res.json(status);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // GET: Fetch session hearts based on deck size (monetization.md formula)
    // hearts = clamp(round(deckSize * 0.25), min=10, max=40)
    app.get('/api/users/hearts/session/:deckId', authMiddleware, async (req, res) => {
        try {
            const status = await getUpdatedHearts(req.user.id);
            if (status.isUnlimited) return res.json(status);

            // Get deck card count
            const deckRes = await db.query('SELECT COUNT(*) as count FROM cards WHERE deck_id = $1', [req.params.deckId]);
            const deckSize = parseInt(deckRes[0]?.count || 0);
            const sessionMax = Math.max(10, Math.min(40, Math.round(deckSize * 0.25)));

            // Session hearts = min(sessionMax, current global hearts)
            res.json({
                ...status,
                sessionHearts: Math.min(sessionMax, status.hearts),
                sessionMax
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST: Decrement 1 heart (called when answering a flashcard wrong)
    app.post('/api/users/hearts/decrement', authMiddleware, async (req, res) => {
        try {
            const status = await getUpdatedHearts(req.user.id);
            if (status.isUnlimited) return res.json(status);

            if (status.hearts > 0) {
                const newHearts = status.hearts - 1;
                const now = new Date();

                // If we're dropping from MAX, start the regeneration timer NOW
                if (status.hearts === GLOBAL_MAX) {
                    await db.execute('UPDATE users SET hearts = $1, last_heart_refill = $2 WHERE id = $3', [newHearts, now, req.user.id]);
                } else {
                    await db.execute('UPDATE users SET hearts = $1 WHERE id = $2', [newHearts, req.user.id]);
                }

                const updatedStatus = await getUpdatedHearts(req.user.id);
                return res.json(updatedStatus);
            } else {
                return res.status(400).json({ error: 'Out of hearts' });
            }
        } catch (error) {
            console.error('Heart decrement error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // POST: Refill hearts (Admin-only — use /practice-refill for normal users)
    app.post('/api/users/hearts/refill', authMiddleware, async (req, res) => {
        try {
            // Admin-only guard: prevent free users from exploiting this endpoint
            const adminCheck = await db.query('SELECT role FROM users WHERE id = $1', [req.user.id]);
            const role = adminCheck[0]?.role;
            if (role !== 'admin' && role !== 'owner') {
                return res.status(403).json({ error: 'Admin access required. Use practice mode to earn hearts.' });
            }

            const { amount, targetUserId } = req.body;
            const userId = targetUserId ? parseInt(targetUserId) : req.user.id;

            const status = await getUpdatedHearts(userId);
            if (status.isUnlimited) return res.json(status);

            const heartsToAdd = amount ? Math.min(parseInt(amount), GLOBAL_MAX) : GLOBAL_MAX;
            const newHearts = Math.min(GLOBAL_MAX, status.hearts + heartsToAdd);

            await db.execute('UPDATE users SET hearts = $1 WHERE id = $2', [newHearts, userId]);
            const updatedStatus = await getUpdatedHearts(userId);
            res.json(updatedStatus);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST: Practice mode refill — rate-limited to 3 uses per hour, +5 hearts each
    // Persisted in DB to survive server restarts
    const PRACTICE_REFILL_AMOUNT = 5;
    const PRACTICE_MAX_PER_HOUR = 3;

    app.post('/api/users/hearts/practice-refill', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;
            const status = await getUpdatedHearts(userId);
            if (status.isUnlimited) return res.json({ ...status, practiceUsed: 0, practiceMax: PRACTICE_MAX_PER_HOUR });

            // Rate limit check (DB-persisted)
            const now = new Date();
            const userRow = await db.query(
                'SELECT practice_refill_count, practice_refill_reset_at FROM users WHERE id = $1',
                [userId]
            );
            let count = userRow[0]?.practice_refill_count || 0;
            let resetAt = userRow[0]?.practice_refill_reset_at ? new Date(userRow[0].practice_refill_reset_at) : null;

            // Reset window if expired or never set
            if (!resetAt || now >= resetAt) {
                count = 0;
                resetAt = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
                await db.execute(
                    'UPDATE users SET practice_refill_count = 0, practice_refill_reset_at = $1 WHERE id = $2',
                    [resetAt, userId]
                );
            }

            if (count >= PRACTICE_MAX_PER_HOUR) {
                const minutesLeft = Math.ceil((resetAt.getTime() - now.getTime()) / 1000 / 60);
                return res.status(429).json({
                    error: `Practice refill limit reached. Try again in ${minutesLeft} minutes.`,
                    practiceUsed: count,
                    practiceMax: PRACTICE_MAX_PER_HOUR
                });
            }

            // Refill hearts
            const newHearts = Math.min(GLOBAL_MAX, status.hearts + PRACTICE_REFILL_AMOUNT);
            await db.execute(
                'UPDATE users SET hearts = $1, practice_refill_count = practice_refill_count + 1 WHERE id = $2',
                [newHearts, userId]
            );

            const updatedStatus = await getUpdatedHearts(userId);
            res.json({
                ...updatedStatus,
                heartsAdded: PRACTICE_REFILL_AMOUNT,
                practiceUsed: count + 1,
                practiceMax: PRACTICE_MAX_PER_HOUR
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};
