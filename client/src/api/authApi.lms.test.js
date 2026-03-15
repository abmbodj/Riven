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

describe('authApi Canvas LMS edge migration', () => {
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

  it('uses the Canvas LMS edge function for Supabase connect requests', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Canvas connected successfully.',
    }));

    const result = await authApi.connectCanvas('https://canvas.example.edu/feeds/calendars/user_1.ics');

    expect(result).toEqual({ message: 'Canvas connected successfully.' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'connect',
          icalUrl: 'https://canvas.example.edu/feeds/calendars/user_1.ics',
        }),
      }),
    );
  });

  it('uses the Canvas LMS edge function for Supabase disconnect requests', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Canvas disconnected.',
    }));

    const result = await authApi.disconnectCanvas();

    expect(result).toEqual({ message: 'Canvas disconnected.' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'disconnect' }),
      }),
    );
  });

  it('falls back to the legacy sync route when the Canvas LMS edge function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({
        message: 'Canvas sync complete!',
        classesAdded: 2,
        assignmentsAdded: 5,
      }));

    const result = await authApi.syncCanvas(false);

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 2,
      assignmentsAdded: 5,
    });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'sync', adGranted: false }),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/lms/sync'),
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('uses the legacy connect route for non-Supabase tokens', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'test@example.com', role: 'user' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Canvas connected successfully.',
    }));

    await authApi.connectCanvas('https://canvas.example.edu/feeds/calendars/user_1.ics');

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/lms/canvas/connect'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
        }),
      }),
    );
  });
});
