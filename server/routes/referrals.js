module.exports = function ({ app, db, authMiddleware }) {

    // Helper: Generate a unique 8-char referral code
    function generateReferralCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
        return code;
    }

    // GET: Get my referral info (code + progress)
    app.get('/api/referrals/me', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne('SELECT referral_code FROM users WHERE id = $1', [req.user.id]);

            // Auto-generate referral code if missing
            let code = user.referral_code;
            if (!code) {
                code = generateReferralCode();
                await db.execute('UPDATE users SET referral_code = $1 WHERE id = $2', [code, req.user.id]);
            }

            // Get all referrals by this user
            const referrals = await db.query(
                `SELECT r.*, u.username FROM referrals r 
                 JOIN users u ON u.id = r.referred_id 
                 WHERE r.referrer_id = $1 ORDER BY r.created_at DESC`,
                [req.user.id]
            );

            const qualifiedCount = referrals.filter(r => r.qualified).length;

            res.json({
                referralCode: code,
                referrals: referrals.map(r => ({
                    username: r.username,
                    hasDeck: r.has_deck,
                    sessionCount: r.session_count,
                    qualified: r.qualified,
                    createdAt: r.created_at
                })),
                qualifiedCount,
                targetCount: 5,
                rewardEarned: qualifiedCount >= 5
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // POST: Apply a referral code during/after signup
    app.post('/api/referrals/apply', authMiddleware, async (req, res) => {
        const { code } = req.body;
        if (!code) return res.status(400).json({ error: 'Referral code required' });

        try {
            // Check if user already has a referrer
            const me = await db.queryOne('SELECT referred_by FROM users WHERE id = $1', [req.user.id]);
            if (me.referred_by) return res.status(400).json({ error: 'You already used a referral code' });

            // Find the referrer
            const referrer = await db.queryOne('SELECT id FROM users WHERE referral_code = $1', [code.toUpperCase()]);
            if (!referrer) return res.status(404).json({ error: 'Invalid referral code' });
            if (referrer.id === req.user.id) return res.status(400).json({ error: 'Cannot use your own code' });

            // Link the referral
            await db.execute('UPDATE users SET referred_by = $1 WHERE id = $2', [referrer.id, req.user.id]);
            await db.execute(
                'INSERT INTO referrals (referrer_id, referred_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [referrer.id, req.user.id]
            );

            res.json({ message: 'Referral code applied!' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Internal: Update referral qualification (call after deck creation or study session)
    app.post('/api/referrals/check-qualification', authMiddleware, async (req, res) => {
        try {
            const userId = req.user.id;

            // Find if this user was referred by someone
            const referral = await db.queryOne(
                'SELECT * FROM referrals WHERE referred_id = $1', [userId]
            );
            if (!referral) return res.json({ qualified: false, message: 'No referral found' });

            // Check deck count
            const deckCount = await db.queryOne('SELECT COUNT(*) as count FROM decks WHERE user_id = $1', [userId]);
            const hasDeck = parseInt(deckCount.count) >= 1;

            // Check session count
            const sessionCount = await db.queryOne(
                `SELECT COUNT(*) as count FROM study_sessions ss 
                 JOIN decks d ON d.id = ss.deck_id 
                 WHERE d.user_id = $1`, [userId]
            );
            const sessions = parseInt(sessionCount.count);
            const qualified = hasDeck && sessions >= 10;

            // Update referral record
            await db.execute(
                'UPDATE referrals SET has_deck = $1, session_count = $2, qualified = $3 WHERE referred_id = $4',
                [hasDeck, sessions, qualified, userId]
            );

            // Check if referrer now has 5+ qualified referrals → award lifetime
            if (qualified) {
                const qualCount = await db.queryOne(
                    'SELECT COUNT(*) as count FROM referrals WHERE referrer_id = $1 AND qualified = TRUE',
                    [referral.referrer_id]
                );
                if (parseInt(qualCount.count) >= 5) {
                    await db.execute(
                        "UPDATE users SET subscription_tier = 'lifetime' WHERE id = $1 AND subscription_tier != 'lifetime'",
                        [referral.referrer_id]
                    );
                }
            }

            res.json({ qualified, hasDeck, sessions });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
};
