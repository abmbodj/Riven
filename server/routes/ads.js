const crypto = require('crypto');

module.exports = function ({ app, db, authMiddleware }) {

    const DAILY_AD_LIMIT = 10;
    const TOKEN_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes
    const VALID_FEATURES = ['ai_generation', 'hearts_refill', 'lms_sync', 'theme_trial'];

    // Per-feature cooldown limits
    const FEATURE_COOLDOWNS = {
        ai_generation: { max: 3, windowMs: 2 * 60 * 60 * 1000 },  // 3 per 2 hours
        hearts_refill: { max: 3, windowMs: 60 * 60 * 1000 },       // 3 per hour
        lms_sync: { max: 2, windowMs: 24 * 60 * 60 * 1000 },       // 2 per day
        theme_trial: { max: 1, windowMs: 24 * 60 * 60 * 1000 },    // 1 per day
    };

    // Helper: check if user is premium
    function isPremiumUser(user) {
        const isPrivileged = (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier;
        return isPrivileged || user.subscription_tier === 'supporter' || user.subscription_tier === 'lifetime';
    }

    // Helper: reset daily ad count if needed
    function getDailyWatches(user) {
        const now = new Date();
        let count = user.ad_watches_today || 0;
        const resetAt = user.ad_watches_reset_at ? new Date(user.ad_watches_reset_at) : null;

        // Reset if no reset time or if 24 hours have passed
        if (!resetAt || (now - resetAt > 24 * 60 * 60 * 1000)) {
            count = 0;
        }

        return count;
    }

    // Request permission to watch an ad for a specific feature
    app.post('/api/ads/request-reward', authMiddleware, async (req, res) => {
        try {
            const { feature, themeId } = req.body;

            if (!feature || !VALID_FEATURES.includes(feature)) {
                return res.status(400).json({ error: 'Invalid feature. Must be one of: ' + VALID_FEATURES.join(', ') });
            }

            // Get user data
            const user = await db.queryOne(
                'SELECT subscription_tier, role, simulate_free_tier, ad_watches_today, ad_watches_reset_at, theme_trial_id, theme_trial_expires_at FROM users WHERE id = $1',
                [req.user.id]
            );
            if (!user) return res.status(401).json({ error: 'User not found' });

            // Premium users don't watch ads
            if (isPremiumUser(user)) {
                return res.status(403).json({ error: 'Premium users do not need to watch ads.' });
            }

            // Check daily limit
            const dailyWatches = getDailyWatches(user);
            if (dailyWatches >= DAILY_AD_LIMIT) {
                return res.status(429).json({ error: 'Daily ad limit reached. Try again tomorrow.' });
            }

            // Check per-feature cooldown
            const cooldown = FEATURE_COOLDOWNS[feature];
            const windowStart = new Date(Date.now() - cooldown.windowMs);
            const featureWatches = await db.query(
                `SELECT COUNT(*) as count FROM ad_rewards
                 WHERE user_id = $1 AND feature = $2 AND status = 'completed' AND completed_at > $3`,
                [req.user.id, feature, windowStart]
            );
            if (parseInt(featureWatches[0].count) >= cooldown.max) {
                return res.status(429).json({ error: `You've used all ad rewards for this feature. Try again later.` });
            }

            // Feature-specific validation
            if (feature === 'theme_trial') {
                if (!themeId) {
                    return res.status(400).json({ error: 'themeId is required for theme trial.' });
                }
                // Check if user already has an active trial
                if (user.theme_trial_id && user.theme_trial_expires_at && new Date(user.theme_trial_expires_at) > new Date()) {
                    return res.status(400).json({ error: 'You already have an active theme trial. Wait for it to expire.' });
                }
            }

            // Generate a unique reward token
            const rewardToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MS);

            // Insert pending reward
            await db.execute(
                `INSERT INTO ad_rewards (user_id, feature, reward_token, status, granted_value, expires_at)
                 VALUES ($1, $2, $3, 'pending', $4, $5)`,
                [req.user.id, feature, rewardToken, feature === 'theme_trial' ? String(themeId) : null, expiresAt]
            );

            res.json({ rewardToken, expiresIn: Math.floor(TOKEN_EXPIRY_MS / 1000) });

        } catch (error) {
            console.error('Ad Request Error:', error);
            res.status(500).json({ error: 'Failed to request ad reward.' });
        }
    });

    // Claim a reward after watching an ad
    app.post('/api/ads/claim-reward', authMiddleware, async (req, res) => {
        try {
            const { rewardToken } = req.body;

            if (!rewardToken) {
                return res.status(400).json({ error: 'Reward token is required.' });
            }

            // Find the pending reward
            const reward = await db.queryOne(
                `SELECT * FROM ad_rewards
                 WHERE reward_token = $1 AND user_id = $2 AND status = 'pending' AND expires_at > NOW()`,
                [rewardToken, req.user.id]
            );

            if (!reward) {
                return res.status(400).json({ error: 'Invalid or expired reward token.' });
            }

            // Mark as completed
            await db.execute(
                `UPDATE ad_rewards SET status = 'completed', completed_at = NOW() WHERE id = $1`,
                [reward.id]
            );

            // Increment daily ad watch count (reset if needed)
            const user = await db.queryOne(
                'SELECT ad_watches_today, ad_watches_reset_at FROM users WHERE id = $1',
                [req.user.id]
            );
            const dailyWatches = getDailyWatches(user);
            const now = new Date();
            const resetAt = user.ad_watches_reset_at ? new Date(user.ad_watches_reset_at) : null;
            const needsReset = !resetAt || (now - resetAt > 24 * 60 * 60 * 1000);

            await db.execute(
                'UPDATE users SET ad_watches_today = $1, ad_watches_reset_at = $2 WHERE id = $3',
                [needsReset ? 1 : dailyWatches + 1, needsReset ? now : resetAt, req.user.id]
            );

            // Grant the reward based on feature
            let grantResult = {};

            switch (reward.feature) {
                case 'ai_generation': {
                    // Give back 1 AI generation
                    await db.execute(
                        'UPDATE users SET ai_generations_count = GREATEST(ai_generations_count - 1, 0) WHERE id = $1',
                        [req.user.id]
                    );
                    grantResult = { message: 'You earned 1 extra AI generation!', feature: 'ai_generation', value: 1 };
                    break;
                }

                case 'hearts_refill': {
                    // Add 5 hearts, capped at 40
                    const heartResult = await db.query(
                        'UPDATE users SET hearts = LEAST(hearts + 5, 40) WHERE id = $1 RETURNING hearts',
                        [req.user.id]
                    );
                    const newHearts = heartResult[0]?.hearts || 0;
                    grantResult = { message: 'You earned 5 hearts!', feature: 'hearts_refill', value: 5, hearts: newHearts };
                    break;
                }

                case 'lms_sync': {
                    // Allow one Canvas sync
                    grantResult = { message: 'You can now sync Canvas once!', feature: 'lms_sync', syncAllowed: true };
                    break;
                }

                case 'theme_trial': {
                    // Grant 24-hour theme trial
                    const themeId = parseInt(reward.granted_value);
                    const trialExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
                    await db.execute(
                        'UPDATE users SET theme_trial_id = $1, theme_trial_expires_at = $2 WHERE id = $3',
                        [themeId, trialExpires, req.user.id]
                    );
                    grantResult = {
                        message: 'Theme trial activated for 24 hours!',
                        feature: 'theme_trial',
                        themeId,
                        expiresAt: trialExpires.toISOString()
                    };
                    break;
                }
            }

            // Update granted_value for analytics
            if (reward.feature !== 'theme_trial') {
                await db.execute(
                    'UPDATE ad_rewards SET granted_value = $1 WHERE id = $2',
                    [reward.feature === 'ai_generation' ? '1' : reward.feature === 'hearts_refill' ? '5' : '1', reward.id]
                );
            }

            res.json({ success: true, ...grantResult });

        } catch (error) {
            console.error('Ad Claim Error:', error);
            res.status(500).json({ error: 'Failed to claim ad reward.' });
        }
    });

    // Get ad reward availability status for the current user
    app.get('/api/ads/status', authMiddleware, async (req, res) => {
        try {
            const user = await db.queryOne(
                `SELECT subscription_tier, role, simulate_free_tier, ad_watches_today, ad_watches_reset_at,
                        theme_trial_id, theme_trial_expires_at FROM users WHERE id = $1`,
                [req.user.id]
            );
            if (!user) return res.status(401).json({ error: 'User not found' });

            if (isPremiumUser(user)) {
                return res.json({ canWatchAds: false, reason: 'premium' });
            }

            const dailyWatches = getDailyWatches(user);
            const dailyRemaining = Math.max(0, DAILY_AD_LIMIT - dailyWatches);

            // Check per-feature availability
            const features = {};
            for (const feature of VALID_FEATURES) {
                const cooldown = FEATURE_COOLDOWNS[feature];
                const windowStart = new Date(Date.now() - cooldown.windowMs);
                const featureWatches = await db.query(
                    `SELECT COUNT(*) as count FROM ad_rewards
                     WHERE user_id = $1 AND feature = $2 AND status = 'completed' AND completed_at > $3`,
                    [req.user.id, feature, windowStart]
                );
                const used = parseInt(featureWatches[0].count);
                features[feature] = {
                    available: dailyRemaining > 0 && used < cooldown.max,
                    used,
                    max: cooldown.max,
                    remaining: Math.max(0, cooldown.max - used),
                };
            }

            // Add active theme trial info
            const hasActiveTrial = user.theme_trial_id && user.theme_trial_expires_at && new Date(user.theme_trial_expires_at) > new Date();
            if (hasActiveTrial) {
                features.theme_trial.activeTrialThemeId = user.theme_trial_id;
                features.theme_trial.trialExpiresAt = user.theme_trial_expires_at;
            }

            res.json({
                canWatchAds: true,
                dailyWatchesRemaining: dailyRemaining,
                dailyLimit: DAILY_AD_LIMIT,
                features,
            });

        } catch (error) {
            console.error('Ad Status Error:', error);
            res.status(500).json({ error: 'Failed to fetch ad status.' });
        }
    });

};
