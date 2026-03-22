import { describe, expect, it } from 'vitest';

import {
  applyCanvasSyncQuota,
  selectCanvasAutoSyncUsers,
  syncCanvasCalendar,
  validateCanvasFeedUrl,
} from '../../supabase/functions/_shared/canvasLmsCore.mjs';

describe('canvasLmsCore', () => {
  it('validates Canvas feed URLs', () => {
    expect(() => validateCanvasFeedUrl('')).toThrowError('Canvas Calendar Link is required.');
    expect(() => validateCanvasFeedUrl('https://canvas.example.edu/calendar')).toThrowError(
      'Invalid link. Be sure it comes from your Canvas Calendar Feed.',
    );
    expect(validateCanvasFeedUrl(' https://canvas.example.edu/feeds/calendars/user_1.ics ')).toBe(
      'https://canvas.example.edu/feeds/calendars/user_1.ics',
    );
  });

  it('blocks second free syncs without an ad', async () => {
    const resetSyncState = async () => {};
    const incrementSyncCount = async () => {};

    await expect(applyCanvasSyncQuota({
      user: {
        subscription_tier: 'free',
        role: 'user',
        simulate_free_tier: false,
        lms_sync_count: 1,
        lms_sync_reset_at: new Date().toISOString(),
      },
      adGranted: false,
      resetSyncState,
      incrementSyncCount,
    })).rejects.toMatchObject({
      message: 'Free sync limit reached for today. Watch an ad or upgrade for more syncs.',
      status: 429,
      canWatchAd: true,
    });
  });

  it('resets stale sync counters before incrementing', async () => {
    const resetCalls = [];
    const incrementCalls = [];

    await applyCanvasSyncQuota({
      user: {
        subscription_tier: 'free',
        role: 'user',
        simulate_free_tier: false,
        lms_sync_count: 4,
        lms_sync_reset_at: '2026-03-10T00:00:00.000Z',
      },
      adGranted: false,
      now: new Date('2026-03-14T12:00:00.000Z'),
      resetSyncState: async (now) => {
        resetCalls.push(now.toISOString());
      },
      incrementSyncCount: async (nextCount) => {
        incrementCalls.push(nextCount);
      },
    });

    expect(resetCalls).toEqual(['2026-03-14T12:00:00.000Z']);
    expect(incrementCalls).toEqual([1]);
  });

  it('creates classes and assignments from Canvas VEVENT rows while skipping duplicates', async () => {
    const createdClasses = [];
    const createdAssignments = [];

    const result = await syncCanvasCalendar({
      userId: 42,
      now: new Date('2026-03-14T12:00:00.000Z'),
      events: {
        a: {
          type: 'VEVENT',
          summary: 'Lab Report [Biology]',
          description: 'Submit PDF',
          uid: 'bio-1',
          end: new Date('2026-03-16T17:00:00.000Z'),
        },
        b: {
          type: 'VEVENT',
          summary: 'Old Quiz [Biology]',
          description: 'Late',
          uid: 'bio-2',
          end: new Date('2026-03-01T17:00:00.000Z'),
        },
        c: {
          type: 'VEVENT',
          summary: 'Duplicate [Biology]',
          description: '',
          uid: 'existing-uid',
          end: new Date('2026-03-18T17:00:00.000Z'),
        },
      },
      existingClasses: [],
      existingAssignmentIds: ['existing-uid'],
      createClass: async (userId, courseName) => {
        createdClasses.push({ userId, courseName });
        return { id: 'class-1' };
      },
      createAssignment: async (userId, classId, assignment) => {
        createdAssignments.push({ userId, classId, assignment });
      },
    });

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 1,
      assignmentsAdded: 2,
    });
    expect(createdClasses).toEqual([{ userId: 42, courseName: 'Biology' }]);
    expect(createdAssignments).toEqual([
      {
        userId: 42,
        classId: 'class-1',
        assignment: {
          uid: 'bio-1',
          courseName: 'Biology',
          title: 'Lab Report',
          description: 'Submit PDF',
          dueDateIso: '2026-03-16T17:00:00.000Z',
          status: 'Todo',
        },
      },
      {
        userId: 42,
        classId: 'class-1',
        assignment: {
          uid: 'bio-2',
          courseName: 'Biology',
          title: 'Old Quiz',
          description: 'Late',
          dueDateIso: '2026-03-01T17:00:00.000Z',
          status: 'Archived',
        },
      },
    ]);
  });

  it('selects only due premium users for Canvas auto-sync', () => {
    const selected = selectCanvasAutoSyncUsers({
      now: new Date('2026-03-21T12:00:00.000Z'),
      users: [
        {
          id: 1,
          canvas_ical_url: 'https://canvas.example.edu/feeds/calendars/user_1.ics',
          canvas_auto_sync_enabled: true,
          subscription_tier: 'supporter',
          role: 'user',
          simulate_free_tier: false,
          last_canvas_sync_at: '2026-03-20T00:00:00.000Z',
          last_canvas_auto_sync_attempt_at: '2026-03-20T00:00:00.000Z',
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
        {
          id: 4,
          canvas_ical_url: 'https://canvas.example.edu/feeds/calendars/user_4.ics',
          canvas_auto_sync_enabled: true,
          subscription_tier: 'lifetime',
          role: 'user',
          simulate_free_tier: false,
          last_canvas_sync_at: '2026-03-21T02:00:00.000Z',
          last_canvas_auto_sync_attempt_at: '2026-03-21T11:20:00.000Z',
        },
      ],
    });

    expect(selected.map((user) => user.id)).toEqual([1]);
  });

  it('does not increment assignment totals when inserts are skipped by the unique Canvas index', async () => {
    const result = await syncCanvasCalendar({
      userId: 42,
      now: new Date('2026-03-14T12:00:00.000Z'),
      events: {
        a: {
          type: 'VEVENT',
          summary: 'Lab Report [Biology]',
          description: 'Submit PDF',
          uid: 'bio-1',
          end: new Date('2026-03-16T17:00:00.000Z'),
        },
      },
      existingClasses: [{ id: 'class-1', name: 'Biology' }],
      existingAssignmentIds: [],
      createClass: async () => {
        throw new Error('should not create class');
      },
      createAssignment: async () => ({ inserted: false }),
    });

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 0,
      assignmentsAdded: 0,
    });
  });
});
