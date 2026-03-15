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
    channel: vi.fn(),
    removeChannel: vi.fn(),
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

const encodeSegment = (value) => btoa(JSON.stringify(value))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const buildJwt = (payload) => [
  encodeSegment({ alg: 'HS256', typ: 'JWT' }),
  encodeSegment(payload),
  'signature',
].join('.');

const createChannelMock = () => {
  const handlers = [];
  const channel = {
    on: vi.fn().mockImplementation((event, config, callback) => {
      handlers.push({ event, config, callback });
      return channel;
    }),
    subscribe: vi.fn(),
  };

  return { channel, handlers };
};

describe('authApi group session edge migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    localStorage.clear();
    authApi.setToken(buildJwt({ aud: 'authenticated', sub: 'auth-user-id' }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the group session edge function to start sessions for Supabase users', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      id: 'session-1',
      group_id: 'group-1',
      deck_id: 44,
      started_by: 7,
      status: 'active',
    }));

    const result = await authApi.startGroupSession('group-1', 44);

    expect(result).toEqual({
      id: 'session-1',
      group_id: 'group-1',
      deck_id: 44,
      started_by: 7,
      status: 'active',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/group-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'session-start',
          groupId: 'group-1',
          deckId: 44,
        }),
      }),
    );
  });

  it('uses the group session edge function to join active sessions for Supabase users', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Joined session successfully',
      session: {
        id: 'session-1',
        group_id: 'group-1',
        deck_id: 44,
        status: 'active',
      },
    }));

    const result = await authApi.joinGroupSession('session-1');

    expect(result).toEqual({
      message: 'Joined session successfully',
      session: {
        id: 'session-1',
        group_id: 'group-1',
        deck_id: 44,
        status: 'active',
      },
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/group-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'session-join',
          sessionId: 'session-1',
        }),
      }),
    );
  });

  it('uses the group session edge function for session responses and endings', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildJsonResponse({ success: true }))
      .mockResolvedValueOnce(buildJsonResponse({ message: 'Session ended' }));

    const respondResult = await authApi.respondToSessionCard('session-1', 99, true);
    const endResult = await authApi.endGroupSession('session-1');

    expect(respondResult).toEqual({ success: true });
    expect(endResult).toEqual({ message: 'Session ended' });
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/functions/v1/group-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'session-respond',
          sessionId: 'session-1',
          cardId: 99,
          knewIt: true,
        }),
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      'https://supabase.test/functions/v1/group-sessions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'session-end',
          sessionId: 'session-1',
        }),
      }),
    );
  });

  it('subscribes to group session lifecycle changes through Supabase realtime', () => {
    const { channel, handlers } = createChannelMock();
    const started = vi.fn();
    const ended = vi.fn();

    supabase.channel.mockReturnValue(channel);

    const unsubscribe = authApi.subscribeToGroupSessionEvents('group-1', {
      onStarted: started,
      onEnded: ended,
    });

    expect(supabase.channel).toHaveBeenCalledWith('group_sessions_group-1');
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
    expect(handlers).toHaveLength(2);

    handlers[0].callback({
      eventType: 'INSERT',
      new: { id: 'session-1', group_id: 'group-1', status: 'active' },
    });
    handlers[1].callback({
      eventType: 'UPDATE',
      new: { id: 'session-1', group_id: 'group-1', status: 'ended' },
      old: { id: 'session-1', group_id: 'group-1', status: 'active' },
    });

    expect(started).toHaveBeenCalledWith({ id: 'session-1', group_id: 'group-1', status: 'active' });
    expect(ended).toHaveBeenCalledWith({ id: 'session-1', group_id: 'group-1', status: 'ended' });

    unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('subscribes to session progress and end events through Supabase realtime', () => {
    const { channel, handlers } = createChannelMock();
    const progress = vi.fn();
    const ended = vi.fn();

    supabase.channel.mockReturnValue(channel);

    const unsubscribe = authApi.subscribeToCramSession('session-1', {
      onProgress: progress,
      onEnded: ended,
    });

    expect(supabase.channel).toHaveBeenCalledWith('cram_session_session-1');
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
    expect(handlers).toHaveLength(3);

    handlers[0].callback({
      eventType: 'INSERT',
      new: { session_id: 'session-1', user_id: 12 },
    });
    handlers[2].callback({
      eventType: 'UPDATE',
      new: { id: 'session-1', status: 'ended' },
      old: { id: 'session-1', status: 'active' },
    });

    expect(progress).toHaveBeenCalledWith({ userId: 12 });
    expect(ended).toHaveBeenCalledWith({ id: 'session-1', status: 'ended' });

    unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
