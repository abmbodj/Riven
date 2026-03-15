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

describe('authApi shared deck acceptance edge migration', () => {
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

  it('uses the accept-shared-deck edge function for Supabase session tokens', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      newDeck: { id: 99, title: 'Biology' },
      messageId: 18,
    }));

    const result = await authApi.acceptSharedDeck(18);

    expect(result).toEqual({
      newDeck: { id: 99, title: 'Biology' },
      messageId: 18,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/accept-shared-deck',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ messageId: 18 }),
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('falls back to the legacy Express route when the edge function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        newDeck: { id: 99, title: 'Biology' },
        messageId: 18,
      }));

    const result = await authApi.acceptSharedDeck(18);

    expect(result).toEqual({
      newDeck: { id: 99, title: 'Biology' },
      messageId: 18,
    });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/accept-shared-deck',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/messages/18/accept-deck'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
