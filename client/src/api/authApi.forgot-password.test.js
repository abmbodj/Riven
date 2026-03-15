/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
        listFactors: vi.fn(),
      },
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

describe('authApi forgot-password migration', () => {
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

  it('uses the forgot-password edge function before the legacy route', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(
      buildJsonResponse({
        message: 'If an account with that email exists, a reset link has been sent.',
      }),
    );

    const result = await authApi.forgotPassword('atlas@example.com');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/forgot-password',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ email: 'atlas@example.com' }),
      }),
    );
    expect(result).toEqual({
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  });

  it('falls back to the legacy route when the forgot-password edge function is unavailable', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        message: 'If an account with that email exists, a reset link has been sent.',
      }));

    const result = await authApi.forgotPassword('atlas@example.com');

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/forgot-password',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/auth/forgot-password'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'atlas@example.com' }),
      }),
    );
    expect(result).toEqual({
      message: 'If an account with that email exists, a reset link has been sent.',
    });
  });
});
