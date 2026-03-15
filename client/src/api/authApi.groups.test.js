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
    rpc: vi.fn(),
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

describe('authApi group edge migration', () => {
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

  it('uses the group edge function for Supabase group creation', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      id: 'group-1',
      name: 'Biology Lab',
      join_code: 'RIV-ABC',
      member_count: 1,
      role: 'admin',
    }));

    const result = await authApi.createGroup('Biology Lab', 'class-1');

    expect(result).toEqual({
      id: 'group-1',
      name: 'Biology Lab',
      join_code: 'RIV-ABC',
      member_count: 1,
      role: 'admin',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/group-actions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'group-create',
          name: 'Biology Lab',
          class_id: 'class-1',
        }),
      }),
    );
  });

  it('uses the group edge function for Supabase join requests', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Successfully joined group',
      group: {
        id: 'group-2',
        name: 'Organic Chem',
      },
    }));

    const result = await authApi.joinGroup('riv-9k2');

    expect(result).toEqual({
      message: 'Successfully joined group',
      group: {
        id: 'group-2',
        name: 'Organic Chem',
      },
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/group-actions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'group-join',
          join_code: 'riv-9k2',
        }),
      }),
    );
  });

  it('falls back to the legacy member removal route when the edge function is unavailable', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }))
      .mockResolvedValueOnce(buildJsonResponse({ message: 'User removed successfully' }));

    const result = await authApi.removeGroupMember('group-1', 12);

    expect(result).toEqual({ message: 'User removed successfully' });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/group-actions',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({
          action: 'group-member-remove',
          groupId: 'group-1',
          userId: 12,
        }),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/api/groups/group-1/members/12'),
      expect.objectContaining({
        method: 'DELETE',
      }),
    );
  });

  it('uses the legacy deck-sharing route for non-Supabase tokens', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'user@example.com', role: 'user' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Deck shared successfully',
    }));

    await authApi.shareDeckToGroup('group-1', 44);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/groups/group-1/decks'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
        }),
      }),
    );
  });

  it('uses the group edge function for file uploads', async () => {
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      id: 'file-1',
      name: 'notes.pdf',
      file_url: 'https://supabase.test/storage/v1/object/public/group-files/group-1/notes.pdf',
      file_type: 'pdf',
      folder_id: null,
    }));

    const result = await authApi.uploadGroupFile('group-1', {
      name: 'notes.pdf',
      file_url: 'https://supabase.test/storage/v1/object/public/group-files/group-1/notes.pdf',
      file_type: 'pdf',
      folder_id: null,
    });

    expect(result).toEqual({
      id: 'file-1',
      name: 'notes.pdf',
      file_url: 'https://supabase.test/storage/v1/object/public/group-files/group-1/notes.pdf',
      file_type: 'pdf',
      folder_id: null,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/group-actions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'group-file-upload',
          groupId: 'group-1',
          name: 'notes.pdf',
          file_url: 'https://supabase.test/storage/v1/object/public/group-files/group-1/notes.pdf',
          file_type: 'pdf',
          folder_id: null,
        }),
      }),
    );
  });
});
