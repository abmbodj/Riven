import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: vi.fn(() => false),
    },
}));

import { Capacitor } from '@capacitor/core';
import {
    userNeedsOnboarding,
    isMobileOnboardingEligible,
    markOnboardingDoneClient,
    clearOnboardingDoneClient,
} from './onboardingGate';

/** matchMedia queries from useMobileVisualBudget + onboardingGate (order: any-pointer before pointer). */
function mockMatchMedia({
    max767 = false,
    max1023 = false,
    pointerCoarse = false,
    anyPointerCoarse = false,
    reducedMotion = false,
} = {}) {
    window.matchMedia = vi.fn((query) => {
        const q = String(query);
        let matches = false;
        if (q.includes('any-pointer: coarse')) {
            matches = anyPointerCoarse;
        } else if (q.includes('prefers-reduced-motion')) {
            matches = reducedMotion;
        } else if (q.includes('max-width: 767px')) {
            matches = max767;
        } else if (q.includes('max-width: 1023px')) {
            matches = max1023;
        } else if (/pointer:\s*coarse/.test(q)) {
            matches = pointerCoarse;
        }
        return {
            matches,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        };
    });
}

describe('isMobileOnboardingEligible', () => {
    beforeEach(() => {
        Capacitor.isNativePlatform.mockReturnValue(false);
        mockMatchMedia({});
        vi.stubGlobal('navigator', {
            ...navigator,
            maxTouchPoints: 0,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns false when not native and not mobile viewport', () => {
        expect(isMobileOnboardingEligible()).toBe(false);
    });

    it('does not treat desktop reduced-motion preference as mobile onboarding eligibility', () => {
        mockMatchMedia({ reducedMotion: true });
        expect(isMobileOnboardingEligible()).toBe(false);
    });

    it('returns true on narrow 767 viewport', () => {
        mockMatchMedia({ max767: true });
        expect(isMobileOnboardingEligible()).toBe(true);
    });

    it('returns true on primary coarse pointer', () => {
        mockMatchMedia({ pointerCoarse: true });
        expect(isMobileOnboardingEligible()).toBe(true);
    });

    it('returns true when Capacitor native regardless of matchMedia', () => {
        Capacitor.isNativePlatform.mockReturnValue(true);
        mockMatchMedia({});
        expect(isMobileOnboardingEligible()).toBe(true);
    });

    it('returns true for narrow 1023 + touch points (iOS-style fine pointer)', () => {
        mockMatchMedia({ max767: false, max1023: true, pointerCoarse: false, anyPointerCoarse: false });
        vi.stubGlobal('navigator', {
            ...navigator,
            maxTouchPoints: 5,
        });
        expect(isMobileOnboardingEligible()).toBe(true);
    });

    it('returns true for narrow 1023 + any-pointer coarse', () => {
        mockMatchMedia({ max1023: true, anyPointerCoarse: true });
        expect(isMobileOnboardingEligible()).toBe(true);
    });
});

describe('userNeedsOnboarding', () => {
    beforeEach(() => {
        localStorage.clear();
        Capacitor.isNativePlatform.mockReturnValue(false);
        mockMatchMedia({ max767: true });
        vi.stubGlobal('navigator', {
            ...navigator,
            maxTouchPoints: 0,
        });
    });

    afterEach(() => {
        localStorage.clear();
        vi.unstubAllGlobals();
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

    it('returns false for explicit null when not mobile-eligible', () => {
        mockMatchMedia({});
        expect(userNeedsOnboarding({ id: 1, onboardingCompletedAt: null })).toBe(false);
    });

    it('returns true for explicit null when mobile-eligible', () => {
        expect(userNeedsOnboarding({ id: 1, onboardingCompletedAt: null })).toBe(true);
    });

    it('returns true for explicit null on native Capacitor when matchMedia is desktop', () => {
        Capacitor.isNativePlatform.mockReturnValue(true);
        mockMatchMedia({});
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
