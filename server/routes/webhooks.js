const express = require('express');
const Stripe = require('stripe');

module.exports = function ({ app, db }) {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // ── Direct Stripe Webhook ────────────────────────────────────
    app.post('/api/webhooks/stripe', async (req, res) => {
        const sig = req.headers['stripe-signature'];
        let event;

        try {
            // CRITICAL: Verify the body is a Buffer (raw). Sanitization must be bypassed in index.js.
            if (!Buffer.isBuffer(req.body)) {
                console.error('[Stripe Webhook] ❌ Error: Body is not a Buffer! Global middleware might be parsing it too early.');
                return res.status(400).send('Webhook Error: Request body must be raw.');
            }

            event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
        } catch (err) {
            console.error('[Stripe Webhook] ❌ Signature verification failed:', err.message);
            console.error('[Stripe Webhook] Hint: Check if STRIPE_WEBHOOK_SECRET in Render matches the secret for THIS SPECIFIC ENDPOINT in the Stripe Dashboard.');
            return res.status(400).send(`Webhook Error: ${err.message}`);
        }

        console.log(`[Stripe Webhook] 🔔 Received event: ${event.type}`);

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object;
                    const userId = session.client_reference_id;
                    const metadataTier = session.metadata?.tier; // 'lifetime' or 'supporter'

                    if (!userId) {
                        console.warn('[Stripe Webhook] ⚠️ No userId (client_reference_id) found in session:', session.id);
                        break;
                    }

                    // Map Price ID to Tier if metadata is missing (backup)
                    let tier = metadataTier || 'supporter';

                    console.info(`[Stripe Webhook] ✅ Fulfillment starting for user ${userId} -> ${tier}`);

                    // Save Stripe Customer ID and Subscription ID for bulletproof matching later
                    const stripeCustomerId = session.customer;
                    const stripeSubscriptionId = session.subscription;

                    const result = await db.execute(
                        `UPDATE users 
                         SET subscription_tier = $1, 
                             stripe_customer_id = $2, 
                             stripe_subscription_id = $3 
                         WHERE id = $4`,
                        [tier, stripeCustomerId, stripeSubscriptionId, parseInt(userId)]
                    );

                    if (result.rowCount === 0) {
                        console.error(`[Stripe Webhook] ❌ Failed to update user ${userId}: User not found in database.`);
                    } else {
                        console.info(`[Stripe Webhook] ✨ Subscription updated successfully for user ${userId}`);
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object;
                    const stripeCustomerId = subscription.customer;

                    console.info(`[Stripe Webhook] 🗑️ Subscription deleted for customer ${stripeCustomerId}. Reverting to free.`);

                    // Try matching by Stripe Customer ID first (most reliable)
                    let result = await db.execute('UPDATE users SET subscription_tier = $1 WHERE stripe_customer_id = $2', ['free', stripeCustomerId]);

                    // Fallback to email if we haven't saved the Stripe ID yet
                    if (result.rowCount === 0) {
                        const customer = await stripe.customers.retrieve(stripeCustomerId);
                        if (customer.email) {
                            console.info(`[Stripe Webhook] ⚠️ ID match failed, falling back to email ${customer.email}`);
                            await db.execute('UPDATE users SET subscription_tier = $1 WHERE email = $2', ['free', customer.email]);
                        }
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
