import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    processRevenueCatWebhookEvent,
    tierFromRevenueCatEvent,
} from '../../supabase/functions/_shared/revenuecatWebhookCore.mjs';

describe('RevenueCat webhook core processor', () => {
    let persistence;
    let logger;

    beforeEach(() => {
        persistence = {
            getUserByAppUserId: vi.fn(),
            updateUserTierByAppUserId: vi.fn(),
            createUserNotification: vi.fn(),
        };
        logger = {
            info: vi.fn(),
            error: vi.fn(),
        };
    });

    it('ignores cancellation events until access actually expires', async () => {
        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'CANCELLATION',
                app_user_id: 'user-1',
            },
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'ignored' });
        expect(persistence.updateUserTierByAppUserId).not.toHaveBeenCalled();
        expect(persistence.createUserNotification).not.toHaveBeenCalled();
    });

    it('ignores billing issues until expiration', async () => {
        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'BILLING_ISSUE',
                app_user_id: 'user-1',
            },
            persistence,
            logger,
        });

        expect(result).toEqual({ outcome: 'ignored' });
        expect(persistence.updateUserTierByAppUserId).not.toHaveBeenCalled();
    });

    it('downgrades on expiration and creates a one-time notice when premium ends', async () => {
        persistence.getUserByAppUserId.mockResolvedValue({
            id: 21,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
        });
        persistence.updateUserTierByAppUserId.mockResolvedValue({
            id: 21,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'free',
        });

        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'EXPIRATION',
                app_user_id: 'user-21',
            },
            persistence,
            logger,
        });

        expect(result).toEqual({
            outcome: 'downgraded',
            tier: 'free',
            notified: true,
        });
        expect(persistence.createUserNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: 21,
            kind: 'subscription_expired',
        }));
    });

    it('does not create an expiration notice when role-based premium remains active', async () => {
        persistence.getUserByAppUserId.mockResolvedValue({
            id: 22,
            role: 'friends',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
        });
        persistence.updateUserTierByAppUserId.mockResolvedValue({
            id: 22,
            role: 'friends',
            simulate_free_tier: false,
            subscription_tier: 'free',
        });

        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'EXPIRATION',
                app_user_id: 'user-22',
            },
            persistence,
            logger,
        });

        expect(result).toEqual({
            outcome: 'downgraded',
            tier: 'free',
            notified: false,
        });
        expect(persistence.createUserNotification).not.toHaveBeenCalled();
    });

    it('maps only true entitlement-loss events to free tier', () => {
        expect(tierFromRevenueCatEvent('CANCELLATION')).toBeNull();
        expect(tierFromRevenueCatEvent('BILLING_ISSUE')).toBeNull();
        expect(tierFromRevenueCatEvent('EXPIRATION')).toBe('free');
    });
});
