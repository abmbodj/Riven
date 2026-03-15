/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import * as authApi from './authApi';

const buildJsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const buildErrorResponse = (status, body) => ({
  ok: false,
  status,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const encodeSegment = (value) => btoa(JSON.stringify(value))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const buildJwt = (payload) => [
  encodeSegment({ alg: 'HS256', typ: 'JWT' }),
  encodeSegment(payload),
  'signature',
].join('.');

describe('authApi stripe edge migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    localStorage.clear();
    authApi.setToken(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the checkout edge function for Supabase session tokens', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      url: 'https://checkout.stripe.test/session',
    }));

    const result = await authApi.createStripeCheckoutSession({
      priceId: 'price_1T6LPsLYlsIF3kiqi3vNu8q5',
      isSubscription: true,
    });

    expect(result).toEqual({ url: 'https://checkout.stripe.test/session' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/create-checkout',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          priceId: 'price_1T6LPsLYlsIF3kiqi3vNu8q5',
          isSubscription: true,
        }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('uses the portal edge function for Supabase session tokens', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      url: 'https://billing.stripe.test/portal',
    }));

    const result = await authApi.createStripePortalSession();

    expect(result).toEqual({ url: 'https://billing.stripe.test/portal' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/create-portal',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('uses the legacy Express route for non-Supabase checkout tokens', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'test@example.com', role: 'user' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      url: 'https://checkout.stripe.test/session',
    }));

    await authApi.createStripeCheckoutSession({
      priceId: 'price_1T6LQZLYlsIF3kiqrWxurMC7',
      isSubscription: false,
    });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/stripe/create-checkout-session'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
        }),
      }),
    );
  });

  it('falls back to the legacy Express route when the portal edge function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        url: 'https://billing.stripe.test/portal',
      }));

    const result = await authApi.createStripePortalSession();

    expect(result).toEqual({ url: 'https://billing.stripe.test/portal' });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/create-portal',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/stripe/create-portal-session'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
