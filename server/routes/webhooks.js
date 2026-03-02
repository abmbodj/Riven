const express = require('express');
const Stripe = require('stripe');

module.exports = function ({ app, db }) {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // ── Direct Stripe Webhook ────────────────────────────────────
    app.post('/api/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('[Stripe Webhook] Signature verification failed:', err.message);
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log(`[Stripe Webhook] Received event: ${event.type}`);

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object;
                    const userId = session.client_reference_id;
                    const metadataTier = session.metadata?.tier; // 'lifetime' or 'supporter'

                    if (!userId) {
                        console.warn('[Stripe Webhook] No userId found in session');
                        break;
                    }

                    // Map Price ID to Tier if metadata is missing
                    let tier = metadataTier || 'supporter';
                    // Double check line items if possible or use Price/Product ID patterns

                    console.info(`[Stripe Webhook] Fulfillment starting for user ${userId} -> ${tier}`);
                    await db.execute('UPDATE users SET subscription_tier = $1 WHERE id = $2', [tier, userId]);
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object;
                    // Find user by Stripe Customer ID (would require us to have saved it)
                    // Or find by email if we can
                    const customer = await stripe.customers.retrieve(subscription.customer);
                    if (customer.email) {
                        console.info(`[Stripe Webhook] Subscription deleted for ${customer.email}. Reverting to free.`);
                        await db.execute('UPDATE users SET subscription_tier = $1 WHERE email = $2', ['free', customer.email]);
                    }
                    break;
                }
            }
            res.json({ received: true });
        } catch (error) {
            console.error('[Stripe Webhook] Error processing event:', error);
            res.status(500).send('Internal Server Error');
        }
    });

    // ── Legacy RevenueCat Webhook (Graceful removal or keep as proxy) ──
    app.post('/api/webhooks/revenuecat', express.json(), async (req, res) => {
        // ... (Optional: Keep for a few days to handle any mid-flight RC payments, or just return 200)
        res.status(200).send('Legacy RevenueCat handler - transitioning to direct Stripe');
    });

};
