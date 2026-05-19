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

const setSupabaseEdgeSession = (token) => {
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
};

describe('authApi Canvas LMS edge integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'supabase-anon-key');
    localStorage.clear();
    authApi.setToken(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the Canvas LMS edge function for Supabase connect requests', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Canvas connected successfully.',
    }));

    const result = await authApi.connectCanvas('https://canvas.example.edu/feeds/calendars/user_1.ics');

    expect(result).toEqual({ message: 'Canvas connected successfully.' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${token}`,
          'x-supabase-auth': token,
          apikey: 'supabase-anon-key',
        }),
        body: JSON.stringify({
          action: 'connect',
          icalUrl: 'https://canvas.example.edu/feeds/calendars/user_1.ics',
        }),
      }),
    );
  });

  it('uses the Canvas LMS edge function for Supabase disconnect requests', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Canvas disconnected.',
    }));

    const result = await authApi.disconnectCanvas();

    expect(result).toEqual({ message: 'Canvas disconnected.' });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'disconnect' }),
      }),
    );
  });

  it('sends manual sync requests through the Canvas LMS edge function', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Canvas sync complete!',
      classesAdded: 2,
      assignmentsAdded: 5,
    }));

    const result = await authApi.syncCanvas(false);

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 2,
      assignmentsAdded: 5,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'sync', adGranted: false }),
      }),
    );
  });

  it('sends Canvas auto-sync preference updates through the edge function', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Canvas auto-sync disabled.',
      autoSyncEnabled: false,
    }));

    const result = await authApi.setCanvasAutoSync(false);

    expect(result).toEqual({
      message: 'Canvas auto-sync disabled.',
      autoSyncEnabled: false,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'set-auto-sync', enabled: false }),
      }),
    );
  });

  it('sends Canvas semester cleanup archive requests through the edge function', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      classesArchived: 1,
      assignmentsArchived: 3,
    }));

    const classIds = ['11111111-1111-4111-8111-111111111111'];
    const result = await authApi.archiveCanvasSemesterClasses(classIds);

    expect(result).toEqual({
      classesArchived: 1,
      assignmentsArchived: 3,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ action: 'archive-semester-classes', classIds }),
      }),
    );
  });

  it('sends Canvas class restore requests through the edge function', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      classRestored: true,
      assignmentsRestored: 2,
    }));

    const result = await authApi.restoreArchivedClass('11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({
      classRestored: true,
      assignmentsRestored: 2,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/canvas-lms',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          action: 'restore-class',
          classId: '11111111-1111-4111-8111-111111111111',
        }),
      }),
    );
  });

  it('imports uploaded calendar files through the dedicated edge function', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Calendar file imported.',
      sourceId: 'source-1',
      eventsAdded: 4,
    }));

    const result = await authApi.importCalendarSourceFile({
      label: 'Spring Export',
      color: '#7a9e72',
      fileName: 'classes.ics',
      icsText: 'BEGIN:VCALENDAR',
    });

    expect(result).toEqual({
      message: 'Calendar file imported.',
      sourceId: 'source-1',
      eventsAdded: 4,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/calendar-source-file-import',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          label: 'Spring Export',
          color: '#7a9e72',
          fileName: 'classes.ics',
          icsText: 'BEGIN:VCALENDAR',
        }),
      }),
    );
  });

  it('replaces uploaded calendar files through the dedicated edge function', async () => {
    const token = buildJwt({ aud: 'authenticated', sub: 'auth-user-id' });
    authApi.setToken(token);
    setSupabaseEdgeSession(token);
    globalThis.fetch = vi.fn().mockResolvedValueOnce(buildJsonResponse({
      message: 'Calendar file replaced.',
      sourceId: 'source-1',
      eventsAdded: 6,
    }));

    const result = await authApi.replaceCalendarSourceFile({
      sourceId: 'source-1',
      color: '#7a9e72',
      fileName: 'updated.ics',
      icsText: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
    });

    expect(result).toEqual({
      message: 'Calendar file replaced.',
      sourceId: 'source-1',
      eventsAdded: 6,
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://supabase.test/functions/v1/calendar-source-file-import',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          sourceId: 'source-1',
          color: '#7a9e72',
          fileName: 'updated.ics',
          icsText: 'BEGIN:VCALENDAR\nEND:VCALENDAR',
          replaceExisting: true,
        }),
      }),
    );
  });
});
