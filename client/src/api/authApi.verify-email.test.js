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

describe('authApi verify email edge migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    localStorage.clear();
    document.cookie = 'riven_csrf=test-csrf-token; path=/';
    authApi.setToken(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the verify-email edge function for Supabase token hashes', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Email verified successfully',
    }));

    const result = await authApi.verifyEmail('signup-hash');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/verify-email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
        }),
        body: JSON.stringify({ token: 'signup-hash' }),
      }),
    );
    expect(result).toEqual({ message: 'Email verified successfully' });
  });

  it('uses the verify-email edge function for historical hex tokens too', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Email verified successfully',
    }));

    const result = await authApi.verifyEmail('a'.repeat(64));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/verify-email',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
        }),
        body: JSON.stringify({ token: 'a'.repeat(64) }),
      }),
    );
    expect(result).toEqual({ message: 'Email verified successfully' });
  });

  it('falls back to the legacy route when the verify-email edge function is unavailable', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        message: 'Email verified successfully',
      }));

    const result = await authApi.verifyEmail('signup-hash');

    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/verify-email',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/auth/verify-email'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'signup-hash' }),
      }),
    );
    expect(result).toEqual({ message: 'Email verified successfully' });
  });
});
