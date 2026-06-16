/**
 * @typedef {{ tier: 'supporter' | 'free', expiresAt: string | null }} ProviderSubscriptionState
 * @typedef {{ action: 'active', state: ProviderSubscriptionState }
 *   | { action: 'expired', state: ProviderSubscriptionState }
 *   | { action: 'error', reason: string }} MergedProviderSubscriptionState
 */

/**
 * Merge provider-authoritative subscription states for reconciliation.
 *
 * A user can move between Stripe and RevenueCat without immediately clearing the
 * other provider's identifiers. Reconcile should preserve access when any
 * checked provider is active, and should not downgrade if an unverified provider
 * could still be active.
 *
 * @param {{ states?: ProviderSubscriptionState[], hadProviderError?: boolean }} [options]
 * @returns {MergedProviderSubscriptionState}
 */
export const mergeProviderSubscriptionStates = ({ states = [], hadProviderError = false } = {}) => {
  const checkedStates = states.filter(Boolean);
  const activeState = checkedStates.find((state) => state.tier === 'supporter');

  if (activeState) {
    return { action: 'active', state: activeState };
  }

  if (hadProviderError) {
    return { action: 'error', reason: 'provider-fetch-failed' };
  }

  if (checkedStates.length === 0) {
    return { action: 'error', reason: 'no-provider-configured' };
  }

  const latestExpiredState = checkedStates
    .filter((state) => state.expiresAt)
    .sort((a, b) => new Date(b.expiresAt).getTime() - new Date(a.expiresAt).getTime())[0];

  return {
    action: 'expired',
    state: {
      tier: 'free',
      expiresAt: latestExpiredState?.expiresAt || null,
    },
  };
};
