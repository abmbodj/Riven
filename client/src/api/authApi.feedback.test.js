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

describe('authApi feedback and notification methods', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReset();
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    localStorage.clear();
    authApi.setToken(null);
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('submits feedback into feedback_submissions for the current user', async () => {
    authApi.setToken('supabase-token');
    globalThis.fetch = vi.fn().mockResolvedValue(
      buildJsonResponse({ id: 42, username: 'avery' })
    );

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 5,
        user_id: 42,
        content: 'Add a feedback inbox.',
        is_favorited: false,
        considering_notified_at: null,
        considering_notified_by: null,
        created_at: '2026-03-21T16:00:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });

    const result = await authApi.submitFeedback('Add a feedback inbox.');

    expect(supabase.from).toHaveBeenCalledWith('feedback_submissions');
    expect(insert).toHaveBeenCalledWith({
      user_id: 42,
      content: 'Add a feedback inbox.',
    });
    expect(result).toEqual(expect.objectContaining({
      id: 5,
      userId: 42,
      content: 'Add a feedback inbox.',
    }));
  });

  it('throws when the admin feedback list request fails', async () => {
    const edgeToken = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(edgeToken);
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: edgeToken,
        },
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: {
        get: () => 'application/json',
      },
      text: vi.fn().mockResolvedValue(JSON.stringify({ error: 'feedback_submissions missing' })),
    });

    await expect(authApi.adminGetFeedback()).rejects.toMatchObject({
      status: 500,
      message: 'feedback_submissions missing',
    });
  });

  it('loads feedback moderation rows through the admin edge function', async () => {
    const edgeToken = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(edgeToken);
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: edgeToken,
        },
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse([
      { id: 7, username: 'rivenfan', content: 'Make admin favorites persistent.' },
    ]));

    const feedback = await authApi.adminGetFeedback();

    expect(feedback).toEqual([
      { id: 7, username: 'rivenfan', content: 'Make admin favorites persistent.' },
    ]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/admin-actions?action=feedback',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('sends thank-you actions through the admin edge function', async () => {
    const edgeToken = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(edgeToken);
    supabase.auth.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: edgeToken,
        },
      },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      id: 11,
      consideringNotifiedAt: '2026-03-21T16:00:00.000Z',
    }));

    await authApi.adminThankFeedback(11);

    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/admin-actions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'feedback-thank', feedbackId: 11 }),
      }),
    );
  });

  it('fetches and dismisses targeted user notifications', async () => {
    authApi.setToken('supabase-token');
    globalThis.fetch = vi.fn().mockResolvedValue(
      buildJsonResponse({ id: 42, username: 'avery' })
    );

    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: 9,
          user_id: 42,
          kind: 'feedback_considering',
          title: 'Your feedback is being considered',
          content: 'Thanks for helping shape Riven.',
          metadata: { feedbackId: 3 },
          created_at: '2026-03-21T16:30:00.000Z',
          dismissed_at: null,
        },
      ],
      error: null,
    });
    const is = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });

    const dismissIs = vi.fn().mockResolvedValue({ error: null });
    const dismissEqUser = vi.fn().mockReturnValue({ is: dismissIs });
    const dismissEqId = vi.fn().mockReturnValue({ eq: dismissEqUser });
    const update = vi.fn().mockReturnValue({ eq: dismissEqId });

    supabase.from.mockImplementation((table) => {
      if (table === 'user_notifications') {
        return {
          select,
          update,
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const notifications = await authApi.getUserNotifications();
    await authApi.dismissUserNotification(9);

    expect(notifications).toEqual([
      expect.objectContaining({
        id: 9,
        userId: 42,
        kind: 'feedback_considering',
        metadata: { feedbackId: 3 },
      }),
    ]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      dismissed_at: expect.any(String),
    }));
  });
});
