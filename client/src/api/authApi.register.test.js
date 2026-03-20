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
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn().mockResolvedValue({
          data: { currentLevel: 'aal1', nextLevel: 'aal1' },
          error: null,
        }),
        listFactors: vi.fn().mockResolvedValue({
          data: { all: [], totp: [] },
          error: null,
        }),
      },
    },
  },
}));

import * as authApi from './authApi';
import { supabase } from '../lib/supabaseClient';

const SUPABASE_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwic3ViIjoiYXV0aC11c2VyIiwiZXhwIjo0MTAyNDQ0ODAwfQ.sig';

const buildJsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe('authApi register flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    localStorage.clear();
    sessionStorage.clear();
    document.cookie = 'riven_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    authApi.setToken(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('forwards the captcha token to Supabase signup and complete-registration', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');

    supabase.auth.signUp.mockResolvedValue({
      data: {
        session: { access_token: SUPABASE_ACCESS_TOKEN },
      },
      error: null,
    });
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: { access_token: SUPABASE_ACCESS_TOKEN },
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      user: { id: 7, username: 'atlas', email: 'atlas@example.com' },
    }));

    const user = await authApi.register('atlas', 'atlas@example.com', 'password123', 'captcha-token-123');

    expect(supabase.auth.signUp).toHaveBeenCalledWith({
      email: 'atlas@example.com',
      password: 'password123',
      options: {
        data: { username: 'atlas' },
        captchaToken: 'captcha-token-123',
      },
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/complete-registration',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'x-supabase-auth': SUPABASE_ACCESS_TOKEN,
          apikey: 'supabase-anon-key',
        }),
        body: JSON.stringify({
          username: 'atlas',
          captchaToken: 'captcha-token-123',
        }),
      }),
    );
    expect(user).toEqual({ id: 7, username: 'atlas', email: 'atlas@example.com' });
    expect(sessionStorage.getItem('riven_auth_token')).toBe(SUPABASE_ACCESS_TOKEN);
  });

  it('normalizes a bare legacy API origin so register falls back to /api routes', async () => {
    vi.stubEnv('VITE_API_URL', 'https://legacy.riven.test');

    supabase.auth.signUp.mockResolvedValue({
      data: { session: null },
      error: { message: 'captcha required' },
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({
        ok: true,
        csrfToken: 'csrf-token-123',
      }))
      .mockResolvedValueOnce(buildJsonResponse({
        token: 'legacy-token',
        user: { id: 8, username: 'atlas', email: 'atlas@example.com' },
      }));

    const user = await authApi.register('atlas', 'atlas@example.com', 'password123', 'captcha-token-123');

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://legacy.riven.test/api/csrf',
      expect.objectContaining({
        credentials: 'include',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'https://legacy.riven.test/api/auth/register',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'x-csrf-token': 'csrf-token-123',
        }),
        body: JSON.stringify({
          username: 'atlas',
          email: 'atlas@example.com',
          password: 'password123',
          captchaToken: 'captcha-token-123',
        }),
      }),
    );
    expect(user).toEqual({ id: 8, username: 'atlas', email: 'atlas@example.com' });
    expect(sessionStorage.getItem('riven_auth_token')).toBe('legacy-token');
  });
});
