import { describe, it, expect } from 'vitest';
import { userNeedsOnboarding } from './onboardingGate';

describe('userNeedsOnboarding', () => {
    it('returns false when no user', () => {
        expect(userNeedsOnboarding(null)).toBe(false);
        expect(userNeedsOnboarding(undefined)).toBe(false);
    });

    it('returns false when onboardingCompletedAt is undefined (legacy payload)', () => {
        expect(userNeedsOnboarding({ id: 1, username: 'x' })).toBe(false);
    });

    it('returns false when onboarding is completed (timestamp)', () => {
        expect(userNeedsOnboarding({ id: 1, onboardingCompletedAt: '2026-01-01T00:00:00.000Z' })).toBe(false);
    });

    it('returns true only for explicit null', () => {
        expect(userNeedsOnboarding({ id: 1, onboardingCompletedAt: null })).toBe(true);
    });
});
