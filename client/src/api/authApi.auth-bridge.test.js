/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getClaims: vi.fn().mockResolvedValue({ data: { claims: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null }),
      setSession: vi.fn(),
      updateUser: vi.fn(),
      verifyOtp: vi.fn(),
      resend: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
        listFactors: vi.fn(),
      },
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

const SUPABASE_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwic3ViIjoiYXV0aC11c2VyIiwiZXhwIjo0MTAyNDQ0ODAwfQ.sig';

const encodeSegment = (value) => btoa(JSON.stringify(value))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const buildLegacyJwt = (payload) => [
  encodeSegment({ alg: 'HS256', typ: 'JWT' }),
  encodeSegment(payload),
  'legacy-signature',
].join('.');

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

const createSelectSingleChain = (data, error = null) => {
  const single = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, single };
};

describe('authApi Supabase auth bridge reductions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_ENABLE_LEGACY_AUTH_BRIDGE', 'true');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    localStorage.clear();
    authApi.setToken(null);
    globalThis.fetch = vi.fn(() => {
      throw new Error('Unexpected legacy auth fetch');
    });
    window.history.replaceState({}, '', '/account');

    supabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user' } },
      error: null,
    });
    supabase.auth.getClaims.mockResolvedValue({
      data: { claims: { sub: 'auth-user', aal: 'aal1' } },
      error: null,
    });
    supabase.auth.setSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN, refresh_token: 'refresh-token' } },
      error: null,
    });
    supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
    supabase.auth.mfa.listFactors.mockResolvedValue({
      data: { all: [], totp: [] },
      error: null,
    });
    supabase.auth.updateUser.mockResolvedValue({
      data: { user: { id: 'auth-user' } },
      error: null,
    });
    supabase.auth.verifyOtp.mockResolvedValue({
      data: { session: { access_token: 'recovery-token' }, user: { id: 'auth-user' } },
      error: null,
    });
    supabase.auth.resend.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
  });

  it('loads the current user directly from Supabase when a session is active', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    const { select, single } = createSelectSingleChain({
      id: 42,
      username: 'atlas',
      display_name: 'Atlas',
      email: 'atlas@example.com',
      share_code: 'ABCD1234',
      avatar: '/avatar.png',
      banner: '/banner.png',
      bio: 'Quietly building',
      streak_data: '{"currentStreak":3}',
      pet_customization: '{"gardenTheme":"cottage","decorations":[],"specialPlants":[]}',
      role: 'admin',
      is_admin: 1,
      created_at: '2026-03-14T18:00:00.000Z',
      two_fa_enabled: true,
      subscription_tier: 'free',
      simulate_free_tier: false,
      email_verified: true,
    });
    supabase.from.mockReturnValue({ select });

    const user = await authApi.getMe();

    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(select).toHaveBeenCalled();
    expect(single).toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(user).toEqual({
      id: 42,
      username: 'atlas',
      displayName: 'Atlas',
      email: 'atlas@example.com',
      shareCode: 'ABCD1234',
      avatar: '/avatar.png',
      banner: '/banner.png',
      bio: 'Quietly building',
      streakData: { currentStreak: 3 },
      petCustomization: { gardenTheme: 'cottage', decorations: [], specialPlants: [] },
      role: 'admin',
      isAdmin: true,
      isOwner: false,
      createdAt: '2026-03-14T18:00:00.000Z',
      twoFAEnabled: true,
      subscription_tier: 'lifetime',
      simulate_free_tier: false,
      email_verified: true,
      onboardingCompletedAt: null,
      onboardingStep: 0,
      base_subscription_tier: 'free',
      has_manageable_subscription: false,
      premium_access_source: 'admin_included',
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_expires_at: null,
    });
  });

  it('restores startup auth with one session read, verified claims, and one profile query', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: SUPABASE_ACCESS_TOKEN,
          user: { id: 'auth-user' },
        },
      },
      error: null,
    });
    const { select } = createSelectSingleChain({
      id: 42,
      username: 'atlas',
      email: 'atlas@example.com',
      role: 'user',
      two_fa_enabled: false,
      onboarding_completed_at: '2026-07-01T00:00:00.000Z',
    });
    supabase.from.mockReturnValue({ select });

    const user = await authApi.restoreSessionUser();

    expect(user.id).toBe(42);
    expect(supabase.auth.getSession).toHaveBeenCalledTimes(1);
    expect(supabase.auth.getClaims).toHaveBeenCalledTimes(1);
    expect(supabase.auth.getClaims).toHaveBeenCalledWith(SUPABASE_ACCESS_TOKEN);
    expect(supabase.auth.getUser).not.toHaveBeenCalled();
    expect(supabase.auth.mfa.getAuthenticatorAssuranceLevel).not.toHaveBeenCalled();
    expect(supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });

  it('completes registration on refresh when the Supabase session exists but the app row is missing', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    const { select } = createSelectSingleChain(null, {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    });
    supabase.from.mockReturnValue({ select });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      user: { id: 42, email: 'atlas@example.com', username: 'atlas', twoFAEnabled: false },
    }));

    const user = await authApi.restoreSessionUser();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/complete-registration'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'x-supabase-auth': SUPABASE_ACCESS_TOKEN,
        }),
      }),
    );
    expect(user).toEqual({
      id: 42,
      email: 'atlas@example.com',
      username: 'atlas',
      twoFAEnabled: false,
    });
  });

  it('hydrates a missing Supabase session from the auth bridge before edge calls', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    authApi.setToken('legacy-token');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({}))
      .mockResolvedValueOnce(buildJsonResponse({
        access_token: SUPABASE_ACCESS_TOKEN,
        refresh_token: 'refresh-token',
      }))
      .mockResolvedValueOnce(buildJsonResponse({
        remaining: 7,
        max: 10,
        characterLimit: 15000,
        flashcardRange: [5, 15],
        canWatchAd: false,
        isPremium: false,
      }));

    const result = await authApi.getAILimits();

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/supabase-token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer legacy-token',
        }),
      }),
    );
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: SUPABASE_ACCESS_TOKEN,
      refresh_token: 'refresh-token',
    });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      'https://supabase.test/functions/v1/ai-limits',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'x-supabase-auth': SUPABASE_ACCESS_TOKEN,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
    expect(result).toEqual({
      remaining: 7,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
      isPremium: false,
    });
  });

  it('bridges a structurally valid legacy JWT before forcing reauthentication', async () => {
    const legacyToken = buildLegacyJwt({ id: 7, email: 'atlas@example.com', role: 'user' });
    authApi.setToken(legacyToken);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({}))
      .mockResolvedValueOnce(buildJsonResponse({
        access_token: SUPABASE_ACCESS_TOKEN,
        refresh_token: 'refresh-token',
      }))
      .mockResolvedValueOnce(buildJsonResponse({
        remaining: 7,
        max: 10,
        characterLimit: 15000,
        flashcardRange: [5, 15],
        canWatchAd: false,
        isPremium: false,
      }));

    await expect(authApi.getAILimits()).resolves.toMatchObject({ remaining: 7 });

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/auth/supabase-token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${legacyToken}`,
        }),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      'https://supabase.test/functions/v1/ai-limits',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        }),
      }),
    );
  });

  it.each([401, 403])('forces reauthentication after a %i legacy bridge rejection', async (status) => {
    const legacyToken = buildLegacyJwt({ id: 7, email: 'atlas@example.com', role: 'user' });
    authApi.setToken(legacyToken);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({}))
      .mockResolvedValueOnce(buildErrorResponse(status, { error: 'Invalid legacy token' }));

    await expect(authApi.getAILimits()).rejects.toMatchObject({
      status: 401,
      code: authApi.AUTH_SESSION_EXPIRED_CODE,
    });

    expect(authApi.getToken()).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('preserves the legacy session when the auth bridge returns a server error', async () => {
    const legacyToken = buildLegacyJwt({ id: 7, email: 'atlas@example.com', role: 'user' });
    authApi.setToken(legacyToken);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({}))
      .mockResolvedValueOnce(buildErrorResponse(500, { error: 'Bridge unavailable' }));

    await expect(authApi.getAILimits()).rejects.toMatchObject({
      status: 500,
      message: 'Bridge unavailable',
    });

    expect(authApi.getToken()).toBe(legacyToken);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('preserves the legacy session when the auth bridge is temporarily unavailable', async () => {
    const legacyToken = buildLegacyJwt({ id: 7, email: 'atlas@example.com', role: 'user' });
    authApi.setToken(legacyToken);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({}))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(authApi.getAILimits()).rejects.toThrow('Failed to fetch');

    expect(authApi.getToken()).toBe(legacyToken);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('hydrates a missing Supabase session from a cross-origin auth bridge using the returned csrf token', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    vi.stubEnv('VITE_API_URL', 'https://legacy.riven.test/api');
    authApi.setToken('legacy-token');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({
        ok: true,
        csrfToken: 'csrf-token-123',
      }))
      .mockResolvedValueOnce(buildJsonResponse({
        access_token: SUPABASE_ACCESS_TOKEN,
        refresh_token: 'refresh-token',
      }))
      .mockResolvedValueOnce(buildJsonResponse({
        remaining: 7,
        max: 10,
        characterLimit: 15000,
        flashcardRange: [5, 15],
        canWatchAd: false,
        isPremium: false,
      }));

    const result = await authApi.getAILimits();

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://legacy.riven.test/api/csrf',
      expect.objectContaining({
        credentials: 'include',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'https://legacy.riven.test/api/auth/supabase-token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer legacy-token',
          'x-csrf-token': 'csrf-token-123',
        }),
      }),
    );
    expect(supabase.auth.setSession).toHaveBeenCalledWith({
      access_token: SUPABASE_ACCESS_TOKEN,
      refresh_token: 'refresh-token',
    });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      'https://supabase.test/functions/v1/ai-limits',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
          'x-supabase-auth': SUPABASE_ACCESS_TOKEN,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
    expect(result).toEqual({
      remaining: 7,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
      isPremium: false,
    });
  });

  it('changes the password through Supabase when the current session is Supabase-backed', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'supabase-token' } },
      error: null,
    });

    const result = await authApi.changePassword('current-password', 'new-password-123');

    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'Password changed successfully' });
  });

  it('resets the password from a Supabase recovery hash without calling the legacy endpoint', async () => {
    const result = await authApi.resetPassword('supabase-hash', 'new-password-123');

    expect(supabase.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'supabase-hash',
      type: 'recovery',
      options: {
        redirectTo: 'http://localhost:3000/reset-password',
      },
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({ password: 'new-password-123' });
    expect(sessionStorage.getItem('riven_auth_token')).toBe('recovery-token');
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result).toEqual({
      message: 'Password has been reset successfully. You can now log in.',
    });
  });

  it('keeps the legacy reset flow for old hex reset tokens', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Password has been reset successfully. You can now log in.',
    }));

    const result = await authApi.resetPassword('a'.repeat(64), 'new-password-123');

    expect(supabase.auth.verifyOtp).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/reset-password',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
        }),
        body: JSON.stringify({ token: 'a'.repeat(64), password: 'new-password-123' }),
      }),
    );
    expect(result).toEqual({
      message: 'Password has been reset successfully. You can now log in.',
    });
  });

  it('surfaces reset-password edge errors when the function is unavailable', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: {
          get: () => 'application/json',
        },
        text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'Function not found' })),
      })
      .mockResolvedValueOnce(buildJsonResponse({
        message: 'Password has been reset successfully. You can now log in.',
      }));

    await expect(authApi.resetPassword('a'.repeat(64), 'new-password-123')).rejects.toThrow('Function not found');

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/reset-password',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

});
