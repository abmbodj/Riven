import { describe, expect, it } from 'vitest';
import { resolveStripePriceIds } from './stripePriceIds.js';

describe('Stripe price configuration', () => {
  it('never treats a one-time lifetime price as an annual subscription', () => {
    expect(resolveStripePriceIds({ VITE_STRIPE_PRICE_LIFETIME: 'price_lifetime' }).annual).toBeUndefined();
  });

  it('uses the explicitly configured recurring annual price', () => {
    expect(resolveStripePriceIds({ VITE_STRIPE_PRICE_ANNUAL: 'price_annual', VITE_STRIPE_PRICE_LIFETIME: 'price_lifetime' }).annual).toBe('price_annual');
  });
});
