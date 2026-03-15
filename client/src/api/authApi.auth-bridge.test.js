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

const buildJsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const createSelectSingleChain = (data, error = null) => {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  return { select, single };
};

describe('authApi Supabase auth bridge reductions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      data: { session: { access_token: 'supabase-token' } },
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
    });
  });

  it('completes registration on refresh when the Supabase session exists but the app row is missing', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'supabase-token' } },
      error: null,
    });

    const { select } = createSelectSingleChain(null, {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    });
    supabase.from.mockReturnValue({ select });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      user: { id: 42, email: 'atlas@example.com', username: 'atlas' },
    }));

    const user = await authApi.restoreSessionUser();

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/complete-registration'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer supabase-token',
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
    expect(localStorage.getItem('riven_auth_token')).toBe('recovery-token');
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

  it('falls back to the legacy reset route when the reset-password edge function is unavailable', async () => {
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

    const result = await authApi.resetPassword('a'.repeat(64), 'new-password-123');

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/reset-password',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/auth/reset-password'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'a'.repeat(64), password: 'new-password-123' }),
      }),
    );
    expect(result).toEqual({
      message: 'Password has been reset successfully. You can now log in.',
    });
  });

  it('resends email verification through Supabase when the user has an active Supabase session', async () => {
    supabase.auth.getSession.mockResolvedValue({
      data: { session: { access_token: 'supabase-token' } },
      error: null,
    });

    const { select } = createSelectSingleChain({
      id: 42,
      username: 'atlas',
      display_name: 'Atlas',
      email: 'atlas@example.com',
      share_code: 'ABCD1234',
      avatar: null,
      banner: null,
      bio: '',
      streak_data: '{}',
      pet_customization: '{}',
      role: 'user',
      is_admin: 0,
      created_at: '2026-03-14T18:00:00.000Z',
      two_fa_enabled: false,
      subscription_tier: 'free',
      simulate_free_tier: false,
      email_verified: false,
    });
    supabase.from.mockReturnValue({ select });

    const result = await authApi.sendVerificationEmail();

    expect(supabase.auth.resend).toHaveBeenCalledWith({
      email: 'atlas@example.com',
      type: 'signup',
      options: {
        emailRedirectTo: 'http://localhost:3000/verify-email',
      },
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result).toEqual({ message: 'Verification email sent' });
  });
});
