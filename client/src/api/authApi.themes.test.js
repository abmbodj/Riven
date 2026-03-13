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

const createSelectSingleChain = (data) => {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ single });
  return { select, single };
};

describe('authApi themes PostgREST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authApi.setToken(null);
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({
      id: 42,
      email: 'test@example.com',
      subscription_tier: 'supporter',
    }));
  });

  it('loads themes via Supabase and sorts defaults first', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [
        { id: 2, name: 'Custom Drift', is_default: 0 },
        { id: 1, name: 'Riven', is_default: 1 },
        { id: 3, name: 'Arctic Frost', is_default: 1 },
      ],
      error: null,
    });

    supabase.from.mockReturnValue({ select });

    const themes = await authApi.getThemes();

    expect(select).toHaveBeenCalledWith('*');
    expect(themes.map((theme) => theme.name)).toEqual(['Arctic Frost', 'Riven', 'Custom Drift']);
  });

  it('creates custom themes in Supabase with the current app user id', async () => {
    const { select } = createSelectSingleChain({ id: 7, name: 'Night Current' });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });

    authApi.setToken('supabase-token');
    await authApi.createTheme({
      name: 'Night Current',
      bg_color: '#101a20',
      surface_color: '#16252d',
      text_color: '#edf0ea',
      secondary_text_color: '#8da1a6',
      border_color: '#24343c',
      accent_color: '#cfa76a',
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      name: 'Night Current',
      is_active: 0,
      is_default: 0,
      font_family_display: 'Cormorant Garamond',
      font_family_body: 'Lora',
    }));
  });

  it('activates themes by clearing the previous active theme before setting the new one', async () => {
    authApi.setToken('supabase-token');

    const deactivateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const deactivateUpdate = vi.fn().mockReturnValue({ eq: deactivateEq });

    const { select } = createSelectSingleChain({ id: 99, is_active: 1 });
    const activateEq = vi.fn().mockReturnValue({ select });
    const activateUpdate = vi.fn().mockReturnValue({ eq: activateEq });

    supabase.from
      .mockReturnValueOnce({ update: deactivateUpdate })
      .mockReturnValueOnce({ update: activateUpdate });

    const result = await authApi.activateTheme(99);

    expect(deactivateUpdate).toHaveBeenCalledWith({ is_active: 0 });
    expect(deactivateEq).toHaveBeenCalledWith('user_id', 42);
    expect(activateUpdate).toHaveBeenCalledWith({ is_active: 1 });
    expect(activateEq).toHaveBeenCalledWith('id', 99);
    expect(result).toEqual({ id: 99, is_active: 1 });
  });
});
