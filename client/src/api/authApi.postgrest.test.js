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

const createInsertChain = (data) => {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert, select, single };
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
});
