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
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null }),
    },
  },
}));

import * as authApi from './authApi';
import { supabase } from '../lib/supabaseClient';

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

describe('authApi referrals edge migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_ENABLE_LEGACY_AUTH_BRIDGE', '');
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    localStorage.clear();
    authApi.setToken(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the referrals edge function for Supabase session tokens', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      referralCode: 'RIVEN123',
      referrals: [],
      qualifiedCount: 0,
      targetCount: 5,
      rewardEarned: false,
    }));

    const info = await authApi.getReferralInfo();

    expect(info).toEqual({
      referralCode: 'RIVEN123',
      referrals: [],
      qualifiedCount: 0,
      targetCount: 5,
      rewardEarned: false,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/referrals?action=me',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('posts referral applications through the referrals edge function for Supabase session tokens', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Referral code applied!',
    }));

    const result = await authApi.applyReferralCode('riven123');

    expect(result).toEqual({ message: 'Referral code applied!' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/referrals',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'apply', code: 'riven123' }),
      }),
    );
  });

  it('forces re-login for non-Supabase tokens on referrals', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'test@example.com', role: 'user' }));
    globalThis.fetch = vi.fn();

    await expect(authApi.getReferralInfo()).rejects.toMatchObject({
      status: 401,
      code: authApi.AUTH_SESSION_EXPIRED_CODE,
      message: 'Session expired. Please sign in again.',
    });

    expect(authApi.getToken()).toBeNull();

    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('surfaces edge errors when the referrals function is unavailable', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }));

    await expect(authApi.checkReferralQualification()).rejects.toMatchObject({
      status: 404,
      message: 'Function not found',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/referrals',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'check-qualification' }),
      }),
    );
  });
});
