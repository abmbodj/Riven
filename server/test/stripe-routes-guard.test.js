import { afterEach, describe, expect, it, vi } from 'vitest';
import registerStripeRoutes from '../routes/stripe.js';

// The Express Stripe webhook was removed (Stripe calls the edge function); its startup
// guard against running production on a test key now lives in routes/stripe.js.
describe('Stripe routes production key guard', () => {
  afterEach(() => { vi.unstubAllEnvs(); });

  it('refuses to start in production with a non-live key', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_local_only');
    expect(() => registerStripeRoutes({ db: {} })).toThrow('STRIPE_SECRET_KEY must be a live key in production');
  });

  it('accepts a test key outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_local_only');
    expect(() => registerStripeRoutes({ db: {} })).not.toThrow();
  });
});
