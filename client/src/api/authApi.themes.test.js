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
    rpc: vi.fn(),
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

const createSelectChain = (data) => {
  const select = vi.fn().mockResolvedValue({ data, error: null });
  return { select };
};

describe('authApi themes PostgREST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
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

  it('removes deprecated default themes and repairs Riven active when cleanup leaves no active theme', async () => {
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
            is_active: 0,
          })),
          { id: 3, name: 'Custom Drift', is_default: 0, is_active: 0 },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          ...defaultThemes.map((theme, index) => ({
            id: index + 10,
            ...theme,
            is_active: theme.name === 'Riven' ? 1 : 0,
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
    supabase.rpc.mockResolvedValue({
      data: { id: 10, ...rivenTheme, is_active: 1 },
      error: null,
    });

    const themes = await authApi.getThemes();

    expect(deleteTheme).toHaveBeenCalledTimes(1);
    expect(deleteIn).toHaveBeenCalledWith('id', [1]);
    expect(insert).toHaveBeenCalledTimes(defaultThemes.length - 1);
    expect(update).not.toHaveBeenCalledWith({ is_active: 1 });
    expect(supabase.rpc).toHaveBeenCalledWith('activate_theme', { target_theme_id: 10 });
    expect(themes.filter((theme) => theme.is_default)).toHaveLength(defaultThemes.length);
    expect(themes.find((theme) => theme.is_active)?.name).toBe('Riven');
  });

  it('creates custom themes in Supabase with the current app user id', async () => {
    const { select } = createSelectChain([{ id: 7, name: 'Night Current' }]);
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

    const select = vi.fn().mockResolvedValue({ data: [{ id: 7, name: 'Rain Signal' }], error: null });
    const eqUser = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const update = vi.fn().mockReturnValue({ eq: eqId });
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
    expect(eqId).toHaveBeenCalledWith('id', 7);
    expect(eqUser).toHaveBeenCalledWith('user_id', 42);
  });

  it('returns a friendly error when a scoped theme update finds no rows', async () => {
    authApi.setToken('supabase-token');

    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqUser = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const update = vi.fn().mockReturnValue({ eq: eqId });
    supabase.from.mockReturnValue({ update });

    await expect(authApi.updateTheme(404, { name: 'Missing Theme' })).rejects.toMatchObject({
      message: 'Theme not found',
      status: 404,
    });
    expect(eqId).toHaveBeenCalledWith('id', 404);
    expect(eqUser).toHaveBeenCalledWith('user_id', 42);
  });

  it('activates themes through the atomic Supabase RPC', async () => {
    authApi.setToken('supabase-token');

    supabase.rpc.mockResolvedValue({
      data: { id: 99, name: 'Rain Signal', is_active: 1 },
      error: null,
    });

    const result = await authApi.activateTheme(99);

    expect(supabase.rpc).toHaveBeenCalledWith('activate_theme', { target_theme_id: 99 });
    expect(supabase.from).not.toHaveBeenCalled();
    expect(result).toMatchObject({ id: 99, name: 'Rain Signal', is_active: 1 });
  });

  it('falls back to direct theme updates when the activate_theme RPC is missing from schema cache', async () => {
    authApi.setToken('supabase-token');

    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.activate_theme(target_theme_id) in the schema cache',
      },
    });

    const eqExistingUser = vi.fn().mockResolvedValue({
      data: [{ id: 11, user_id: 42, name: 'Rain Signal', is_active: 0 }],
      error: null,
    });
    const eqExistingId = vi.fn().mockReturnValue({ eq: eqExistingUser });
    const selectExistingChain = vi.fn().mockReturnValue({ eq: eqExistingId });

    const deactivateNeq = vi.fn().mockResolvedValue({ data: null, error: null });
    const deactivateEq = vi.fn().mockReturnValue({ neq: deactivateNeq });
    const deactivateUpdate = vi.fn().mockReturnValue({ eq: deactivateEq });

    const activateSelect = vi.fn().mockResolvedValue({
      data: [{ id: 11, user_id: 42, name: 'Rain Signal', is_active: 1 }],
      error: null,
    });
    const activateEqUser = vi.fn().mockReturnValue({ select: activateSelect });
    const activateEqId = vi.fn().mockReturnValue({ eq: activateEqUser });
    const activateUpdate = vi.fn().mockReturnValue({ eq: activateEqId });

    supabase.from
      .mockReturnValueOnce({ select: selectExistingChain })
      .mockReturnValueOnce({ update: deactivateUpdate })
      .mockReturnValueOnce({ update: activateUpdate });

    const result = await authApi.activateTheme(11);

    expect(supabase.rpc).toHaveBeenCalledWith('activate_theme', { target_theme_id: 11 });
    expect(eqExistingId).toHaveBeenCalledWith('id', 11);
    expect(eqExistingUser).toHaveBeenCalledWith('user_id', 42);
    expect(deactivateEq).toHaveBeenCalledWith('user_id', 42);
    expect(deactivateNeq).toHaveBeenCalledWith('id', 11);
    expect(activateEqId).toHaveBeenCalledWith('id', 11);
    expect(activateEqUser).toHaveBeenCalledWith('user_id', 42);
    expect(result).toMatchObject({ id: 11, name: 'Rain Signal', is_active: 1 });
  });

  it('keeps theme not found behavior when RPC fallback cannot find a user-owned theme', async () => {
    authApi.setToken('supabase-token');

    supabase.rpc.mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.activate_theme(target_theme_id) in the schema cache',
      },
    });

    const eqExistingUser = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqExistingId = vi.fn().mockReturnValue({ eq: eqExistingUser });
    const selectExistingChain = vi.fn().mockReturnValue({ eq: eqExistingId });

    supabase.from.mockReturnValueOnce({ select: selectExistingChain });

    await expect(authApi.activateTheme(404)).rejects.toMatchObject({
      message: 'Theme not found',
      status: 404,
    });

    expect(eqExistingId).toHaveBeenCalledWith('id', 404);
    expect(eqExistingUser).toHaveBeenCalledWith('user_id', 42);
  });

  it('deletes themes only for the current app user', async () => {
    authApi.setToken('supabase-token');

    const select = vi.fn().mockResolvedValue({ data: [{ id: 7 }], error: null });
    const eqUser = vi.fn().mockReturnValue({ select });
    const eqId = vi.fn().mockReturnValue({ eq: eqUser });
    const deleteTheme = vi.fn().mockReturnValue({ eq: eqId });
    supabase.from.mockReturnValue({ delete: deleteTheme });

    await expect(authApi.deleteTheme(7)).resolves.toEqual({ message: 'Theme deleted' });
    expect(deleteTheme).toHaveBeenCalledTimes(1);
    expect(eqId).toHaveBeenCalledWith('id', 7);
    expect(eqUser).toHaveBeenCalledWith('user_id', 42);
    expect(select).toHaveBeenCalledWith('id');
  });
});
