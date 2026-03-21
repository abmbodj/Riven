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

import { supabase } from '../lib/supabaseClient';
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

describe('authApi shared resource acceptance edge migration', () => {
  const setSupabaseSession = (token) => {
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: token,
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    localStorage.clear();
    authApi.setToken(null);
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the accept-shared-resource edge function for Supabase session tokens', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      kind: 'deck',
      resource: { id: 99, title: 'Biology' },
      messageId: 18,
    }));

    const result = await authApi.acceptSharedResource(18);

    expect(result).toEqual({
      kind: 'deck',
      resource: { id: 99, title: 'Biology' },
      messageId: 18,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/accept-shared-resource',
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

  it('keeps acceptSharedDeck working through the generic shared resource helper', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      kind: 'deck',
      resource: { id: 99, title: 'Biology' },
      messageId: 18,
    }));

    const result = await authApi.acceptSharedDeck(18);

    expect(result).toEqual({
      kind: 'deck',
      resource: { id: 99, title: 'Biology' },
      messageId: 18,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/accept-shared-resource',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('falls back to the legacy Express route when the edge function is unavailable', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseSession(token);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        kind: 'guide',
        resource: { id: 'guide-copy', title: 'Biology Guide' },
        messageId: 18,
      }));

    const result = await authApi.acceptSharedResource(18);

    expect(result).toEqual({
      kind: 'guide',
      resource: { id: 'guide-copy', title: 'Biology Guide' },
      messageId: 18,
    });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/accept-shared-resource',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/messages/18/accept-share'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});
