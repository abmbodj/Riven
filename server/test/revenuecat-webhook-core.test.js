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
            subscription_expires_at: '2026-06-14T00:00:00.000Z',
        });

        const expiryMs = new Date('2026-06-14T00:00:00.000Z').getTime();
        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'EXPIRATION',
                app_user_id: 'user-21',
                expiration_at_ms: expiryMs,
                event_timestamp_ms: expiryMs + 5_000,
            },
            persistence,
            logger,
        });

        expect(result).toEqual({
            outcome: 'downgraded',
            tier: 'free',
            notified: true,
            tierPush: { userId: 21, tier: 'free', version: expiryMs + 5_000 },
        });
        // Verify expiresAt was passed through to the persistence layer.
        expect(persistence.updateUserTierByAppUserId).toHaveBeenCalledWith(
            'user-21',
            'free',
            '2026-06-14T00:00:00.000Z',
        );
        expect(persistence.createUserNotification).toHaveBeenCalledWith(expect.objectContaining({
            userId: 21,
            kind: 'subscription_expired',
        }));
    });

    it('captures expiry on RENEWAL', async () => {
        persistence.getUserByAppUserId.mockResolvedValue({
            id: 30,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
        });
        persistence.updateUserTierByAppUserId.mockResolvedValue({
            id: 30,
            role: 'user',
            simulate_free_tier: false,
            subscription_tier: 'supporter',
            subscription_expires_at: '2026-07-15T00:00:00.000Z',
        });

        const renewalExpiryMs = new Date('2026-07-15T00:00:00.000Z').getTime();
        await processRevenueCatWebhookEvent({
            event: {
                type: 'RENEWAL',
                app_user_id: 'user-30',
                expiration_at_ms: renewalExpiryMs,
            },
            persistence,
            logger,
        });

        expect(persistence.updateUserTierByAppUserId).toHaveBeenCalledWith(
            'user-30',
            'supporter',
            '2026-07-15T00:00:00.000Z',
        );
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
                event_timestamp_ms: 1_760_000_000_000,
            },
            persistence,
            logger,
        });

        expect(result).toEqual({
            outcome: 'downgraded',
            tier: 'free',
            notified: false,
            tierPush: { userId: 22, tier: 'free', version: 1_760_000_000_000 },
        });
        expect(persistence.createUserNotification).not.toHaveBeenCalled();
    });

    it('pushes the numeric users.id and stored tier when app_user_id is the auth UUID', async () => {
        const authUuid = '7f1c2a9e-3b4d-4c5e-8f60-123456789abc';
        persistence.getUserByAppUserId.mockResolvedValue({ id: 31, role: 'user', subscription_tier: 'free' });
        persistence.updateUserTierByAppUserId.mockResolvedValue({ id: 31, role: 'user', subscription_tier: 'supporter' });

        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'INITIAL_PURCHASE',
                app_user_id: authUuid,
                event_timestamp_ms: 1_760_000_000_123,
                purchased_at_ms: 1_760_000_000_000,
                expiration_at_ms: 1_762_600_000_000,
            },
            persistence,
            logger,
        });

        expect(result.tierPush).toEqual({ userId: 31, tier: 'supporter', version: 1_760_000_000_123 });
    });

    it('falls back to purchased_at_ms, never the future expiry, when a purchase has no event timestamp', async () => {
        persistence.getUserByAppUserId.mockResolvedValue({ id: 32, subscription_tier: 'supporter' });
        persistence.updateUserTierByAppUserId.mockResolvedValue({ id: 32, subscription_tier: 'supporter' });

        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'RENEWAL',
                app_user_id: '32',
                purchased_at_ms: 1_760_000_000_000,
                expiration_at_ms: 1_762_600_000_000,
            },
            persistence,
            logger,
        });

        expect(result.tierPush).toEqual({ userId: 32, tier: 'supporter', version: 1_760_000_000_000 });
    });

    it('falls back to expiration_at_ms for an expiration without an event timestamp', async () => {
        persistence.getUserByAppUserId.mockResolvedValue({ id: 33, subscription_tier: 'supporter' });
        persistence.updateUserTierByAppUserId.mockResolvedValue({ id: 33, subscription_tier: 'free' });

        const result = await processRevenueCatWebhookEvent({
            event: {
                type: 'EXPIRATION',
                app_user_id: '33',
                expiration_at_ms: 1_760_000_000_000,
            },
            persistence,
            logger,
        });

        expect(result.tierPush).toEqual({ userId: 33, tier: 'free', version: 1_760_000_000_000 });
    });

    it('pushes nothing for events that leave the tier alone', async () => {
        const result = await processRevenueCatWebhookEvent({
            event: { type: 'CANCELLATION', app_user_id: '34', event_timestamp_ms: 1_760_000_000_000 },
            persistence,
            logger,
        });

        expect(result.tierPush).toBeUndefined();
    });

    it('maps only true entitlement-loss events to free tier', () => {
        expect(tierFromRevenueCatEvent('CANCELLATION')).toBeNull();
        expect(tierFromRevenueCatEvent('BILLING_ISSUE')).toBeNull();
        expect(tierFromRevenueCatEvent('EXPIRATION')).toBe('free');
    });
});
