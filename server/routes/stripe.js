const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

module.exports = function ({ db }) {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // ── Create Checkout Session ──────────────────────────────────
    router.post('/create-checkout-session', async (req, res) => {
        try {
            const { priceId, isSubscription } = req.body;
            const user = req.user;

            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            if (!priceId) {
                return res.status(400).json({ error: 'Missing priceId in request body' });
            }

            // Determine the base URL from the request origin (more robust than env var)
            let baseUrl = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
            // Remove trailing slash if it exists
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: isSubscription ? 'subscription' : 'payment',
                success_url: `${baseUrl}/account?payment=success`,
                cancel_url: `${baseUrl}/account`,
                client_reference_id: String(user.id),
                customer_email: user.email,
                metadata: {
                    userId: String(user.id),
                    tier: isSubscription ? 'supporter' : 'lifetime'
                }
            });

            res.json({ url: session.url });
        } catch (error) {
            console.error('[Stripe] Checkout error:', error);
            res.status(500).json({ error: error.message });
        }
    });


    // ── Create Portal Session ────────────────────────────────────
    router.post('/create-portal-session', async (req, res) => {
        try {
            const user = req.user;
            if (!user) return res.status(401).json({ error: 'Unauthorized' });

            // 1. If we have the Stripe Customer ID saved, use it! (Most reliable)
            let stripeCustomerId = user.stripe_customer_id;

            // 2. Fallback: Search for the customer by email if ID is missing
            if (!stripeCustomerId) {
                console.info(`[Stripe] No stripeCustomerId found for user ${user.id}, searching by email...`);
                const customers = await stripe.customers.list({
                    email: user.email,
                    limit: 1
                });

                if (customers.data.length > 0) {
                    stripeCustomerId = customers.data[0].id;
                }
            }

            if (!stripeCustomerId) {
                return res.status(404).json({ error: 'No Stripe customer record found. Please make a purchase first.' });
            }

            // Determine return URL dynamically
            let baseUrl = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            const session = await stripe.billingPortal.sessions.create({
                customer: stripeCustomerId,
                return_url: `${baseUrl}/account`,
            });

            res.json({ url: session.url });
        } catch (error) {
            console.error('[Stripe] Portal error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
};
