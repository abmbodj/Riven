const express = require('express');

let premiumAccessPromise;
const loadPremiumAccess = () => {
    premiumAccessPromise ||= import('../../supabase/functions/_shared/premiumAccess.mjs');
    return premiumAccessPromise;
};

module.exports = function ({ app, db, authMiddleware }) {

    const REGEN_MINUTES = 15;
    const GLOBAL_MAX = 40;

    // Helper to calculate time-based heart regeneration
    async function getUpdatedHearts(userId) {
        const userRes = await db.query('SELECT subscription_tier, subscription_expires_at, hearts, last_heart_refill, role, simulate_free_tier FROM users WHERE id = $1', [userId]);
        if (!userRes.length) throw new Error('User not found');
        const user = userRes[0];
        const { isPremiumActive } = await loadPremiumAccess();

        if (isPremiumActive(user)) {
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
            console.error('GET /api/users/hearts/status error:', error);
            res.status(500).json({ error: 'Failed to fetch heart status' });
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
            console.error('GET /api/users/hearts/session error:', error);
            res.status(500).json({ error: 'Failed to fetch session hearts' });
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
            res.status(500).json({ error: 'Failed to decrement heart' });
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
            console.error('POST /api/users/hearts/refill error:', error);
            res.status(500).json({ error: 'Failed to refill hearts' });
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

            // Reset expired windows first (atomic)
            const now = new Date();
            await db.execute(
                `UPDATE users SET practice_refill_count = 0, practice_refill_reset_at = $1
                 WHERE id = $2 AND (practice_refill_reset_at IS NULL OR practice_refill_reset_at <= NOW())`,
                [new Date(now.getTime() + 60 * 60 * 1000), userId]
            );

            // Atomic: increment count only if under limit, and refill hearts in one query
            const newHearts = Math.min(GLOBAL_MAX, status.hearts + PRACTICE_REFILL_AMOUNT);
            const atomicResult = await db.queryOne(
                `UPDATE users
                 SET hearts = $1, practice_refill_count = practice_refill_count + 1
                 WHERE id = $2 AND practice_refill_count < $3
                 RETURNING practice_refill_count, practice_refill_reset_at`,
                [newHearts, userId, PRACTICE_MAX_PER_HOUR]
            );

            if (!atomicResult) {
                // Limit was reached — fetch reset time for error message
                const userRow = await db.queryOne(
                    'SELECT practice_refill_count, practice_refill_reset_at FROM users WHERE id = $1',
                    [userId]
                );
                const resetAt = userRow?.practice_refill_reset_at ? new Date(userRow.practice_refill_reset_at) : now;
                const minutesLeft = Math.ceil((resetAt.getTime() - now.getTime()) / 1000 / 60);
                return res.status(429).json({
                    error: `Practice refill limit reached. Try again in ${Math.max(1, minutesLeft)} minutes.`,
                    practiceUsed: userRow?.practice_refill_count || PRACTICE_MAX_PER_HOUR,
                    practiceMax: PRACTICE_MAX_PER_HOUR
                });
            }

            const updatedStatus = await getUpdatedHearts(userId);
            res.json({
                ...updatedStatus,
                heartsAdded: PRACTICE_REFILL_AMOUNT,
                practiceUsed: atomicResult.practice_refill_count,
                practiceMax: PRACTICE_MAX_PER_HOUR
            });
        } catch (error) {
            console.error('POST /api/users/hearts/practice-refill error:', error);
            res.status(500).json({ error: 'Failed to practice refill' });
        }
    });
};
