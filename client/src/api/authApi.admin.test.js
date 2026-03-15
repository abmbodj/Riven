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

describe('authApi admin edge migration', () => {
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

  it('uses the admin edge function for Supabase admin user lists', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse([
      { id: 7, username: 'riven', email: 'riven@example.com', role: 'admin' },
    ]));

    const users = await authApi.adminGetAllUsers();

    expect(users).toEqual([
      { id: 7, username: 'riven', email: 'riven@example.com', role: 'admin' },
    ]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/admin-actions?action=users',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('sends role updates through the admin edge function for Supabase sessions', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      id: 12,
      username: 'sam',
      role: 'admin',
      isAdmin: true,
      subscriptionTier: 'free',
    }));

    const result = await authApi.adminUpdateUserRole(12, 'admin');

    expect(result).toEqual({
      id: 12,
      username: 'sam',
      role: 'admin',
      isAdmin: true,
      subscriptionTier: 'free',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/admin-actions',
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ action: 'user-role', userId: 12, role: 'admin' }),
      }),
    );
  });

  it('uses the legacy Express stats route for non-Supabase tokens', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'owner@example.com', role: 'owner' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      users: 10,
      decks: 20,
      cards: 100,
    }));

    const stats = await authApi.adminGetStats();

    expect(stats).toEqual({ users: 10, decks: 20, cards: 100 });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/stats'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
        }),
      }),
    );
  });

  it('falls back to the legacy Express delete route when the admin edge function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({ message: 'Message deleted' }));

    const result = await authApi.adminDeleteMessage(44);

    expect(result).toEqual({ message: 'Message deleted' });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/admin-actions',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ action: 'message-delete', messageId: 44 }),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/admin/messages/44'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('normalizes legacy report username fields after edge fallback', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse([
        {
          id: 9,
          reporter_name: 'Alice',
          reported_name: 'Bob',
          resolver_name: null,
          status: 'pending',
          content_type: 'user',
          created_at: '2026-03-01T00:00:00.000Z',
          reported_user_id: 18,
          reason: 'Spam',
          details: null,
        },
      ]));

    const reports = await authApi.adminGetReports();

    expect(reports).toEqual([
      expect.objectContaining({
        reporter_name: 'Alice',
        reported_name: 'Bob',
        reporter_username: 'Alice',
        reported_username: 'Bob',
      }),
    ]);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/admin-actions?action=reports',
      expect.objectContaining({
        method: 'GET',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/admin/reports'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
        }),
      }),
    );
  });
});
