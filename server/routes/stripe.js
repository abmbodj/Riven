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
                success_url: `${baseUrl}/account?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${baseUrl}/account`,
                client_reference_id: String(user.id),
                customer_email: user.email,
                metadata: {
                    userId: String(user.id),
                    tier: priceId.includes('LQZ') ? 'lifetime' : 'supporter'
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

            // We need the Stripe Customer ID. If we don't have it saved, 
            // we have to find it by email or wait for the first webhook.
            // For now, we'll try to find by email.
            const customers = await stripe.customers.list({
                email: user.email,
                limit: 1
            });

            if (customers.data.length === 0) {
                return res.status(404).json({ error: 'No Stripe customer found for this email.' });
            }

            // Determine return URL dynamically
            let baseUrl = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            const session = await stripe.billingPortal.sessions.create({
                customer: customers.data[0].id,
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
