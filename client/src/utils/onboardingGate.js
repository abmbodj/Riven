import { Capacitor } from '@capacitor/core';
import { getMobileVisualBudget } from '../hooks/useMobileVisualBudget';

const ONBOARDING_DONE_UID_KEY = 'riven_onboarding_done_uid';

export function markOnboardingDoneClient(userId) {
    if (userId == null || typeof window === 'undefined') return;
    try {
        localStorage.setItem(ONBOARDING_DONE_UID_KEY, String(userId));
    } catch {
        /* quota / private mode */
    }
}

export function clearOnboardingDoneClient() {
    try {
        if (typeof window === 'undefined') return;
        localStorage.removeItem(ONBOARDING_DONE_UID_KEY);
    } catch {
        /* ignore */
    }
}

function userHasCompletedOnboardingClient(userId) {
    if (userId == null || typeof window === 'undefined') return false;
    try {
        return localStorage.getItem(ONBOARDING_DONE_UID_KEY) === String(userId);
    } catch {
        return false;
    }
}

function isOnboardingCompletedOnServer(user) {
    const v = user?.onboardingCompletedAt;
    return v != null && v !== '';
}

/**
 * iOS Safari often reports `pointer: fine` for the primary pointer even on phones, which
 * makes `(pointer: coarse)` and sometimes narrow-width checks unreliable alone. Treat
 * narrow viewports with touch capability as onboarding-eligible.
 */
function isLikelyTouchPhoneOrTablet() {
    if (typeof window === 'undefined') return false;
    if (!window.matchMedia('(max-width: 1023px)').matches) return false;
    if (window.matchMedia('(any-pointer: coarse)').matches) return true;
    return (typeof navigator !== 'undefined' && (navigator.maxTouchPoints ?? 0) > 0);
}

/**
 * True when this client should run the first-run onboarding flow: Capacitor shell or
 * mobile-class viewport (narrow width or coarse pointer). Desktop web sessions skip the
 * flow even if `onboarding_completed_at` is still null in the DB; mobile later can still
 * show onboarding.
 */
export function isMobileOnboardingEligible() {
    if (typeof window === 'undefined') return false;
    if (Capacitor.isNativePlatform()) return true;
    if (getMobileVisualBudget()) return true;
    return isLikelyTouchPhoneOrTablet();
}

/**
 * Gate post-auth onboarding: only on mobile-eligible clients, while the account has never
 * completed onboarding (`onboardingCompletedAt` is explicitly null from API). Legacy
 * payloads without the field skip the gate; client storage remembers completion if the DB
 * update succeeded once.
 */
export function userNeedsOnboarding(user) {
    if (!user?.id) return false;
    if (isOnboardingCompletedOnServer(user)) return false;
    if (user.onboardingCompletedAt === undefined) return false;
    if (!isMobileOnboardingEligible()) return false;
    if (userHasCompletedOnboardingClient(user.id)) return false;
    return true;
}
