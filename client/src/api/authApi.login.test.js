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
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null }),
      signInWithOAuth: vi.fn(),
      signInWithPassword: vi.fn(),
      signInWithIdToken: vi.fn(),
      signUp: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        getAuthenticatorAssuranceLevel: vi.fn(),
        listFactors: vi.fn(),
        challengeAndVerify: vi.fn(),
        enroll: vi.fn(),
        unenroll: vi.fn(),
      },
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

const SUPABASE_ACCESS_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwic3ViIjoiYXV0aC11c2VyIiwiZXhwIjo0MTAyNDQ0ODAwfQ.sig';

const jsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const errorJsonResponse = (status, body) => ({
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

describe('authApi login migration bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    localStorage.clear();
    document.cookie = 'riven_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
    authApi.setToken(null);
    supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal1' },
      error: null,
    });
    supabase.auth.mfa.listFactors.mockResolvedValue({
      data: { all: [], totp: [] },
      error: null,
    });
    supabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'auth-user' } },
      error: null,
    });
    supabase.auth.updateUser.mockResolvedValue({
      data: { user: { id: 'auth-user' } },
      error: null,
    });
  });

  it('starts Google OAuth with an account redirect target', async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
      error: null,
    });

    await authApi.startGoogleOAuth();

    expect(supabase.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: 'http://localhost:3000/account',
      },
    });
  });

  it('stores the mobile Google OAuth persistence preference before redirect', async () => {
    supabase.auth.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/v2/auth' },
      error: null,
    });

    await authApi.startGoogleOAuth({ keepSignedIn: false });

    expect(sessionStorage.getItem('riven_auth_persistence')).toBe('session');
    expect(localStorage.getItem('riven_auth_persistence')).toBeNull();
  });

  it('stores successful password login tokens durably when keep-signed-in is enabled', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: false },
    }));

    await authApi.login('test@example.com', 'password123', { keepSignedIn: true });

    expect(localStorage.getItem('riven_auth_token')).toBe(SUPABASE_ACCESS_TOKEN);
    expect(sessionStorage.getItem('riven_auth_token')).toBeNull();
  });

  it('stores successful password login tokens in session storage when keep-signed-in is disabled', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({
      user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: false },
    }));

    await authApi.login('test@example.com', 'password123', { keepSignedIn: false });

    expect(sessionStorage.getItem('riven_auth_token')).toBe(SUPABASE_ACCESS_TOKEN);
    expect(localStorage.getItem('riven_auth_token')).toBeNull();
  });

  it('starts MFA state lookup while completing Supabase account setup', async () => {
    const events = [];
    let resolveRegistration;

    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });
    supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockImplementation(() => {
      events.push('mfa-aal');
      return Promise.resolve({
        data: { currentLevel: 'aal1', nextLevel: 'aal1' },
        error: null,
      });
    });
    supabase.auth.mfa.listFactors.mockImplementation(() => {
      events.push('mfa-factors');
      return Promise.resolve({
        data: { all: [], totp: [] },
        error: null,
      });
    });
    globalThis.fetch = vi.fn().mockImplementation(() => {
      events.push('registration-requested');
      return new Promise((resolve) => {
        resolveRegistration = () => {
          events.push('registration-resolved');
          resolve(jsonResponse({
            user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: false },
          }));
        };
      });
    });

    const loginPromise = authApi.login('test@example.com', 'password123');

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toContain('registration-requested');
    expect(events).toContain('mfa-aal');
    expect(events).not.toContain('registration-resolved');

    resolveRegistration();

    await expect(loginPromise).resolves.toEqual({
      user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: false },
    });
  });

  it('bootstraps a Supabase session after a successful legacy login fallback', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });
    supabase.auth.signUp.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        csrfToken: 'csrf-token',
      }))
      .mockResolvedValueOnce(jsonResponse({
        token: 'legacy-token',
        user: { id: 7, email: 'test@example.com' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        user: { id: 7, email: 'test@example.com', username: 'tester' },
      }));

    const result = await authApi.login('test@example.com', 'password123');

    expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
      password: 'password123',
    }));
    expect(result).toEqual({
      user: { id: 7, email: 'test@example.com', username: 'tester' },
    });
    expect(sessionStorage.getItem('riven_auth_token')).toBe(SUPABASE_ACCESS_TOKEN);
  });

  it('restores a Supabase session on refresh by completing account setup when the bridge is missing', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
    });
    const { select } = createSelectSingleChain(null, {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    });
    supabase.from.mockReturnValue({ select });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        user: { id: 7, email: 'test@example.com', username: 'tester' },
      }));

    const user = await authApi.restoreSessionUser();

    expect(user).toEqual({ id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: false });
    expect(sessionStorage.getItem('riven_auth_token')).toBe(SUPABASE_ACCESS_TOKEN);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/functions/v1/complete-registration'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
        }),
      }),
    );
  });

  it('returns a Supabase MFA challenge when a verified factor still needs verification', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
    });
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });
    supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
      data: { currentLevel: 'aal1', nextLevel: 'aal2' },
      error: null,
    });
    supabase.auth.mfa.listFactors.mockResolvedValue({
      data: {
        all: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }],
        totp: [{ id: 'factor-1', factor_type: 'totp', status: 'verified' }],
      },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: false },
    }));

    const result = await authApi.login('test@example.com', 'password123');

    expect(result).toEqual({
      require2FA: true,
      provider: 'supabase',
      factorId: 'factor-1',
    });
    expect(sessionStorage.getItem('riven_auth_token')).toBe(SUPABASE_ACCESS_TOKEN);
  });

  it('keeps existing Google OAuth users signed in when complete-registration is temporarily unavailable', async () => {
    supabase.auth.signInWithIdToken.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });
    const { select } = createSelectSingleChain({
      id: 7,
      username: 'tester',
      email: 'test@example.com',
      two_fa_enabled: false,
    });
    supabase.from.mockReturnValue({ select });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(errorJsonResponse(503, {
      error: 'registration unavailable',
    }));

    const result = await authApi.loginWithGoogle('google-id-token');

    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'google-id-token',
    });
    expect(result).toMatchObject({
      user: {
        id: 7,
        email: 'test@example.com',
        username: 'tester',
        twoFAEnabled: false,
      },
    });
    expect(sessionStorage.getItem('riven_auth_token')).toBe(SUPABASE_ACCESS_TOKEN);
  });

  it('falls back to the legacy 2FA challenge for existing linked users without a Supabase factor', async () => {
    document.cookie = 'riven_csrf=test-csrf-token; path=/';
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
    });
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: true },
      }))
      .mockResolvedValueOnce(jsonResponse({
        require2FA: true,
        tempToken: 'legacy-temp-token',
      }));

    const result = await authApi.login('test@example.com', 'password123');

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(result).toEqual({
      require2FA: true,
      tempToken: 'legacy-temp-token',
      provider: 'legacy',
    });
  });

  it('bridges Google OAuth sessions into the legacy 2FA challenge when needed on restore', async () => {
    document.cookie = 'riven_csrf=test-csrf-token; path=/';
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: SUPABASE_ACCESS_TOKEN,
          provider_token: 'google-provider-token',
          user: {
            app_metadata: { provider: 'google' },
          },
        },
      },
    });

    const { select } = createSelectSingleChain(null, {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    });
    supabase.from.mockReturnValue({ select });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: true },
      }))
      .mockResolvedValueOnce(jsonResponse({
        require2FA: true,
        tempToken: 'legacy-temp-token',
      }));

    const result = await authApi.restoreSessionUser();

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/auth/oauth/google'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ credential: 'google-provider-token' }),
      }),
    );
    expect(result).toEqual({
      require2FA: true,
      tempToken: 'legacy-temp-token',
      provider: 'legacy',
    });
  });

  it('clears the Google OAuth bridge state when legacy 2FA cannot be bridged', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: SUPABASE_ACCESS_TOKEN,
          user: {
            app_metadata: { provider: 'google' },
          },
        },
      },
    });

    const { select } = createSelectSingleChain(null, {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    });
    supabase.from.mockReturnValue({ select });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: true },
    }));

    const result = await authApi.restoreSessionUser();

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(result).toBeNull();
    expect(sessionStorage.getItem('riven_auth_token')).toBeNull();
  });

  it('applies the persistence option when completing legacy 2FA', async () => {
    document.cookie = 'riven_csrf=test-csrf-token; path=/';
    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      token: 'legacy-session-token',
      user: { id: 7, email: 'test@example.com', username: 'tester' },
    }));

    const user = await authApi.login2FA({ provider: 'legacy', tempToken: 'temp-token' }, '123456', {
      keepSignedIn: false,
    });

    expect(user).toEqual({ id: 7, email: 'test@example.com', username: 'tester' });
    expect(sessionStorage.getItem('riven_auth_token')).toBe('legacy-session-token');
    expect(localStorage.getItem('riven_auth_token')).toBeNull();
  });

  it('passes the Apple nonce into Supabase and persists first-time Apple name metadata', async () => {
    supabase.auth.signInWithIdToken.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce(jsonResponse({
      user: {
        id: 7,
        email: 'test@example.com',
        username: 'tester',
        twoFAEnabled: false,
      },
    }));

    const result = await authApi.loginWithApple('apple-id-token', 'raw-nonce', {
      givenName: 'Avery',
      familyName: 'Stone',
      fullName: 'Avery Stone',
      name: { firstName: 'Avery', lastName: 'Stone' },
    });

    expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: 'raw-nonce',
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      data: {
        full_name: 'Avery Stone',
        given_name: 'Avery',
        family_name: 'Stone',
      },
    });
    expect(result).toEqual({
      user: {
        id: 7,
        email: 'test@example.com',
        username: 'tester',
        twoFAEnabled: false,
      },
    });
  });

  it('falls back to the legacy Apple 2FA bridge with the normalized Apple name payload', async () => {
    document.cookie = 'riven_csrf=test-csrf-token; path=/';
    supabase.auth.signInWithIdToken.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        user: { id: 7, email: 'test@example.com', username: 'tester', twoFAEnabled: true },
      }))
      .mockResolvedValueOnce(jsonResponse({
        require2FA: true,
        tempToken: 'legacy-temp-token',
      }));

    const result = await authApi.loginWithApple('apple-id-token', 'raw-nonce', {
      givenName: 'Avery',
      familyName: 'Stone',
      name: { firstName: 'Avery', lastName: 'Stone' },
    });

    expect(supabase.auth.signOut).toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/auth/oauth/apple'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          identityToken: 'apple-id-token',
          user: {
            name: {
              firstName: 'Avery',
              lastName: 'Stone',
            },
          },
        }),
      }),
    );
    expect(result).toEqual({
      require2FA: true,
      tempToken: 'legacy-temp-token',
      provider: 'legacy',
    });
  });
});
