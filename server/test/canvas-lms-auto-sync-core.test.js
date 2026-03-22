import { describe, expect, it, vi } from 'vitest';

import {
  requireCanvasAutoSyncAuth,
  runCanvasAutoSyncBatch,
} from '../../supabase/functions/_shared/canvasLmsAutoSyncCore.mjs';

describe('canvasLmsAutoSyncCore', () => {
  it('rejects auto-sync requests when the secret is missing', () => {
    expect(() => requireCanvasAutoSyncAuth({
      authorizationHeader: 'Bearer anything',
      expectedSecret: '',
    })).toThrowError('Canvas auto-sync is not configured.');
  });

  it('rejects auto-sync requests when the secret is invalid', () => {
    expect(() => requireCanvasAutoSyncAuth({
      authorizationHeader: 'Bearer wrong-secret',
      expectedSecret: 'expected-secret',
    })).toThrowError('Unauthorized');
  });

  it('skips non-premium and simulated-free users in the auto-sync batch', async () => {
    const syncUser = vi.fn().mockResolvedValue({ classesAdded: 1, assignmentsAdded: 2 });
    const updateUserState = vi.fn().mockResolvedValue(undefined);

    const result = await runCanvasAutoSyncBatch({
      now: new Date('2026-03-21T12:00:00.000Z'),
      users: [
        {
          id: 1,
          canvas_ical_url: 'https://canvas.example.edu/feeds/calendars/user_1.ics',
          canvas_auto_sync_enabled: true,
          subscription_tier: 'supporter',
          role: 'user',
          simulate_free_tier: false,
          last_canvas_sync_at: null,
          last_canvas_auto_sync_attempt_at: null,
        },
        {
          id: 2,
          canvas_ical_url: 'https://canvas.example.edu/feeds/calendars/user_2.ics',
          canvas_auto_sync_enabled: true,
          subscription_tier: 'free',
          role: 'user',
          simulate_free_tier: false,
          last_canvas_sync_at: null,
          last_canvas_auto_sync_attempt_at: null,
        },
        {
          id: 3,
          canvas_ical_url: 'https://canvas.example.edu/feeds/calendars/user_3.ics',
          canvas_auto_sync_enabled: true,
          subscription_tier: 'supporter',
          role: 'admin',
          simulate_free_tier: true,
          last_canvas_sync_at: null,
          last_canvas_auto_sync_attempt_at: null,
        },
      ],
      updateUserState,
      syncUser,
    });

    expect(result).toMatchObject({
      attemptedUsers: 1,
      syncedUsers: 1,
      failedUsers: 0,
    });
    expect(syncUser).toHaveBeenCalledTimes(1);
    expect(syncUser).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), expect.any(Date));
  });

  it('updates sync metadata on success and stores per-user errors without aborting the batch', async () => {
    const updateUserState = vi.fn().mockResolvedValue(undefined);
    const reportError = vi.fn().mockResolvedValue(undefined);
    const syncUser = vi
      .fn()
      .mockResolvedValueOnce({ classesAdded: 2, assignmentsAdded: 5 })
      .mockRejectedValueOnce(new Error('Canvas feed timed out.'));

    const result = await runCanvasAutoSyncBatch({
      now: new Date('2026-03-21T12:00:00.000Z'),
      users: [
        {
          id: 11,
          canvas_ical_url: 'https://canvas.example.edu/feeds/calendars/user_11.ics',
          canvas_auto_sync_enabled: true,
          subscription_tier: 'supporter',
          role: 'user',
          simulate_free_tier: false,
          last_canvas_sync_at: null,
          last_canvas_auto_sync_attempt_at: null,
        },
        {
          id: 12,
          canvas_ical_url: 'https://canvas.example.edu/feeds/calendars/user_12.ics',
          canvas_auto_sync_enabled: true,
          subscription_tier: 'lifetime',
          role: 'user',
          simulate_free_tier: false,
          last_canvas_sync_at: null,
          last_canvas_auto_sync_attempt_at: null,
        },
      ],
      updateUserState,
      syncUser,
      reportError,
    });

    expect(result).toMatchObject({
      attemptedUsers: 2,
      syncedUsers: 1,
      failedUsers: 1,
      classesAdded: 2,
      assignmentsAdded: 5,
    });
    expect(updateUserState).toHaveBeenCalledWith(11, expect.objectContaining({
      last_canvas_auto_sync_attempt_at: '2026-03-21T12:00:00.000Z',
    }));
    expect(updateUserState).toHaveBeenCalledWith(11, expect.objectContaining({
      last_canvas_sync_at: '2026-03-21T12:00:00.000Z',
      last_canvas_auto_sync_error: null,
    }));
    expect(updateUserState).toHaveBeenCalledWith(12, expect.objectContaining({
      last_canvas_auto_sync_error: 'Canvas feed timed out.',
    }));
    expect(reportError).toHaveBeenCalledTimes(1);
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), expect.objectContaining({ id: 12 }));
  });
});
