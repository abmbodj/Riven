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
 * Gate post-auth onboarding: show only while the account has never completed onboarding
 * (`onboardingCompletedAt` is explicitly null from API). Legacy payloads without the field
 * skip the gate; client storage remembers completion if the DB update succeeded once.
 */
export function userNeedsOnboarding(user) {
    if (!user?.id) return false;
    if (isOnboardingCompletedOnServer(user)) return false;
    if (user.onboardingCompletedAt === undefined) return false;
    if (userHasCompletedOnboardingClient(user.id)) return false;
    return true;
}
