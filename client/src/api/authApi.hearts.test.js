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

describe('authApi hearts edge migration', () => {
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

  it('uses the hearts edge function for Supabase session tokens', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      hearts: 40,
      max: 40,
      isUnlimited: false,
    }));

    const status = await authApi.getHeartsStatus();

    expect(status).toEqual({ hearts: 40, max: 40, isUnlimited: false });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/hearts?action=status',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('uses the legacy Express route for non-Supabase tokens', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'test@example.com', role: 'user' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      hearts: 12,
      max: 40,
      isUnlimited: false,
    }));

    await authApi.getHeartsStatus();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/users/hearts/status'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
        }),
      }),
    );
  });

  it('falls back to the legacy Express route when the hearts edge function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        hearts: 9,
        max: 40,
        isUnlimited: false,
      }));

    const status = await authApi.getHeartsStatus();

    expect(status).toEqual({ hearts: 9, max: 40, isUnlimited: false });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/hearts?action=status',
      expect.any(Object),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/users/hearts/status'),
      expect.any(Object),
    );
  });
});
