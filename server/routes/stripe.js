const express = require('express');
const router = express.Router();
const Stripe = require('stripe');
const { createCheckoutSchema } = require('../schemas/stripe');
const { handleValidationErrors } = require('../utils/validate');

module.exports = function ({ db }) {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn('[Stripe] STRIPE_SECRET_KEY not set — skipping Stripe routes');
        return router;
    }
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // ── Server-side Price ID Allowlist ─────────────────────────────
    // SECURITY: Only these exact Stripe Price IDs are accepted.
    // Prevents clients from substituting arbitrary price IDs.
    const ALLOWED_PRICES = {
        'price_1T6LPsLYlsIF3kiqi3vNu8q5': { tier: 'supporter', mode: 'subscription' },
        'price_1T6LQZLYlsIF3kiqrWxurMC7': { tier: 'lifetime',  mode: 'payment' },
    };

    // ── Create Checkout Session ──────────────────────────────────
    router.post('/create-checkout-session', createCheckoutSchema, handleValidationErrors, async (req, res) => {
        try {
            const { priceId, isSubscription } = req.body;
            const user = req.user;

            if (!user) {
                return res.status(401).json({ error: 'Authentication required' });
            }

            // Validate priceId against server-side allowlist
            const allowedPrice = ALLOWED_PRICES[priceId];
            if (!allowedPrice) {
                console.warn(`[Stripe] Rejected unknown priceId: ${priceId} from user ${user.id}`);
                return res.status(400).json({ error: 'Invalid price selected.' });
            }

            // Determine the base URL from the request origin (more robust than env var)
            let baseUrl = req.headers.origin || process.env.CLIENT_URL || 'http://localhost:5173';
            // Remove trailing slash if it exists
            if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);

            const sessionParams = {
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: priceId,
                        quantity: 1,
                    },
                ],
                mode: allowedPrice.mode,
                success_url: `${baseUrl}/account?payment=success`,
                cancel_url: `${baseUrl}/account`,
                client_reference_id: String(user.id),
                customer_email: user.email,
                metadata: {
                    userId: String(user.id),
                    tier: allowedPrice.tier
                }
            };

            // ── Test Coupon: set STRIPE_TEST_COUPON in .env to auto-apply 100% off ──
            if (process.env.STRIPE_TEST_COUPON && process.env.NODE_ENV !== 'production') {
                console.warn(`[Stripe] ⚠️  TEST MODE: Applying coupon "${process.env.STRIPE_TEST_COUPON}" to checkout`);
                sessionParams.discounts = [{ coupon: process.env.STRIPE_TEST_COUPON }];
            }

            const session = await stripe.checkout.sessions.create(sessionParams);

            res.json({ url: session.url });
        } catch (error) {
            console.error('[Stripe] Checkout error:', error);
            res.status(500).json({ error: 'Failed to create checkout session' });
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
            res.status(500).json({ error: 'Failed to create portal session' });
        }
    });

    return router;
};
