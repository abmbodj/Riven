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
            },
            customers: {
                retrieve: vi.fn(),
            },
        };

        persistence = {
            updateUserFromCheckout: vi.fn(),
            getSubscriptionTierByCustomerId: vi.fn(),
            downgradeUserByCustomerId: vi.fn(),
            downgradeUserByEmail: vi.fn(),
        };

        logger = {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        };
    });

    it('fulfills paid supporter checkout sessions', async () => {
        stripe.checkout.sessions.retrieve.mockResolvedValue({
            payment_status: 'paid',
            mode: 'subscription',
        });
        persistence.updateUserFromCheckout.mockResolvedValue(true);

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
        expect(persistence.updateUserFromCheckout).toHaveBeenCalledWith({
            userId: 42,
            tier: 'supporter',
            stripeCustomerId: 'cus_123',
            stripeSubscriptionId: 'sub_123',
        });
        expect(stripe.subscriptions.list).not.toHaveBeenCalled();
    });

    it('cancels active subscriptions after a lifetime checkout upgrade', async () => {
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
        expect(stripe.subscriptions.list).toHaveBeenCalledWith({
            customer: 'cus_lifetime',
            status: 'active',
            limit: 10,
        });
        expect(stripe.subscriptions.cancel).toHaveBeenCalledTimes(2);
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

    it('skips subscription deletion downgrades for lifetime users', async () => {
        persistence.getSubscriptionTierByCustomerId.mockResolvedValue('lifetime');

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

    it('falls back to customer email when customer-id downgrade misses', async () => {
        persistence.getSubscriptionTierByCustomerId.mockResolvedValue('free');
        persistence.downgradeUserByCustomerId.mockResolvedValue(false);
        stripe.customers.retrieve.mockResolvedValue({ email: 'test@example.com' });

        const result = await processStripeWebhookEvent({
            event: {
                type: 'customer.subscription.deleted',
                data: {
                    object: {
                        customer: 'cus_email_fallback',
                    },
                },
            },
            stripe,
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'subscription-delete-downgraded-by-email' });
        expect(persistence.downgradeUserByEmail).toHaveBeenCalledWith('test@example.com');
    });
});
