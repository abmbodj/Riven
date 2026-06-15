import { beforeEach, describe, expect, it, vi } from 'vitest';

import { processStripeWebhookEvent } from '../../supabase/functions/_shared/stripeWebhookCore.mjs';

describe('Stripe webhook core processor', () => {
    let stripe;
    let persistence;
    let logger;

    beforeEach(() => {
        stripe = {
            checkout: {
                sessions: {
                    retrieve: vi.fn(),
                },
            },
            subscriptions: {
                list: vi.fn(),
                cancel: vi.fn(),
                retrieve: vi.fn(),
            },
            customers: {
                retrieve: vi.fn(),
            },
        };

        persistence = {
            updateUserFromCheckout: vi.fn(),
            getSubscriptionTierByCustomerId: vi.fn(),
            getUserBillingStateByCustomerId: vi.fn(),
            getUserBillingStateByEmail: vi.fn(),
            downgradeUserByCustomerId: vi.fn(),
            downgradeUserByEmail: vi.fn(),
            refreshSubscriptionExpiry: vi.fn(),
            createUserNotification: vi.fn(),
        };

        logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
    });

    it('fulfills paid supporter checkout sessions and captures subscription_expires_at', async () => {
        const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            payment_status: 'paid',
            mode: 'subscription',
            subscription: 'sub_123',
        });
        stripe.subscriptions.retrieve.mockResolvedValue({ current_period_end: periodEnd });
        persistence.updateUserFromCheckout.mockResolvedValue(true);
        stripe.subscriptions.list.mockImplementation(({ status }) =>
            Promise.resolve({ data: status === 'active' ? [{ id: 'sub_123' }] : [] }),
        );

        const result = await processStripeWebhookEvent({
            event: {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_123',
                        client_reference_id: '42',
                        customer: 'cus_123',
                        subscription: 'sub_123',
                        metadata: { tier: 'supporter' },
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'checkout-updated', tier: 'supporter' });
        expect(persistence.updateUserFromCheckout).toHaveBeenCalledWith(expect.objectContaining({
            userId: 42,
            tier: 'supporter',
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
            expiresAt: new Date(periodEnd * 1000).toISOString(),
        }));
        expect(stripe.subscriptions.cancel).not.toHaveBeenCalled();
    });

    it('cancels active subscriptions after a lifetime checkout upgrade (no expiresAt for lifetime)', async () => {
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            payment_status: 'paid',
            mode: 'payment',
        });
        persistence.updateUserFromCheckout.mockResolvedValue(true);
        stripe.subscriptions.list.mockResolvedValue({
            data: [{ id: 'sub_old_1' }, { id: 'sub_old_2' }],
        });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_lifetime',
                        client_reference_id: '7',
                        customer: 'cus_lifetime',
                        subscription: null,
                        metadata: { tier: 'lifetime' },
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'checkout-updated', tier: 'lifetime' });
        // Lifetime: no expiry
        expect(persistence.updateUserFromCheckout).toHaveBeenCalledWith(expect.objectContaining({
            tier: 'lifetime',
            expiresAt: null,
        }));
        expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(2);
    });

    it('cancels other subscriptions after a new supporter checkout', async () => {
        const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            payment_status: 'paid',
            mode: 'subscription',
            subscription: 'sub_new',
        });
        stripe.subscriptions.retrieve.mockResolvedValue({ current_period_end: periodEnd });
        persistence.updateUserFromCheckout.mockResolvedValue(true);
        stripe.subscriptions.list.mockImplementation(({ status }) => {
            if (status === 'active') {
                return Promise.resolve({ data: [{ id: 'sub_old' }, { id: 'sub_new' }] });
            }
            return Promise.resolve({ data: [] });
        });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_annual',
                        client_reference_id: '9',
                        customer: 'cus_annual',
                        subscription: 'sub_new',
                        metadata: { tier: 'supporter' },
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'checkout-updated', tier: 'supporter' });
        expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(1);
        expect(stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_old');
    });

    it('skips unpaid checkout sessions without updating the user', async () => {
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            payment_status: 'unpaid',
            mode: 'subscription',
        });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'checkout.session.completed',
                data: {
                    object: {
                        id: 'cs_unpaid',
                        client_reference_id: '12',
                        customer: 'cus_unpaid',
                        subscription: 'sub_unpaid',
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'checkout-unpaid' });
        expect(persistence.updateUserFromCheckout).not.toHaveBeenCalled();
    });

    it('invoice.paid refreshes subscription_expires_at to prevent false lockout on missed renewal', async () => {
        const periodEnd = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
        stripe.subscriptions.retrieve.mockResolvedValue({ current_period_end: periodEnd });
        persistence.refreshSubscriptionExpiry.mockResolvedValue(undefined);

        const result = await processStripeWebhookEvent({
            event: {
                type: 'invoice.paid',
                data: {
                    object: {
                        customer: 'cus_renew',
                        subscription: 'sub_renew',
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result.outcome).toBe('invoice-paid-expiry-refreshed');
        expect(result.expiresAt).toBe(new Date(periodEnd * 1000).toISOString());
        expect(persistence.refreshSubscriptionExpiry).toHaveBeenCalledWith({
            stripeCustomerId: 'cus_renew',
            stripeSubscriptionId: 'sub_renew',
            expiresAt: new Date(periodEnd * 1000).toISOString(),
        });
    });

    it('skips subscription deletion downgrades when another subscription remains', async () => {
        persistence.getUserBillingStateByCustomerId.mockResolvedValue({
            id: 11,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
        });
        stripe.subscriptions.list.mockImplementation(({ status }) =>
            Promise.resolve({ data: status === 'active' ? [{ id: 'sub_still_here' }] : [] }),
        );

        const result = await processStripeWebhookEvent({
            event: {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        customer: 'cus_multi',
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'subscription-delete-skipped-still-subscribed' });
        expect(persistence.downgradeUserByCustomerId).not.toHaveBeenCalled();
    });

    it('skips subscription deletion downgrades for lifetime users', async () => {
        persistence.getUserBillingStateByCustomerId.mockResolvedValue({
            id: 12,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'lifetime',
        });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        customer: 'cus_lifetime',
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'subscription-delete-skipped-lifetime' });
        expect(persistence.downgradeUserByCustomerId).not.toHaveBeenCalled();
    });

    it('creates a subscription-expired notification when paid access actually ends, passes expiresAt', async () => {
        const periodEnd = Math.floor(new Date('2026-06-10T00:00:00Z').getTime() / 1000);
        persistence.getUserBillingStateByCustomerId.mockResolvedValue({
            id: 13,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
        });
        stripe.subscriptions.list.mockResolvedValue({ data: [] });
        persistence.downgradeUserByCustomerId.mockResolvedValue({
            id: 13,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'free',
            subscription_expires_at: new Date(periodEnd * 1000).toISOString(),
        });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_expired',
                        customer: 'cus_expired',
                        current_period_end: periodEnd,
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({
            outcome: 'subscription-delete-downgraded-by-customer-id',
            notified: true,
        });
        // expiresAt derived from current_period_end
        expect(persistence.downgradeUserByCustomerId).toHaveBeenCalledWith(
            'cus_expired',
            new Date(periodEnd * 1000).toISOString(),
        );
        expect(persistence.createUserNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: 13,
            kind: 'subscription_expired',
        }));
    });

    it('does not create an expiration notice when privileged access stays active', async () => {
        persistence.getUserBillingStateByCustomerId.mockResolvedValue({
            id: 14,
            role: 'admin',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
        });
        stripe.subscriptions.list.mockResolvedValue({ data: [] });
        persistence.downgradeUserByCustomerId.mockResolvedValue({
            id: 14,
            role: 'admin',
            simulate_free_tier: false,
            subscription_tier: 'free',
        });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_admin_expired',
                        customer: 'cus_admin_expired',
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({
            outcome: 'subscription-delete-downgraded-by-customer-id',
            notified: false,
        });
        expect(persistence.createUserNotification).not.toHaveBeenCalled();
    });

    it('falls back to customer email when customer-id downgrade misses', async () => {
        persistence.getUserBillingStateByCustomerId.mockResolvedValue({
            id: 15,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
        });
        stripe.subscriptions.list.mockResolvedValue({ data: [] });
        persistence.downgradeUserByCustomerId.mockResolvedValue(null);
        stripe.customers.retrieve.mockResolvedValue({ email: 'test@example.com' });
        persistence.downgradeUserByEmail.mockResolvedValue({
            id: 15,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'free',
        });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        id: 'sub_email_fallback',
                        customer: 'cus_email_fallback',
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({
            outcome: 'subscription-delete-downgraded-by-email',
            notified: true,
        });
        expect(persistence.downgradeUserByEmail).toHaveBeenCalledWith('test@example.com', null);
    });

    it('marks cancel-at-period-end updates as scheduled cancellations without downgrading', async () => {
        const result = await processStripeWebhookEvent({
            event: {
                type: 'customer.subscription.updated',
                data: {
                    object: {
                        id: 'sub_cancel_later',
                        cancel_at_period_end: true,
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'subscription-update-scheduled-cancel' });
        expect(persistence.downgradeUserByCustomerId).not.toHaveBeenCalled();
        expect(persistence.createUserNotification).not.toHaveBeenCalled();
    });
});
