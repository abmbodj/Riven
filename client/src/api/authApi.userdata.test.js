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

const createSelectEqSingleChain = (data) => {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, single };
};

const createUpdateEqSelectSingleChain = (data) => {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  return { update, eq, select, single };
};

const createUpdateEqChain = () => {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  return { update, eq };
};

describe('authApi user-owned profile data via Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    authApi.setToken(null);
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({ id: 42, email: 'test@example.com' }));
  });

  it('updates the current profile through the users table', async () => {
    const { update, eq, select } = createUpdateEqSelectSingleChain({
      id: 42,
      username: 'atlas',
      display_name: 'Atlas',
      email: 'test@example.com',
      share_code: 'ABCD1234',
      avatar: '/avatar.png',
      banner: '/banner.png',
      bio: 'Quietly building',
      streak_data: '{"currentStreak":3}',
      pet_customization: '{"gardenTheme":"cottage","decorations":[],"specialPlants":[]}',
      role: 'admin',
      is_admin: 1,
      created_at: '2026-03-14T18:00:00.000Z',
      two_fa_enabled: true,
      subscription_tier: 'free',
      simulate_free_tier: false,
      email_verified: true,
    });
    supabase.from.mockReturnValue({ update });

    authApi.setToken('supabase-token');
    const updated = await authApi.updateProfile({
      username: 'atlas',
      displayName: 'Atlas',
      bio: 'Quietly building',
      avatar: '/avatar.png',
      banner: '/banner.png',
    });

    expect(update).toHaveBeenCalledWith({
      username: 'atlas',
      display_name: 'Atlas',
      bio: 'Quietly building',
      avatar: '/avatar.png',
      banner: '/banner.png',
    });
    expect(eq).toHaveBeenCalledWith('id', 42);
    expect(select).toHaveBeenCalled();
    expect(updated).toEqual({
      id: 42,
      username: 'atlas',
      displayName: 'Atlas',
      email: 'test@example.com',
      shareCode: 'ABCD1234',
      avatar: '/avatar.png',
      banner: '/banner.png',
      bio: 'Quietly building',
      streakData: { currentStreak: 3 },
      petCustomization: { gardenTheme: 'cottage', decorations: [], specialPlants: [] },
      role: 'admin',
      isAdmin: true,
      isOwner: false,
      createdAt: '2026-03-14T18:00:00.000Z',
      twoFAEnabled: true,
      subscription_tier: 'free',
      simulate_free_tier: false,
      email_verified: true,
    });
  });

  it('refreshes the current profile when updateProfile is called with no fields', async () => {
    const { select, eq } = createSelectEqSingleChain({
      id: 42,
      username: 'atlas',
      display_name: 'Atlas',
      email: 'test@example.com',
      share_code: 'ABCD1234',
      avatar: null,
      banner: null,
      bio: '',
      streak_data: '{}',
      pet_customization: '{}',
      role: 'user',
      is_admin: 0,
      created_at: '2026-03-14T18:00:00.000Z',
      two_fa_enabled: false,
      subscription_tier: 'free',
      simulate_free_tier: false,
      email_verified: true,
    });
    supabase.from.mockReturnValue({ select });

    authApi.setToken('supabase-token');
    const user = await authApi.updateProfile({});

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 42);
    expect(user.username).toBe('atlas');
  });

  it('loads and saves streak data through the users table', async () => {
    const selectChain = createSelectEqSingleChain({
      streak_data: '{"currentStreak":7,"longestStreak":9,"lastStudyDate":"2026-03-14T12:00:00.000Z"}',
    });
    const updateChain = createUpdateEqChain();

    supabase.from
      .mockReturnValueOnce({ select: selectChain.select })
      .mockReturnValueOnce({ update: updateChain.update });

    authApi.setToken('supabase-token');
    const streak = await authApi.getStreak();
    const saved = await authApi.updateStreak({ currentStreak: 8, longestStreak: 9 });

    expect(streak).toEqual({
      currentStreak: 7,
      longestStreak: 9,
      lastStudyDate: '2026-03-14T12:00:00.000Z',
    });
    expect(updateChain.update).toHaveBeenCalledWith({
      streak_data: JSON.stringify({ currentStreak: 8, longestStreak: 9 }),
    });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 42);
    expect(saved).toEqual({ message: 'Streak data saved' });
  });

  it('loads and saves pet customization through the users table', async () => {
    const selectChain = createSelectEqSingleChain({
      pet_customization: '{"gardenTheme":"midnight","decorations":["lantern"],"specialPlants":[]}',
    });
    const updateChain = createUpdateEqChain();

    supabase.from
      .mockReturnValueOnce({ select: selectChain.select })
      .mockReturnValueOnce({ update: updateChain.update });

    authApi.setToken('supabase-token');
    const customization = await authApi.getPetCustomization();
    const saved = await authApi.updatePetCustomization({
      gardenTheme: 'midnight',
      decorations: ['lantern'],
      specialPlants: [],
    });

    expect(customization).toEqual({
      gardenTheme: 'midnight',
      decorations: ['lantern'],
      specialPlants: [],
    });
    expect(updateChain.update).toHaveBeenCalledWith({
      pet_customization: JSON.stringify({
        gardenTheme: 'midnight',
        decorations: ['lantern'],
        specialPlants: [],
      }),
    });
    expect(updateChain.eq).toHaveBeenCalledWith('id', 42);
    expect(saved).toEqual({
      message: 'Garden customization saved',
      customization: {
        gardenTheme: 'midnight',
        decorations: ['lantern'],
        specialPlants: [],
      },
    });
  });
});
