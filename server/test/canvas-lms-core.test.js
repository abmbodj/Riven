import { describe, expect, it, vi } from 'vitest';

import {
  applyCanvasSyncQuota,
  buildCanvasSemesterArchiveAssignmentUpdates,
  buildCanvasSemesterCleanupPreview,
  buildCanvasSemesterRestoreAssignmentUpdates,
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

  it('blocks SSRF targets (RIV-002)', () => {
    // Non-https is rejected before anything else.
    expect(() => validateCanvasFeedUrl('http://169.254.169.254/feeds/calendars/x.ics')).toThrowError(
      'Canvas Calendar link must use https.',
    );
    // Cloud metadata / private IP literals over https are rejected.
    expect(() => validateCanvasFeedUrl('https://169.254.169.254/feeds/calendars/x.ics')).toThrowError(
      'Canvas Calendar link is not allowed.',
    );
    expect(() => validateCanvasFeedUrl('https://127.0.0.1/feeds/calendars/x.ics')).toThrowError(
      'Canvas Calendar link is not allowed.',
    );
    expect(() => validateCanvasFeedUrl('https://10.0.0.5/feeds/calendars/x.ics')).toThrowError(
      'Canvas Calendar link is not allowed.',
    );
    expect(() => validateCanvasFeedUrl('https://localhost/feeds/calendars/x.ics')).toThrowError(
      'Canvas Calendar link is not allowed.',
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
          canvasCourseId: 'Biology',
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
          canvasCourseId: 'Biology',
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
    const linkClassToCanvasCourse = vi.fn(async (classId, canvasCourseId) => ({
      id: classId,
      name: 'Biology',
      canvas_course_id: canvasCourseId,
    }));

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
      linkClassToCanvasCourse,
      createAssignment: async () => ({ inserted: false }),
    });

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 0,
      assignmentsAdded: 0,
    });
    expect(linkClassToCanvasCourse).toHaveBeenCalledWith('class-1', 'Biology');
  });

  it('reuses an existing renamed class when its Canvas course key already matches', async () => {
    const createClass = vi.fn(async () => {
      throw new Error('should not create class');
    });
    const linkClassToCanvasCourse = vi.fn(async () => {
      throw new Error('should not relink class');
    });
    const createdAssignments = [];

    const result = await syncCanvasCalendar({
      userId: 42,
      now: new Date('2026-03-14T12:00:00.000Z'),
      events: {
        a: {
          type: 'VEVENT',
          summary: 'Lab Report [Biology]',
          description: 'Submit PDF',
          uid: 'bio-new',
          end: new Date('2026-03-16T17:00:00.000Z'),
        },
      },
      existingClasses: [
        {
          id: 'class-1',
          name: 'AP Biology',
          canvas_course_id: 'Biology',
          created_at: '2026-03-01T12:00:00.000Z',
        },
      ],
      existingAssignments: [],
      createClass,
      linkClassToCanvasCourse,
      createAssignment: async (userId, classId, assignment) => {
        createdAssignments.push({ userId, classId, assignment });
        return { inserted: true };
      },
    });

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 0,
      assignmentsAdded: 1,
    });
    expect(createClass).not.toHaveBeenCalled();
    expect(linkClassToCanvasCourse).not.toHaveBeenCalled();
    expect(createdAssignments).toEqual([
      {
        userId: 42,
        classId: 'class-1',
        assignment: {
          uid: 'bio-new',
          courseName: 'Biology',
          canvasCourseId: 'Biology',
          title: 'Lab Report',
          description: 'Submit PDF',
          dueDateIso: '2026-03-16T17:00:00.000Z',
          status: 'Todo',
        },
      },
    ]);
  });

  it('backfills the Canvas course key from existing synced assignments before importing new work', async () => {
    const createClass = vi.fn(async () => {
      throw new Error('should not create class');
    });
    const linkClassToCanvasCourse = vi.fn(async (classId, canvasCourseId) => ({
      id: classId,
      name: 'AP Biology',
      canvas_course_id: canvasCourseId,
      created_at: '2026-03-01T12:00:00.000Z',
    }));
    const createdAssignments = [];

    const result = await syncCanvasCalendar({
      userId: 42,
      now: new Date('2026-03-14T12:00:00.000Z'),
      events: {
        a: {
          type: 'VEVENT',
          summary: 'Existing Quiz [Biology]',
          description: 'Already synced',
          uid: 'bio-existing',
          end: new Date('2026-03-18T17:00:00.000Z'),
        },
        b: {
          type: 'VEVENT',
          summary: 'New Lab [Biology]',
          description: 'Bring notebook',
          uid: 'bio-new',
          end: new Date('2026-03-20T17:00:00.000Z'),
        },
      },
      existingClasses: [
        {
          id: 'class-legacy',
          name: 'AP Biology',
          canvas_course_id: null,
          created_at: '2026-03-01T12:00:00.000Z',
        },
      ],
      existingAssignments: [
        {
          canvas_assignment_id: 'bio-existing',
          class_id: 'class-legacy',
        },
      ],
      createClass,
      linkClassToCanvasCourse,
      createAssignment: async (userId, classId, assignment) => {
        createdAssignments.push({ userId, classId, assignment });
        return { inserted: true };
      },
    });

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 0,
      assignmentsAdded: 1,
    });
    expect(createClass).not.toHaveBeenCalled();
    expect(linkClassToCanvasCourse).toHaveBeenCalledWith('class-legacy', 'Biology');
    expect(createdAssignments).toEqual([
      {
        userId: 42,
        classId: 'class-legacy',
        assignment: {
          uid: 'bio-new',
          courseName: 'Biology',
          canvasCourseId: 'Biology',
          title: 'New Lab',
          description: 'Bring notebook',
          dueDateIso: '2026-03-20T17:00:00.000Z',
          status: 'Todo',
        },
      },
    ]);
  });

  it('reuses an existing class returned by createClass conflict resolution without incrementing class totals', async () => {
    const createClass = vi.fn(async (_userId, courseName, canvasCourseId) => ({
      id: 'class-existing',
      name: `Renamed ${courseName}`,
      canvas_course_id: canvasCourseId,
      created: false,
    }));
    const createdAssignments = [];

    const result = await syncCanvasCalendar({
      userId: 42,
      now: new Date('2026-03-14T12:00:00.000Z'),
      events: {
        a: {
          type: 'VEVENT',
          summary: 'Conflict-safe Import [Biology]',
          description: 'Submit online',
          uid: 'bio-conflict-safe',
          end: new Date('2026-03-21T17:00:00.000Z'),
        },
      },
      existingClasses: [],
      existingAssignments: [],
      createClass,
      linkClassToCanvasCourse: async () => {
        throw new Error('should not relink class');
      },
      createAssignment: async (userId, classId, assignment) => {
        createdAssignments.push({ userId, classId, assignment });
        return { inserted: true };
      },
    });

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 0,
      assignmentsAdded: 1,
    });
    expect(createClass).toHaveBeenCalledWith(42, 'Biology', 'Biology');
    expect(createdAssignments).toEqual([
      {
        userId: 42,
        classId: 'class-existing',
        assignment: {
          uid: 'bio-conflict-safe',
          courseName: 'Biology',
          canvasCourseId: 'Biology',
          title: 'Conflict-safe Import',
          description: 'Submit online',
          dueDateIso: '2026-03-21T17:00:00.000Z',
          status: 'Todo',
        },
      },
    ]);
  });

  it('creates a new active class when the only Canvas course match is archived', async () => {
    const createClass = vi.fn(async (_userId, courseName, canvasCourseId) => ({
      id: 'class-new-semester',
      name: courseName,
      canvas_course_id: canvasCourseId,
      is_archived: false,
    }));
    const createdAssignments = [];

    const result = await syncCanvasCalendar({
      userId: 42,
      now: new Date('2026-09-01T12:00:00.000Z'),
      events: {
        a: {
          type: 'VEVENT',
          summary: 'Welcome Quiz [Biology]',
          description: 'New term kickoff',
          uid: 'bio-fall-quiz',
          end: new Date('2026-09-03T17:00:00.000Z'),
        },
      },
      existingClasses: [
        {
          id: 'class-spring',
          name: 'Biology',
          canvas_course_id: 'Biology',
          is_archived: true,
          archived_at: '2026-05-10T12:00:00.000Z',
          created_at: '2026-01-05T12:00:00.000Z',
        },
      ],
      existingAssignments: [],
      createClass,
      linkClassToCanvasCourse: async () => {
        throw new Error('should not relink archived class');
      },
      createAssignment: async (userId, classId, assignment) => {
        createdAssignments.push({ userId, classId, assignment });
        return { inserted: true };
      },
    });

    expect(result).toEqual({
      message: 'Canvas sync complete!',
      classesAdded: 1,
      assignmentsAdded: 1,
    });
    expect(createClass).toHaveBeenCalledWith(42, 'Biology', 'Biology');
    expect(createdAssignments[0]).toMatchObject({
      userId: 42,
      classId: 'class-new-semester',
      assignment: {
        uid: 'bio-fall-quiz',
        courseName: 'Biology',
      },
    });
  });

  it('builds a semester cleanup preview for all active classes', () => {
    const preview = buildCanvasSemesterCleanupPreview({
      classes: [
        {
          id: 'class-active',
          name: 'Biology',
          color: '#22c55e',
          canvas_course_id: 'Biology',
          is_archived: false,
          created_at: '2026-01-05T12:00:00.000Z',
        },
        {
          id: 'class-archived',
          name: 'Chemistry',
          canvas_course_id: 'Chemistry',
          is_archived: true,
          archived_at: '2026-05-10T12:00:00.000Z',
        },
        {
          id: 'class-manual',
          name: 'Study Hall',
          color: '#8b5cf6',
          canvas_course_id: null,
          is_archived: false,
          created_at: '2026-01-02T12:00:00.000Z',
        },
      ],
      assignments: [
        { id: 'a1', class_id: 'class-active', status: 'Todo', due_date: '2026-04-01T12:00:00.000Z' },
        { id: 'a2', class_id: 'class-active', status: 'Doing', due_date: '2026-04-02T12:00:00.000Z' },
        { id: 'a3', class_id: 'class-active', status: 'Done', due_date: '2026-03-15T12:00:00.000Z' },
        { id: 'a4', class_id: 'class-active', status: 'Archived', due_date: '2026-03-01T12:00:00.000Z' },
        { id: 'a5', class_id: 'class-manual', status: 'Todo', due_date: '2026-03-10T12:00:00.000Z' },
      ],
    });

    expect(preview.suggestedClassIds).toEqual(['class-active', 'class-manual']);
    expect(preview.classes).toEqual([
      expect.objectContaining({
        id: 'class-active',
        name: 'Biology',
        activeAssignmentCount: 2,
        totalAssignmentCount: 4,
        selected: true,
        suggested: true,
        canvasCourseId: 'Biology',
      }),
      expect.objectContaining({
        id: 'class-manual',
        name: 'Study Hall',
        activeAssignmentCount: 1,
        totalAssignmentCount: 1,
        selected: true,
        suggested: true,
        canvasCourseId: null,
      }),
    ]);
  });

  it('archives only unfinished assignments and stores their previous statuses', () => {
    const updates = buildCanvasSemesterArchiveAssignmentUpdates({
      now: new Date('2026-05-19T12:00:00.000Z'),
      assignments: [
        { id: 'todo', status: 'Todo' },
        { id: 'doing', status: 'Doing' },
        { id: 'done', status: 'Done' },
        { id: 'archived', status: 'Archived' },
      ],
    });

    expect(updates).toEqual([
      {
        id: 'todo',
        status: 'Archived',
        class_cleanup_archived_at: '2026-05-19T12:00:00.000Z',
        class_cleanup_previous_status: 'Todo',
      },
      {
        id: 'doing',
        status: 'Archived',
        class_cleanup_archived_at: '2026-05-19T12:00:00.000Z',
        class_cleanup_previous_status: 'Doing',
      },
    ]);
  });

  it('restores only assignments archived by semester cleanup', () => {
    const updates = buildCanvasSemesterRestoreAssignmentUpdates({
      assignments: [
        {
          id: 'cleanup-todo',
          status: 'Archived',
          class_cleanup_archived_at: '2026-05-19T12:00:00.000Z',
          class_cleanup_previous_status: 'Todo',
        },
        {
          id: 'manual-archived',
          status: 'Archived',
          class_cleanup_archived_at: null,
          class_cleanup_previous_status: null,
        },
        {
          id: 'cleanup-done',
          status: 'Archived',
          class_cleanup_archived_at: '2026-05-19T12:00:00.000Z',
          class_cleanup_previous_status: 'Done',
        },
      ],
    });

    expect(updates).toEqual([
      {
        id: 'cleanup-todo',
        status: 'Todo',
        class_cleanup_archived_at: null,
        class_cleanup_previous_status: null,
      },
    ]);
  });
});
