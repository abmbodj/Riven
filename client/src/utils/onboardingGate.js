/**
 * Strict null check: legacy API responses without `onboardingCompletedAt` skip the gate.
 */
export function userNeedsOnboarding(user) {
    if (!user?.id) return false;
    return user.onboardingCompletedAt === null;
}
