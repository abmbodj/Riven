const express = require('express');

module.exports = function ({ app, db }) {

    app.post('/api/webhooks/revenuecat', express.json(), async (req, res) => {
        try {
            console.log(`[RevenueCat Webhook] Request received at ${new Date().toISOString()}`);

            // RevenueCat Webhook verification
            const authHeader = req.headers.authorization;
            const secret = process.env.REVENUECAT_WEBHOOK_SECRET;

            if (secret && authHeader !== `Bearer ${secret}`) {
                console.warn('[RevenueCat Webhook] 401 Unauthorized: Secret mismatch or missing');
                return res.status(401).send('Unauthorized');
            }

            const { event } = req.body;
            if (!event || !event.app_user_id) {
                console.warn('[RevenueCat Webhook] 400 Bad Request: Missing event or app_user_id', req.body);
                return res.status(400).send('Invalid event format');
            }

            const userId = parseInt(event.app_user_id);
            if (isNaN(userId)) {
                console.warn(`[RevenueCat Webhook] 400 Bad Request: Non-integer app_user_id (${event.app_user_id})`);
                return res.status(400).send('Non-integer user ID');
            }

            const eventType = event.type;
            const productId = (event.product_id || '').toLowerCase();
            console.log(`[RevenueCat Webhook] Received ${eventType} for user ${userId} (Product: ${productId})`);

            let newTier = null;

            // Matching logic: check for keywords in the product ID
            if (['INITIAL_PURCHASE', 'RENEWAL', 'PRODUCT_CHANGE', 'UNCANCELLATION'].includes(eventType)) {
                if (productId.includes('lifetime')) {
                    newTier = 'lifetime';
                } else if (productId.includes('supporter') || productId.includes('tester') || productId.includes('test') || productId.includes('hi')) {
                    newTier = 'supporter';
                }
            } else if (eventType === 'EXPIRATION') {
                newTier = 'free';
            } else if (eventType === 'CANCELLATION') {
                console.log(`[RevenueCat Webhook] User ${userId} canceled auto-renew (retains access until expiration)`);
                return res.status(200).send('Cancellation logged');
            }

            if (newTier) {
                console.log(`[RevenueCat Webhook] UPDATE SUCCESS: Moving user ${userId} -> ${newTier}`);
                const result = await db.execute('UPDATE users SET subscription_tier = $1 WHERE id = $2', [newTier, userId]);
                console.log(`[RevenueCat Webhook] Database updated. RowCount: ${result?.rowCount}`);
            } else {
                // Not necessarily an error, could be a test event or a product we don't handle tier changes for
                console.info(`[RevenueCat Webhook] No tier change required for event ${eventType} (Product: ${productId})`);
            }

            res.status(200).send('Webhook handled successfully');

        } catch (error) {
            console.error('[RevenueCat Webhook] CRITICAL ERROR:', error);
            res.status(500).send('Internal Server Error');
        }
    });

};
