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

describe('authApi AI edge migration', () => {
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

  it('uses the AI limits edge function for Supabase sessions', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      remaining: 9,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
    }));

    const result = await authApi.getAILimits();

    expect(result).toEqual({
      remaining: 9,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/ai-limits',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('uses the generate-deck edge function for Supabase sessions', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Deck generated successfully',
      deck_id: 55,
      card_count: 12,
    }));

    const result = await authApi.generateAiDeck('Biology notes', { data: 'abc', mimeType: 'text/plain' }, 'Bio', 'class-1');

    expect(result).toEqual({
      message: 'Deck generated successfully',
      deck_id: 55,
      card_count: 12,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/generate-deck',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          notes: 'Biology notes',
          file: { data: 'abc', mimeType: 'text/plain' },
          deckName: 'Bio',
          classId: 'class-1',
        }),
      }),
    );
  });

  it('surfaces edge errors when the generate-class function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }));

    await expect(
      authApi.generateAiClass('Syllabus notes', { data: 'abc', mimeType: 'application/pdf' })
    ).rejects.toMatchObject({
      status: 404,
      message: 'Function not found',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/generate-class',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          notes: 'Syllabus notes',
          file: { data: 'abc', mimeType: 'application/pdf' },
        }),
      }),
    );
  });

  it('forces re-login for non-Supabase tokens on AI limits', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'user@example.com', role: 'user' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildErrorResponse(401, { error: 'Missing bearer token' }));

    await expect(authApi.getAILimits()).rejects.toMatchObject({
      status: 401,
      code: authApi.AUTH_SESSION_EXPIRED_CODE,
      message: 'Session expired. Please sign in again.',
    });

    expect(authApi.getToken()).toBeNull();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/ai-limits',
      expect.objectContaining({
        headers: expect.objectContaining({
          apikey: 'supabase-anon-key',
        }),
      }),
    );

    const requestOptions = globalThis.fetch.mock.calls[0][1];
    expect(requestOptions.headers.Authorization).toBeUndefined();
  });
});
