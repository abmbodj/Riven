import { describe, expect, it } from 'vitest';

import { isPremiumActive, resolvePremium } from '../../supabase/functions/_shared/premiumAccess.mjs';

const NOW = new Date('2026-06-15T12:00:00Z');
const FUTURE = new Date('2026-07-15T12:00:00Z').toISOString();
const PAST = new Date('2026-05-15T12:00:00Z').toISOString();

describe('isPremiumActive', () => {
    it('returns false for null/undefined user', () => {
        expect(isPremiumActive(null, NOW)).toBe(false);
        expect(isPremiumActive(undefined, NOW)).toBe(false);
    });

    it('free tier is inactive', () => {
        expect(isPremiumActive({ subscription_tier: 'free' }, NOW)).toBe(false);
    });

    it('lifetime tier is always active, no expiry check', () => {
        expect(isPremiumActive({ subscription_tier: 'lifetime', subscription_expires_at: PAST }, NOW)).toBe(true);
    });

    it('owner without simulate_free_tier is active', () => {
        expect(isPremiumActive({ role: 'owner', simulate_free_tier: false }, NOW)).toBe(true);
    });

    it('owner with simulate_free_tier is inactive (falls through to tier)', () => {
        expect(isPremiumActive({ role: 'owner', simulate_free_tier: true, subscription_tier: 'free' }, NOW)).toBe(false);
    });

    it('admin without simulate_free_tier is active', () => {
        expect(isPremiumActive({ role: 'admin', simulate_free_tier: false }, NOW)).toBe(true);
    });

    it('friends role is active regardless of tier', () => {
        expect(isPremiumActive({ role: 'friends', subscription_tier: 'free' }, NOW)).toBe(true);
    });

    it('supporter with future expiry is active', () => {
        expect(isPremiumActive({ subscription_tier: 'supporter', subscription_expires_at: FUTURE }, NOW)).toBe(true);
    });

    it('supporter with past expiry is inactive (the live gate)', () => {
        expect(isPremiumActive({ subscription_tier: 'supporter', subscription_expires_at: PAST }, NOW)).toBe(false);
    });

    it('supporter with null expiry is active (not-yet-backfilled, avoid false lockout)', () => {
        expect(isPremiumActive({ subscription_tier: 'supporter', subscription_expires_at: null }, NOW)).toBe(true);
    });

    it('supporter with undefined expiry is active', () => {
        expect(isPremiumActive({ subscription_tier: 'supporter' }, NOW)).toBe(true);
    });
});

describe('resolvePremium', () => {
    it('free user resolves correctly', () => {
        const result = resolvePremium({ subscription_tier: 'free', role: 'user' }, NOW);
        expect(result).toEqual({ active: false, effectiveTier: 'free', premiumAccessSource: 'free' });
    });

    it('active supporter resolves to subscription source', () => {
        const result = resolvePremium({
            subscription_tier: 'supporter',
            subscription_expires_at: FUTURE,
            role: 'user',
            simulate_free_tier: false,
        }, NOW);
        expect(result).toEqual({ active: true, effectiveTier: 'supporter', premiumAccessSource: 'subscription' });
    });

    it('expired supporter resolves to free', () => {
        const result = resolvePremium({
            subscription_tier: 'supporter',
            subscription_expires_at: PAST,
            role: 'user',
            simulate_free_tier: false,
        }, NOW);
        expect(result).toEqual({ active: false, effectiveTier: 'free', premiumAccessSource: 'free' });
    });

    it('lifetime user resolves to lifetime source', () => {
        const result = resolvePremium({ subscription_tier: 'lifetime', role: 'user', simulate_free_tier: false }, NOW);
        expect(result).toEqual({ active: true, effectiveTier: 'lifetime', premiumAccessSource: 'lifetime' });
    });

    it('owner resolves to owner_included', () => {
        const result = resolvePremium({ role: 'owner', simulate_free_tier: false, subscription_tier: 'free' }, NOW);
        expect(result).toEqual({ active: true, effectiveTier: 'lifetime', premiumAccessSource: 'owner_included' });
    });

    it('admin resolves to admin_included', () => {
        const result = resolvePremium({ role: 'admin', simulate_free_tier: false, subscription_tier: 'free' }, NOW);
        expect(result).toEqual({ active: true, effectiveTier: 'lifetime', premiumAccessSource: 'admin_included' });
    });

    it('friends resolves to friends_included', () => {
        const result = resolvePremium({ role: 'friends', subscription_tier: 'free' }, NOW);
        expect(result).toEqual({ active: true, effectiveTier: 'lifetime', premiumAccessSource: 'friends_included' });
    });

    it('null user resolves to free', () => {
        const result = resolvePremium(null, NOW);
        expect(result).toEqual({ active: false, effectiveTier: 'free', premiumAccessSource: 'free' });
    });
});
