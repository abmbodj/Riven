import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    userNeedsOnboarding,
    markOnboardingDoneClient,
    clearOnboardingDoneClient,
} from './onboardingGate';

describe('userNeedsOnboarding', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    it('returns false when no user', () => {
        expect(userNeedsOnboarding(null)).toBe(false);
        expect(userNeedsOnboarding(undefined)).toBe(false);
    });

    it('returns false when onboardingCompletedAt is undefined (legacy payload)', () => {
        expect(userNeedsOnboarding({ id: 1, username: 'x' })).toBe(false);
    });

    it('returns false when onboarding is completed (timestamp)', () => {
        expect(userNeedsOnboarding({ id: 1, onboardingCompletedAt: '2026-01-01T00:00:00.000Z' })).toBe(
            false,
        );
    });

    it('returns true for explicit null (first-time / in-progress)', () => {
        expect(userNeedsOnboarding({ id: 1, onboardingCompletedAt: null })).toBe(true);
    });

    it('returns false when client remembers completion for this user', () => {
        markOnboardingDoneClient(42);
        expect(userNeedsOnboarding({ id: 42, onboardingCompletedAt: null })).toBe(false);
    });

    it('still gates a different user when storage holds another id', () => {
        markOnboardingDoneClient(1);
        expect(userNeedsOnboarding({ id: 2, onboardingCompletedAt: null })).toBe(true);
    });

    it('clearOnboardingDoneClient removes client completion hint', () => {
        markOnboardingDoneClient(99);
        clearOnboardingDoneClient();
        expect(userNeedsOnboarding({ id: 99, onboardingCompletedAt: null })).toBe(true);
    });
});
