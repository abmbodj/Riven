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

const createInsertChain = (data) => {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert, select, single };
};

const createUpdateChain = (data) => {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  return { update, eq, select, single };
};

const buildJsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe('authApi PostgREST inserts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    authApi.setToken(null);
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({ id: 42, email: 'test@example.com' }));
  });

  it('includes the current app user id when creating folders', async () => {
    const { insert } = createInsertChain({ id: 'folder-1' });
    supabase.from.mockReturnValue({ insert });

    authApi.setToken('supabase-token');
    await authApi.createFolder('Coursework', '#111111', 'folder');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      user_id: 42,
      name: 'Coursework',
      color: '#111111',
      icon: 'folder',
    });
  });

  it('includes the current app user id when creating tags', async () => {
    const { insert } = createInsertChain({ id: 'tag-1' });
    supabase.from.mockReturnValue({ insert });

    authApi.setToken('supabase-token');
    await authApi.createTag('Exam', '#222222');

    expect(insert).toHaveBeenCalledWith({
      user_id: 42,
      name: 'Exam',
      color: '#222222',
      is_preset: false,
    });
  });

  it('includes the current app user id when creating classes', async () => {
    const { insert } = createInsertChain({ id: 'class-1' });
    supabase.from.mockReturnValue({ insert });

    authApi.setToken('supabase-token');
    await authApi.createClass('Math', '#333333', 'Dr. Euler', 'B12', 'https://zoom.test/math');

    expect(insert).toHaveBeenCalledWith({
      user_id: 42,
      name: 'Math',
      color: '#333333',
      professor: 'Dr. Euler',
      room: 'B12',
      zoom_link: 'https://zoom.test/math',
      subject: null,
    });
  });

  it('includes the current app user id when creating assignments', async () => {
    const { insert } = createInsertChain({ id: 'assignment-1' });
    supabase.from.mockReturnValue({ insert });

    authApi.setToken('supabase-token');
    await authApi.createAssignment('class-1', 'Worksheet', 'Chapter 3', '2026-03-20', 'homework');

    expect(insert).toHaveBeenCalledWith({
      user_id: 42,
      class_id: 'class-1',
      title: 'Worksheet',
      description: 'Chapter 3',
      status: 'Todo',
      due_date: '2026-03-20',
      type: 'homework',
    });
  });

  it('includes the current app user id when creating schedule slots', async () => {
    const { insert } = createInsertChain({ id: 'slot-1' });
    supabase.from.mockReturnValue({ insert });

    authApi.setToken('supabase-token');
    await authApi.createScheduleSlot('class-1', 2, '09:00', '10:00');

    expect(insert).toHaveBeenCalledWith({
      user_id: 42,
      class_id: 'class-1',
      day_of_week: 2,
      start_time: '09:00',
      end_time: '10:00',
    });
  });

  it('marks new calendar feed sources as url imports', async () => {
    const { insert } = createInsertChain({ id: 'source-1' });
    supabase.from.mockReturnValue({ insert });

    authApi.setToken('supabase-token');
    await authApi.addCalendarSource({
      label: 'Work',
      url: 'https://calendar.example.com/feed.ics',
      color: '#444444',
    });

    expect(insert).toHaveBeenCalledWith({
      user_id: 42,
      label: 'Work',
      url: 'https://calendar.example.com/feed.ics',
      color: '#444444',
      type: 'ical',
      import_mode: 'url',
      file_name: null,
    });
  });

  it('returns default push preferences when no row exists yet', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    supabase.from.mockReturnValue({ select });

    authApi.setToken('supabase-token');
    const preferences = await authApi.getPushPreferences();

    expect(select).toHaveBeenCalledWith('messages_enabled, streak_enabled, reengagement_enabled');
    expect(eq).toHaveBeenCalledWith('user_id', 42);
    expect(preferences).toEqual({
      messagesEnabled: true,
      streakEnabled: true,
      reengagementEnabled: true,
    });
  });

  it('upserts push preferences under the current user id', async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        messages_enabled: false,
        streak_enabled: true,
        reengagement_enabled: false,
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const upsert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ upsert });

    authApi.setToken('supabase-token');
    const preferences = await authApi.updatePushPreferences({
      messagesEnabled: false,
      streakEnabled: true,
      reengagementEnabled: false,
    });

    expect(upsert).toHaveBeenCalledWith({
      user_id: 42,
      messages_enabled: false,
      streak_enabled: true,
      reengagement_enabled: false,
    }, {
      onConflict: 'user_id',
    });
    expect(preferences).toEqual({
      messagesEnabled: false,
      streakEnabled: true,
      reengagementEnabled: false,
    });
  });

  it('registers push devices through the Supabase rpc', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    authApi.setToken('supabase-token');
    await authApi.upsertPushDevice({
      installationId: 'install-123',
      platform: 'ios',
      pushToken: 'token-abc',
    });

    expect(supabase.rpc).toHaveBeenCalledWith('upsert_user_push_device', {
      installation_id_param: 'install-123',
      platform_param: 'ios',
      push_token_param: 'token-abc',
    });
  });

  it('deactivates push devices through the Supabase rpc', async () => {
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    authApi.setToken('supabase-token');
    await authApi.deactivatePushDevice('install-123');

    expect(supabase.rpc).toHaveBeenCalledWith('deactivate_user_push_device', {
      installation_id_param: 'install-123',
    });
  });

  it('preserves explicit null meetup timestamps when updating a meetup', async () => {
    const { update, eq } = createUpdateChain({ id: 'meetup-1' });
    supabase.from.mockReturnValue({ update });

    const result = await authApi.updateGroupMeetup('meetup-1', {
      topic: 'Chapter 5 review',
      start_at: null,
      end_at: null,
    });

    expect(update).toHaveBeenCalledWith({
      topic: 'Chapter 5 review',
      start_at: null,
      end_at: null,
    });
    expect(eq).toHaveBeenCalledWith('id', 'meetup-1');
    expect(result).toEqual({ id: 'meetup-1' });
  });
});
