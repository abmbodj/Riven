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

describe('authApi referrals edge migration', () => {
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

  it('uses the referrals edge function for Supabase session tokens', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
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
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
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

  it('uses the legacy Express route for non-Supabase tokens', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'test@example.com', role: 'user' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      referralCode: 'RIVEN123',
      referrals: [],
      qualifiedCount: 0,
      targetCount: 5,
      rewardEarned: false,
    }));

    await authApi.getReferralInfo();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/referrals/me'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
        }),
      }),
    );
  });

  it('falls back to the legacy Express route when the referrals edge function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        qualified: true,
        hasDeck: true,
        sessions: 12,
      }));

    const result = await authApi.checkReferralQualification();

    expect(result).toEqual({ qualified: true, hasDeck: true, sessions: 12 });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/referrals',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'check-qualification' }),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/referrals/check-qualification'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
