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
    storage: {
      from: vi.fn(),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'auth-user' } }, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
  },
}));

import * as authApi from './authApi';
import { supabase } from '../lib/supabaseClient';

const buildJsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const buildErrorResponse = (status, body) => ({
  ok: false,
  status,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const buildTextResponse = (status, body, contentType = 'text/html') => ({
  ok: status >= 200 && status < 300,
  status,
  headers: {
    get: () => contentType,
  },
  text: vi.fn().mockResolvedValue(body),
});

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

const encodeSegment = (value) => btoa(JSON.stringify(value))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/g, '');

const buildJwt = (payload) => [
  encodeSegment({ alg: 'HS256', typ: 'JWT' }),
  encodeSegment(payload),
  'signature',
].join('.');

describe('authApi AI edge migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    vi.stubEnv('VITE_API_URL', '');
    vi.stubEnv('VITE_ENABLE_LEGACY_AUTH_BRIDGE', '');
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    localStorage.clear();
    authApi.setToken(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses explicit edge fetches even when supabase.functions.invoke is available', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    supabase.functions = { invoke: vi.fn() };
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      remaining: 9,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
    }));

    const result = await authApi.getAILimits();

    expect(result).toEqual({
      remaining: 9,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
    });
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('uses the AI limits edge function for Supabase sessions', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      remaining: 9,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
    }));

    const result = await authApi.getAILimits();

    expect(result).toEqual({
      remaining: 9,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/ai-limits',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          'x-supabase-auth': authApi.getToken(),
          apikey: 'supabase-anon-key',
        }),
      }),
    );
  });

  it('uses the generate-deck edge function for Supabase sessions', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Deck generated successfully',
      deck_id: 55,
      card_count: 12,
    }));

    const result = await authApi.generateAiDeck('Biology notes', { data: 'abc', mimeType: 'text/plain' }, 'Bio', 'class-1');

    expect(result).toEqual({
      message: 'Deck generated successfully',
      deck_id: 55,
      card_count: 12,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/generate-deck',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          notes: 'Biology notes',
          file: { data: 'abc', mimeType: 'text/plain' },
          deckName: 'Bio',
          classId: 'class-1',
        }),
      }),
    );
  });

  it('uses the grade-answer edge function with the custom auth header', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      score: 92,
      feedback: 'Strong answer.',
      keyPointsHit: ['Explained feedback loop'],
      keyPointsMissed: [],
    }));

    const result = await authApi.gradeShortAnswer(
      'What is churn reduction?',
      'It is lowering user drop-off.',
      'Reducing the rate users stop using the product.',
      'Mention retention and user drop-off.'
    );

    expect(result).toEqual({
      score: 92,
      feedback: 'Strong answer.',
      keyPointsHit: ['Explained feedback loop'],
      keyPointsMissed: [],
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/grade-answer',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          'x-supabase-auth': authApi.getToken(),
          apikey: 'supabase-anon-key',
        }),
        body: JSON.stringify({
          question: 'What is churn reduction?',
          studentAnswer: 'It is lowering user drop-off.',
          correctAnswer: 'Reducing the rate users stop using the product.',
          gradingRubric: 'Mention retention and user drop-off.',
        }),
      }),
    );
  });

  it('uses the create-ai-job edge function for Supabase sessions', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      jobId: 'job-1',
      status: 'queued',
      phase: 'accepted',
    }));

    const result = await authApi.createAiJob('note_enhancement', {
      noteId: 'note-1',
      audioPath: '7/note-1.webm',
    });

    expect(result).toEqual({
      jobId: 'job-1',
      status: 'queued',
      phase: 'accepted',
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/create-ai-job',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${authApi.getToken()}`,
          'x-supabase-auth': authApi.getToken(),
          apikey: 'supabase-anon-key',
        }),
        body: JSON.stringify({
          kind: 'note_enhancement',
          payload: {
            noteId: 'note-1',
            audioPath: '7/note-1.webm',
          },
        }),
      }),
    );
  });

  it('deletes note audio from the private note-audio bucket', async () => {
    const remove = vi.fn().mockResolvedValue({ error: null });
    supabase.storage.from.mockReturnValue({ remove });

    const result = await authApi.deleteNoteAudio('7/note-1.webm');

    expect(result).toEqual({ path: '7/note-1.webm' });
    expect(supabase.storage.from).toHaveBeenCalledWith('note-audio');
    expect(remove).toHaveBeenCalledWith(['7/note-1.webm']);
  });

  it('propagates storage delete failures when note audio cleanup fails', async () => {
    const remove = vi.fn().mockResolvedValue({
      error: { message: 'permission denied' },
    });
    supabase.storage.from.mockReturnValue({ remove });

    await expect(authApi.deleteNoteAudio('7/note-1.webm')).rejects.toMatchObject({
      message: 'permission denied',
    });
  });

  it('preserves the current session when the legacy auth bridge route is unavailable after an edge 401', async () => {
    vi.stubEnv('VITE_ENABLE_LEGACY_AUTH_BRIDGE', 'true');
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(401, { error: 'Unauthorized' }))
      .mockResolvedValueOnce(buildTextResponse(200, '<html>csrf shell</html>'))
      .mockResolvedValueOnce(buildTextResponse(405, '<html>app shell</html>'));

    await expect(
      authApi.createAiJob('youtube_source', {
        youtubeUrl: 'https://youtu.be/demo123',
      })
    ).rejects.toMatchObject({
      status: 401,
      message: 'Unauthorized',
    });

    expect(authApi.getToken()).toBe(token);
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      2,
      '/api/csrf',
      expect.objectContaining({
        credentials: 'include',
      }),
    );
    expect(globalThis.fetch).toHaveBeenNthCalledWith(
      3,
      '/api/auth/supabase-token',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });

  it('queries ai_jobs directly for job state', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'job-1', status: 'running', phase: 'drafting' },
      error: null,
    });
    const eqId = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq: eqId });
    supabase.from.mockReturnValue({ select });

    const result = await authApi.getAiJob('job-1');

    expect(result).toEqual({ id: 'job-1', status: 'running', phase: 'drafting' });
    expect(supabase.from).toHaveBeenCalledWith('ai_jobs');
    expect(select).toHaveBeenCalledWith('*');
    expect(eqId).toHaveBeenCalledWith('id', 'job-1');
  });

  it('subscribes to ai job updates through Supabase realtime', () => {
    const { channel, handlers } = createChannelMock();
    const onUpdate = vi.fn();
    const onComplete = vi.fn();

    supabase.channel.mockReturnValue(channel);

    const unsubscribe = authApi.subscribeToAiJob('job-1', {
      onUpdate,
      onComplete,
    });

    expect(supabase.channel).toHaveBeenCalledWith('ai_job_job-1');
    expect(channel.subscribe).toHaveBeenCalledTimes(1);
    expect(handlers).toHaveLength(1);

    handlers[0].callback({
      eventType: 'UPDATE',
      new: { id: 'job-1', status: 'completed', phase: 'done' },
      old: { id: 'job-1', status: 'saving', phase: 'saving' },
    });

    expect(onUpdate).toHaveBeenCalledWith(
      { id: 'job-1', status: 'completed', phase: 'done' },
      expect.objectContaining({ eventType: 'UPDATE' }),
    );
    expect(onComplete).toHaveBeenCalledWith(
      { id: 'job-1', status: 'completed', phase: 'done' },
      expect.objectContaining({ eventType: 'UPDATE' }),
    );

    unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('surfaces edge errors when the generate-class function is unavailable', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: token } } });
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(buildErrorResponse(404, { error: 'Function not found' }));

    await expect(
      authApi.generateAiClass('Syllabus notes', { data: 'abc', mimeType: 'application/pdf' })
    ).rejects.toMatchObject({
      status: 404,
      message: 'Function not found',
    });

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/generate-class',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          notes: 'Syllabus notes',
          file: { data: 'abc', mimeType: 'application/pdf' },
        }),
      }),
    );
  });

  it('forces re-login for non-Supabase tokens on AI limits', async () => {
    authApi.setToken(buildJwt({ id: 7, email: 'user@example.com', role: 'user' }));
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildErrorResponse(401, { error: 'Missing bearer token' }));

    await expect(authApi.getAILimits()).rejects.toMatchObject({
      status: 401,
      code: authApi.AUTH_SESSION_EXPIRED_CODE,
      message: 'Session expired. Please sign in again.',
    });

    expect(authApi.getToken()).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledTimes(0);
  });
});
