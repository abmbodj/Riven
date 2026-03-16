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
      signInWithPassword: vi.fn(),
      signInWithIdToken: vi.fn(),
      signUp: vi.fn(),
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

const createSelectSingleChain = (data, error = null) => {
  const single = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, single };
};

describe('authApi login migration bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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
  });

  it('bootstraps a Supabase session after a successful legacy login fallback', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    supabase.auth.signUp.mockResolvedValue({
      data: { session: { access_token: SUPABASE_ACCESS_TOKEN } },
      error: null,
    });

    globalThis.fetch = vi
      .fn()
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

  it('falls back to the legacy 2FA challenge for existing linked users without a Supabase factor', async () => {
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
});
