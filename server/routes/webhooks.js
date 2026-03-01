const express = require('express');

module.exports = function ({ app, db }) {

    app.post('/api/webhooks/revenuecat', express.json(), async (req, res) => {
        try {
            // RevenueCat Webhook verification
            const authHeader = req.headers.authorization;
            if (process.env.REVENUECAT_WEBHOOK_SECRET && authHeader !== `Bearer ${process.env.REVENUECAT_WEBHOOK_SECRET}`) {
                return res.status(401).send('Unauthorized');
            }

            const { event } = req.body;
            if (!event || !event.app_user_id) {
                return res.status(400).send('Invalid event format');
            }

            // We intend to set app_user_id = user.id in the frontend RC SDK
            const userId = parseInt(event.app_user_id);
            if (isNaN(userId)) {
                // If it's an anonymous user that hasn't logged in but somehow triggered a purchase,
                // we'll just ignore for now or wait until they sign in (aliasing handled by RC)
                return res.status(400).send('Non-integer user ID');
            }

            const eventType = event.type;
            // RevenueCat event types: INITIAL_PURCHASE, RENEWAL, CANCELLATION, EXPIRATION, PRODUCT_CHANGE, etc.

            const productId = event.product_id || '';
            let newTier = null;

            if (['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE'].includes(eventType)) {
                // We will setup our store product IDs to include the tier names
                if (productId.includes('lifetime')) {
                    newTier = 'lifetime';
                } else if (productId.includes('supporter')) {
                    newTier = 'supporter';
                }
            } else if (eventType === 'EXPIRATION') {
                // Expiration means access should be revoked immediately
                newTier = 'free';
            } else if (eventType === 'CANCELLATION') {
                // Cancellation just means auto-renew is off, they retain access until the expiration date.
                // RevenueCat will send an EXPIRATION event later. No DB update needed right now.
                return res.status(200).send('Cancellation logged');
            }

            if (newTier) {
                await db.execute('UPDATE users SET subscription_tier = $1 WHERE id = $2', [newTier, userId]);
            }

            res.status(200).send('Webhook handled successfully');

        } catch (error) {
            console.error('RevenueCat Webhook Error:', error);
            res.status(500).send('Internal Server Error');
        }
    });

};
