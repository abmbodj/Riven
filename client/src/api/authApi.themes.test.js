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
import { getDefaultThemes } from '../themeCatalog.js';

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

  it('syncs missing default themes for authenticated users before returning results', async () => {
    authApi.setToken('supabase-token');

    const defaultThemes = getDefaultThemes();
    const initialThemes = [
      { id: 1, ...defaultThemes.find((theme) => theme.name === 'Riven') },
      { id: 2, name: 'Custom Drift', is_default: 0, is_active: 0 },
    ];
    const syncedThemes = [
      ...defaultThemes.map((theme, index) => ({ id: index + 10, ...theme })),
      { id: 2, name: 'Custom Drift', is_default: 0, is_active: 0 },
    ];

    const select = vi.fn()
      .mockResolvedValueOnce({ data: initialThemes, error: null })
      .mockResolvedValueOnce({ data: syncedThemes, error: null });
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    supabase.from.mockImplementation(() => ({ select, insert, update }));

    const themes = await authApi.getThemes();

    expect(select).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenCalledTimes(defaultThemes.length - 1);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      name: 'Riven Light',
      is_default: 1,
    }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      name: 'Lavender Dusk',
      is_default: 1,
    }));
    expect(themes.filter((theme) => theme.is_default)).toHaveLength(defaultThemes.length);
    expect(themes.some((theme) => theme.name === 'Tech Innovation')).toBe(true);
    expect(themes.some((theme) => theme.name === 'Lavender Dusk')).toBe(true);
  });

  it('removes deprecated default themes and reactivates Riven when cleanup leaves no active theme', async () => {
    authApi.setToken('supabase-token');
    const defaultThemes = getDefaultThemes();
    const rivenTheme = defaultThemes.find((theme) => theme.name === 'Riven');

    const select = vi.fn()
      .mockResolvedValueOnce({
        data: [
          { id: 1, name: 'Rose', is_default: 1, is_active: 1 },
          { id: 2, ...rivenTheme, is_default: 1, is_active: 0 },
          { id: 3, name: 'Custom Drift', is_default: 0, is_active: 0 },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          { id: 2, ...rivenTheme, is_default: 1, is_active: 0 },
          { id: 3, name: 'Custom Drift', is_default: 0, is_active: 0 },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          ...defaultThemes.map((theme, index) => ({
            id: index + 10,
            ...theme,
            is_active: theme.name === 'Riven' ? 1 : theme.is_active,
          })),
          { id: 3, name: 'Custom Drift', is_default: 0, is_active: 0 },
        ],
        error: null,
      });

    const deleteIn = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteTheme = vi.fn().mockReturnValue({ in: deleteIn });
    const insert = vi.fn().mockResolvedValue({ data: null, error: null });
    const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const update = vi.fn().mockReturnValue({ eq: updateEq });

    supabase.from.mockImplementation(() => ({ select, delete: deleteTheme, insert, update }));

    const themes = await authApi.getThemes();

    expect(deleteTheme).toHaveBeenCalledTimes(1);
    expect(deleteIn).toHaveBeenCalledWith('id', [1]);
    expect(insert).toHaveBeenCalledTimes(defaultThemes.length - 1);
    expect(update).toHaveBeenCalledWith({ is_active: 1 });
    expect(updateEq).toHaveBeenCalledWith('id', 2);
    expect(themes.filter((theme) => theme.is_default)).toHaveLength(defaultThemes.length);
    expect(themes.find((theme) => theme.is_active)?.name).toBe('Riven');
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
      effect_preset: 'none',
      effect_intensity: 'soft',
      background_style: 'solid',
      gradient_colors: [],
      gradient_angle: 135,
      gradient_intensity: 'medium',
    }));
  });

  it('updates custom themes with gradient recipe fields', async () => {
    authApi.setToken('supabase-token');

    const single = vi.fn().mockResolvedValue({ data: { id: 7, name: 'Rain Signal' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ update });

    await authApi.updateTheme(7, {
      name: 'Rain Signal',
      background_style: 'gradient',
      gradient_colors: ['#071417', '#0d3340', '#52d1c6'],
      gradient_angle: 210,
      gradient_intensity: 'rich',
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Rain Signal',
      background_style: 'gradient',
      gradient_colors: ['#071417', '#0d3340', '#52d1c6'],
      gradient_angle: 210,
      gradient_intensity: 'rich',
    }));
    expect(eq).toHaveBeenCalledWith('id', 7);
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
