import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
    isNativePlatformMock,
    requestPermissionsMock,
    checkPermissionsMock,
    getPendingMock,
    cancelMock,
    scheduleMock,
} = vi.hoisted(() => ({
    isNativePlatformMock: vi.fn(),
    requestPermissionsMock: vi.fn(),
    checkPermissionsMock: vi.fn(),
    getPendingMock: vi.fn(),
    cancelMock: vi.fn(),
    scheduleMock: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: isNativePlatformMock,
    },
}));

vi.mock('@capacitor/local-notifications', () => ({
    LocalNotifications: {
        requestPermissions: requestPermissionsMock,
        checkPermissions: checkPermissionsMock,
        getPending: getPendingMock,
        cancel: cancelMock,
        schedule: scheduleMock,
    },
}));

import {
    scheduleAssignmentNotifications,
    scheduleMeetupNotifications,
} from './notifications.js';

const NOW = new Date('2026-03-21T12:00:00.000Z');

function createAssignment({ id = 1, title = 'Assignment', status = 'Todo', dueDateHoursFromNow = 30, due_date } = {}) {
    return {
        id,
        title,
        status,
        due_date: due_date ?? new Date(NOW.getTime() + dueDateHoursFromNow * 60 * 60 * 1000).toISOString(),
    };
}

function getScheduledNotifications() {
    return scheduleMock.mock.calls[0]?.[0]?.notifications ?? [];
}

describe('scheduleAssignmentNotifications', () => {
    let consoleErrorSpy;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        vi.clearAllMocks();

        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        isNativePlatformMock.mockReturnValue(true);
        requestPermissionsMock.mockResolvedValue({ display: 'granted' });
        checkPermissionsMock.mockResolvedValue({ display: 'granted' });
        getPendingMock.mockResolvedValue({ notifications: [] });
        cancelMock.mockResolvedValue(undefined);
        scheduleMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        vi.useRealTimers();
    });

    it('schedules all five reminder offsets for one eligible future assignment', async () => {
        const dueDate = new Date(NOW.getTime() + 30 * 60 * 60 * 1000);

        await scheduleAssignmentNotifications([
            createAssignment({ title: 'Midterm Essay', due_date: dueDate.toISOString() }),
        ], true);

        expect(scheduleMock).toHaveBeenCalledTimes(1);
        const notifications = getScheduledNotifications();
        expect(notifications).toHaveLength(5);
        expect(notifications.map((notification) => notification.body)).toEqual([
            'Midterm Essay is due tomorrow.',
            'Midterm Essay is due in 12 hours.',
            'Midterm Essay is due in 3 hours.',
            'Midterm Essay is due in 1 hour.',
            'Midterm Essay is due in 30 minutes.',
        ]);
        expect(notifications.map((notification) => notification.schedule.at.toISOString())).toEqual([
            new Date(dueDate.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            new Date(dueDate.getTime() - 12 * 60 * 60 * 1000).toISOString(),
            new Date(dueDate.getTime() - 3 * 60 * 60 * 1000).toISOString(),
            new Date(dueDate.getTime() - 1 * 60 * 60 * 1000).toISOString(),
            new Date(dueDate.getTime() - 30 * 60 * 1000).toISOString(),
        ]);
    });

    it('skips past-due, invalid, missing, done, and archived assignments', async () => {
        await scheduleAssignmentNotifications([
            createAssignment({ title: 'Past Due', dueDateHoursFromNow: -1 }),
            { id: 2, title: 'Bad Date', status: 'Todo', due_date: 'not-a-date' },
            { id: 3, title: 'No Due Date', status: 'Todo', due_date: null },
            createAssignment({ id: 4, title: 'Done Work', status: 'Done', dueDateHoursFromNow: 30 }),
            createAssignment({ id: 5, title: 'Archived Work', status: 'Archived', dueDateHoursFromNow: 30 }),
        ], true);

        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('skips reminder offsets that are already in the past for near-term assignments', async () => {
        const dueDate = new Date(NOW.getTime() + 2 * 60 * 60 * 1000);

        await scheduleAssignmentNotifications([
            createAssignment({ title: 'Quiz Review', due_date: dueDate.toISOString() }),
        ], true);

        const notifications = getScheduledNotifications();
        expect(notifications).toHaveLength(2);
        expect(notifications.map((notification) => notification.body)).toEqual([
            'Quiz Review is due in 1 hour.',
            'Quiz Review is due in 30 minutes.',
        ]);
    });

    it('cancels pending notifications when notifications are disabled', async () => {
        getPendingMock.mockResolvedValue({
            notifications: [{ id: 9 }, { id: 10 }],
        });

        await scheduleAssignmentNotifications([createAssignment()], false);

        expect(cancelMock).toHaveBeenCalledWith({
            notifications: [{ id: 9 }, { id: 10 }],
        });
        expect(scheduleMock).not.toHaveBeenCalled();
    });

    it('cancels only assignment notification ids when disabled', async () => {
        getPendingMock.mockResolvedValue({
            notifications: [{ id: 9 }, { id: 50_002 }],
        });

        await scheduleAssignmentNotifications([createAssignment()], false);

        expect(cancelMock).toHaveBeenCalledWith({
            notifications: [{ id: 9 }],
        });
    });

    it('prioritizes the soonest due assignments and respects the 50 notification cap', async () => {
        const assignments = Array.from({ length: 12 }, (_, index) => (
            createAssignment({
                id: index + 1,
                title: `Assignment ${index + 1}`,
                due_date: new Date(NOW.getTime() + (26 + index) * 60 * 60 * 1000).toISOString(),
            })
        )).reverse();

        await scheduleAssignmentNotifications(assignments, true);

        const notifications = getScheduledNotifications();
        expect(notifications).toHaveLength(50);
        expect(notifications[0].body).toBe('Assignment 1 is due tomorrow.');

        for (let index = 1; index <= 10; index += 1) {
            expect(
                notifications.some((notification) => notification.body.startsWith(`Assignment ${index} is due`))
            ).toBe(true);
        }

        for (let index = 11; index <= 12; index += 1) {
            expect(
                notifications.some((notification) => notification.body.startsWith(`Assignment ${index} is due`))
            ).toBe(false);
        }
    });

    it('adds an adaptive cram reminder for exam items with weak-topic pressure inside 72 hours', async () => {
        const dueDate = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);

        await scheduleAssignmentNotifications([
            {
                ...createAssignment({
                    id: 21,
                    title: 'Biology Midterm',
                    due_date: dueDate.toISOString(),
                }),
                assignment_type: 'exam',
                study_recommendation: {
                    should_cram: true,
                    weak_topic_count: 3,
                },
            },
        ], true);

        const notifications = getScheduledNotifications();
        expect(notifications.some((notification) => notification.title === 'Cram Mode Recommended')).toBe(true);
        expect(
            notifications.some((notification) => notification.body.includes('3 weak topics'))
        ).toBe(true);
    });
});

describe('scheduleMeetupNotifications', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        vi.clearAllMocks();

        isNativePlatformMock.mockReturnValue(true);
        checkPermissionsMock.mockResolvedValue({ display: 'granted' });
        getPendingMock.mockResolvedValue({ notifications: [] });
        cancelMock.mockResolvedValue(undefined);
        scheduleMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('schedules reminder and starting-now notifications for joined meetups', async () => {
        const meetupStart = new Date(NOW.getTime() + 4 * 60 * 60 * 1000);

        await scheduleMeetupNotifications([
            {
                meetup_id: 'meetup-1',
                group_name: 'Biology Lab',
                topic: 'Cell respiration review',
                start_at: meetupStart.toISOString(),
                end_at: new Date(meetupStart.getTime() + 60 * 60 * 1000).toISOString(),
                location_label: 'Library East',
                status: 'scheduled',
            },
        ], true);

        const notifications = getScheduledNotifications();
        expect(notifications).toHaveLength(2);
        expect(notifications.map((notification) => notification.title)).toEqual([
            'Biology Lab starts in 30 minutes',
            'Biology Lab is starting now',
        ]);
        expect(notifications[0].body).toContain('Cell respiration review');
        expect(notifications[0].body).toContain('Library East');
        expect(notifications[0].id).toBeGreaterThanOrEqual(50_000);
    });

    it('cancels only meetup notifications when disabled', async () => {
        getPendingMock.mockResolvedValue({
            notifications: [{ id: 9 }, { id: 50_010 }],
        });

        await scheduleMeetupNotifications([], false);

        expect(cancelMock).toHaveBeenCalledWith({
            notifications: [{ id: 50_010 }],
        });
    });
});
