const express = require('express');
const Stripe = require('stripe');

module.exports = function ({ app, db }) {
    if (!process.env.STRIPE_SECRET_KEY) {
        console.warn('[Stripe Webhooks] STRIPE_SECRET_KEY not set — skipping webhook routes');
        return;
    }
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

    // ── Environment Guard ─────────────────────────────────────────
    if (process.env.NODE_ENV === 'production') {
        if (!process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
            console.error('[Stripe] FATAL: Production environment using non-live Stripe key. Refusing to start.');
            throw new Error('STRIPE_SECRET_KEY must be a live key in production');
        }
        if (!process.env.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
            console.error('[Stripe] FATAL: STRIPE_WEBHOOK_SECRET missing or invalid in production.');
            throw new Error('STRIPE_WEBHOOK_SECRET is required in production');
        }
    }

    // ── Webhook Idempotency: prevent duplicate event processing ──
    // Uses DB table; falls back to in-memory Set if table doesn't exist yet
    const processedEventsCache = new Set();
    const CACHE_MAX = 1000;

    async function isEventAlreadyProcessed(eventId) {
        // Check in-memory cache first (fast path)
        if (processedEventsCache.has(eventId)) return true;

        try {
            const existing = await db.query('SELECT 1 FROM stripe_processed_events WHERE event_id = $1', [eventId]);
            if (existing.length > 0) return true;
        } catch {
            // Table may not exist yet — rely on in-memory cache only
        }
        return false;
    }

    async function markEventProcessed(eventId) {
        processedEventsCache.add(eventId);
        // Prevent unbounded memory growth
        if (processedEventsCache.size > CACHE_MAX) {
            const first = processedEventsCache.values().next().value;
            processedEventsCache.delete(first);
        }

        try {
            await db.execute('INSERT INTO stripe_processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING', [eventId]);
            // Periodic cleanup: remove events older than 7 days (Stripe retries stop after ~3 days)
            await db.execute("DELETE FROM stripe_processed_events WHERE processed_at < NOW() - INTERVAL '7 days'");
        } catch {
            // Table may not exist yet — in-memory cache is still protecting us
        }
    }

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
            console.error('[Stripe Webhook] Signature verification detail:', err.message);
            return res.status(400).send('Webhook signature verification failed');
        }

        console.log(`[Stripe Webhook] 🔔 Received event: ${event.type}`);

        // Idempotency guard: skip already-processed events (Stripe can retry)
        if (await isEventAlreadyProcessed(event.id)) {
            console.info(`[Stripe Webhook] ⏭️ Skipping duplicate event: ${event.id}`);
            return res.json({ received: true });
        }

        // BEST PRACTICE: Respond 200 immediately, then process asynchronously.
        // Stripe times out at ~20s and retries, which can cause duplicate processing.
        res.json({ received: true });

        try {
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object;
                    const userId = session.client_reference_id;

                    if (!userId) {
                        console.warn('[Stripe Webhook] ⚠️ No userId (client_reference_id) found in session:', session.id);
                        break;
                    }

                    // SERVER-SIDE RE-FETCH: Don't trust webhook payload alone.
                    // Re-fetch the session from Stripe to verify payment status and get canonical tier.
                    let tier;
                    try {
                        const verifiedSession = await stripe.checkout.sessions.retrieve(session.id, {
                            expand: ['line_items']
                        });
                        if (verifiedSession.payment_status !== 'paid') {
                            console.warn(`[Stripe Webhook] ⚠️ Session ${session.id} payment_status is ${verifiedSession.payment_status}, skipping.`);
                            break;
                        }
                        // Determine tier from the verified session mode (most reliable)
                        tier = verifiedSession.mode === 'subscription' ? 'supporter' : 'lifetime';
                    } catch (fetchErr) {
                        console.error(`[Stripe Webhook] ❌ Failed to re-fetch session ${session.id}:`, fetchErr.message);
                        // Fallback to metadata if Stripe API is temporarily down
                        tier = session.metadata?.tier || 'supporter';
                    }

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

                        // --- DUMMY PROOFING: Auto-cancel existing subscriptions on Lifetime upgrade ---
                        if (tier === 'lifetime' && stripeCustomerId) {
                            try {
                                // Find any active or trialing subscriptions for this customer
                                const subscriptions = await stripe.subscriptions.list({
                                    customer: stripeCustomerId,
                                    status: 'active',
                                    limit: 10,
                                });

                                for (const sub of subscriptions.data) {
                                    // Don't try to cancel the lifetime one if it somehow shows up as a subscription (it shouldn't, it's a payment)
                                    // But definitely cancel standard monthly ones.
                                    console.info(`[Stripe Webhook] 🔄 Lifetime upgrade detected! Canceling old subscription ${sub.id}...`);
                                    await stripe.subscriptions.cancel(sub.id);
                                }
                            } catch (cancelErr) {
                                console.error(`[Stripe Webhook] ⚠️ Failed to auto-cancel old subscriptions for ${userId}:`, cancelErr.message);
                            }
                        }
                    }
                    break;
                }

                case 'customer.subscription.deleted': {
                    const subscription = event.data.object;
                    const stripeCustomerId = subscription.customer;

                    console.info(`[Stripe Webhook] 🗑️ Subscription deleted for customer ${stripeCustomerId}. Checking before reverting to free.`);

                    // Guard: Don't downgrade lifetime users when their old monthly sub gets canceled
                    const currentUser = await db.execute('SELECT subscription_tier FROM users WHERE stripe_customer_id = $1', [stripeCustomerId]);
                    if (currentUser.rows.length > 0 && currentUser.rows[0].subscription_tier === 'lifetime') {
                        console.info(`[Stripe Webhook] ⏭️ Skipping downgrade — user is on lifetime plan.`);
                        break;
                    }

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

                case 'invoice.payment_failed': {
                    const invoice = event.data.object;
                    const stripeCustomerId = invoice.customer;
                    const attemptCount = invoice.attempt_count || 1;

                    console.warn(`[Stripe Webhook] ⚠️ Payment failed for customer ${stripeCustomerId} (attempt ${attemptCount})`);

                    // On final failure (attempt 3+), Stripe will auto-cancel the subscription
                    // which triggers customer.subscription.deleted — so we just log here.
                    // But we can notify the user proactively on early failures:
                    if (attemptCount >= 2) {
                        console.warn(`[Stripe Webhook] 🚨 Multiple payment failures for ${stripeCustomerId}. Subscription may be canceled soon.`);
                    }
                    break;
                }
            }

            // Mark event as processed AFTER successful handling
            await markEventProcessed(event.id);
        } catch (error) {
            // Response already sent (200) — log and let Stripe's idempotency + our DB guard handle retries
            console.error('[Stripe Webhook] Error processing event:', error);
        }
    });

};
