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
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
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

const encodeSegment = (value) => btoa(JSON.stringify(value))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const buildJwt = (payload) => [
  encodeSegment({ alg: 'HS256', typ: 'JWT' }),
  encodeSegment(payload),
  'signature',
].join('.');

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

const createSelectEqOrderChain = (data) => {
  const order = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq, order };
};

const createSelectEqChain = (data) => {
  const eq = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ eq });
  return { select, eq };
};

const createInsertChain = () => {
  const insert = vi.fn().mockResolvedValue({ error: null });
  return { insert };
};

describe('authApi user-owned profile data via Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.rpc.mockReset();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    supabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    localStorage.clear();
    authApi.setToken(null);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({ id: 42, email: 'test@example.com' }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      subscription_tier: 'lifetime',
      base_subscription_tier: 'free',
      premium_access_source: 'admin_included',
      has_manageable_subscription: false,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_expires_at: null,
      simulate_free_tier: false,
      email_verified: true,
      onboardingCompletedAt: null,
      onboardingStep: 0,
    });
  });

  it('preserves free-tier mapping for simulated admin users', async () => {
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
      role: 'admin',
      is_admin: 1,
      created_at: '2026-03-14T18:00:00.000Z',
      two_fa_enabled: false,
      subscription_tier: 'free',
      simulate_free_tier: true,
      email_verified: true,
    });
    supabase.from.mockReturnValue({ select });

    authApi.setToken('supabase-token');
    const user = await authApi.updateProfile({});

    expect(select).toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith('id', 42);
    expect(user.subscription_tier).toBe('free');
    expect(user.simulate_free_tier).toBe(true);
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

  it('loads LMS settings and global messages through Supabase tables', async () => {
    const canvasChain = createSelectEqSingleChain({
      canvas_ical_url: 'https://canvas.example.com/feed.ics',
      canvas_auto_sync_enabled: true,
      last_canvas_sync_at: '2026-03-20T12:00:00.000Z',
      last_canvas_auto_sync_error: 'Canvas feed timed out.',
    });
    const messagesChain = createSelectEqOrderChain([
      {
        id: 11,
        title: 'Welcome',
        content: 'Read this first',
        type: 'info',
        created_at: '2026-03-14T18:00:00.000Z',
        expires_at: null,
      },
      {
        id: 12,
        title: 'Expired',
        content: 'Too old',
        type: 'warning',
        created_at: '2026-03-01T18:00:00.000Z',
        expires_at: '2026-03-02T18:00:00.000Z',
      },
    ]);
    const dismissedChain = createSelectEqChain([{ message_id: 99 }]);
    const insertChain = createInsertChain();

    supabase.from
      .mockReturnValueOnce({ select: canvasChain.select })
      .mockReturnValueOnce({ select: messagesChain.select })
      .mockReturnValueOnce({ select: dismissedChain.select })
      .mockReturnValueOnce({ insert: insertChain.insert });

    authApi.setToken('supabase-token');
    const settings = await authApi.getCanvasSettings();
    const messages = await authApi.getActiveMessages();
    const dismissed = await authApi.dismissMessage(11);

    expect(canvasChain.select).toHaveBeenCalledWith('canvas_ical_url, canvas_auto_sync_enabled, last_canvas_sync_at, last_canvas_auto_sync_error');
    expect(canvasChain.eq).toHaveBeenCalledWith('id', 42);
    expect(settings).toEqual({
      isConnected: true,
      canvasUrl: 'https://canvas.example.com/feed.ics',
      autoSyncEnabled: true,
      lastSyncAt: '2026-03-20T12:00:00.000Z',
      lastAutoSyncError: 'Canvas feed timed out.',
    });

    expect(messagesChain.select).toHaveBeenCalledWith('id, title, content, type, created_at, expires_at');
    expect(messagesChain.eq).toHaveBeenCalledWith('is_active', 1);
    expect(messagesChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(dismissedChain.select).toHaveBeenCalledWith('message_id');
    expect(dismissedChain.eq).toHaveBeenCalledWith('user_id', 42);
    expect(messages).toEqual([{
      id: 11,
      title: 'Welcome',
      content: 'Read this first',
      type: 'info',
      createdAt: '2026-03-14T18:00:00.000Z',
    }]);

    expect(insertChain.insert).toHaveBeenCalledWith({
      user_id: 42,
      message_id: 11,
    });
    expect(dismissed).toEqual({ message: 'Message dismissed' });
  });

  it('toggles simulate-free tier through the simulate-free edge function', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: token,
        },
      },
    });
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
        },
      },
      error: null,
    });
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({
      simulate_free_tier: true,
      subscription_tier: 'free',
    }));

    const result = await authApi.toggleSimulateFree();

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/simulate-free',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
          'x-supabase-auth': token,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
    expect(result).toEqual({ simulate_free_tier: true, subscription_tier: 'free' });
  });

  it('surfaces simulate-free edge function errors', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: token,
        },
      },
    });
    supabase.auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: 'auth-user-id',
        },
      },
      error: null,
    });
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: {
        get: () => 'application/json',
      },
      text: vi.fn().mockResolvedValue(JSON.stringify({
        error: 'Owner or Admin only',
      })),
    });

    await expect(authApi.toggleSimulateFree()).rejects.toMatchObject({
      message: 'Owner or Admin only',
      status: 403,
    });
  });

  it('loads Phase 2 group read endpoints through Supabase RPCs', async () => {
    supabase.rpc
      .mockResolvedValueOnce({
        data: [{
          id: 'group-1',
          name: 'Biology Club',
          class_name: 'Biology',
          member_count: 3,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'group-1',
          name: 'Biology Club',
          class_name: 'Biology',
          my_role: 'admin',
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 7,
          username: 'atlas',
          display_name: 'Atlas',
          avatar: '/avatar.png',
          role: 'admin',
          joined_at: '2026-03-14T18:00:00.000Z',
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 9,
          title: 'Cells',
          shared_by_name: 'atlas',
          card_count: 12,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'folder-1',
          name: 'Week 1',
          file_count: 2,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'file-1',
          name: 'lecture.pdf',
          uploaded_by_name: 'atlas',
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{
          id: 'session-1',
          deck_title: 'Cells',
          active_members: 2,
        }],
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          weakSpots: [{ id: 33, front: 'Mitochondria', incorrect_count: 2 }],
          personalStats: { total_answered: 10, total_correct: 8 },
        },
        error: null,
      });

    expect(await authApi.getGroups()).toEqual([{
      id: 'group-1',
      name: 'Biology Club',
      class_name: 'Biology',
      member_count: 3,
    }]);
    expect(await authApi.getGroup('group-1')).toEqual({
      id: 'group-1',
      name: 'Biology Club',
      class_name: 'Biology',
      my_role: 'admin',
    });
    expect(await authApi.getGroupMembers('group-1')).toEqual([{
      id: 7,
      username: 'atlas',
      display_name: 'Atlas',
      avatar: '/avatar.png',
      role: 'admin',
      joined_at: '2026-03-14T18:00:00.000Z',
    }]);
    expect(await authApi.getGroupDecks('group-1')).toEqual([{
      id: 9,
      title: 'Cells',
      shared_by_name: 'atlas',
      card_count: 12,
    }]);
    expect(await authApi.getGroupFolders('group-1')).toEqual([{
      id: 'folder-1',
      name: 'Week 1',
      file_count: 2,
    }]);
    expect(await authApi.getGroupFiles('group-1')).toEqual([{
      id: 'file-1',
      name: 'lecture.pdf',
      uploaded_by_name: 'atlas',
    }]);
    expect(await authApi.getGroupSessions('group-1')).toEqual([{
      id: 'session-1',
      deck_title: 'Cells',
      active_members: 2,
    }]);
    expect(await authApi.getSessionResults('session-1')).toEqual({
      weakSpots: [{ id: 33, front: 'Mitochondria', incorrect_count: 2 }],
      personalStats: { total_answered: 10, total_correct: 8 },
    });

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'list_user_groups', {});
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'get_group_details', { target_group_id: 'group-1' });
    expect(supabase.rpc).toHaveBeenNthCalledWith(3, 'list_group_members', { target_group_id: 'group-1' });
    expect(supabase.rpc).toHaveBeenNthCalledWith(4, 'list_group_decks', { target_group_id: 'group-1' });
    expect(supabase.rpc).toHaveBeenNthCalledWith(5, 'list_group_folders', { target_group_id: 'group-1' });
    expect(supabase.rpc).toHaveBeenNthCalledWith(6, 'list_group_files', { target_group_id: 'group-1', target_folder_id: null });
    expect(supabase.rpc).toHaveBeenNthCalledWith(7, 'list_group_sessions', { target_group_id: 'group-1' });
    expect(supabase.rpc).toHaveBeenNthCalledWith(8, 'get_group_session_results', { target_session_id: 'session-1' });
  });
});
