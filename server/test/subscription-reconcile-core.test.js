import { describe, expect, it } from 'vitest';

import { mergeProviderSubscriptionStates } from '../../supabase/functions/_shared/subscriptionReconcileCore.mjs';

describe('mergeProviderSubscriptionStates', () => {
  it('retains access when Stripe is active even if RevenueCat has no entitlement', () => {
    const stripeExpiry = '2026-07-16T00:00:00.000Z';

    const result = mergeProviderSubscriptionStates({
      states: [
        { tier: 'free', expiresAt: null },
        { tier: 'supporter', expiresAt: stripeExpiry },
      ],
    });

    expect(result).toEqual({
      action: 'active',
      state: { tier: 'supporter', expiresAt: stripeExpiry },
    });
  });

  it('does not downgrade when a provider lookup failed and no active provider was confirmed', () => {
    const result = mergeProviderSubscriptionStates({
      states: [{ tier: 'free', expiresAt: null }],
      hadProviderError: true,
    });

    expect(result).toEqual({
      action: 'error',
      reason: 'provider-fetch-failed',
    });
  });

  it('downgrades only when every checked provider reports no active access', () => {
    const latestExpiry = '2026-06-12T00:00:00.000Z';

    const result = mergeProviderSubscriptionStates({
      states: [
        { tier: 'free', expiresAt: '2026-06-10T00:00:00.000Z' },
        { tier: 'free', expiresAt: latestExpiry },
      ],
    });

    expect(result).toEqual({
      action: 'expired',
      state: { tier: 'free', expiresAt: latestExpiry },
    });
  });
});
