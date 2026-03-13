/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

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
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

const jsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe('authApi login migration bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authApi.setToken(null);
  });

  it('bootstraps a Supabase session after a successful legacy login fallback', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { message: 'Invalid login credentials' },
    });
    supabase.auth.signUp.mockResolvedValue({
      data: { session: { access_token: 'supabase-token' } },
      error: null,
    });

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({
        token: 'legacy-token',
        user: { id: 7, email: 'test@example.com' },
      }))
      .mockResolvedValueOnce(jsonResponse({
        user: { id: 7, email: 'test@example.com', username: 'tester' },
      }));

    const result = await authApi.login('test@example.com', 'password123');

    expect(supabase.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
      email: 'test@example.com',
      password: 'password123',
    }));
    expect(result).toEqual({
      user: { id: 7, email: 'test@example.com', username: 'tester' },
    });
    expect(localStorage.getItem('riven_auth_token')).toBe('supabase-token');
  });
});
