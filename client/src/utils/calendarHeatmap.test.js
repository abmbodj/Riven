import { describe, expect, it } from 'vitest';
import {
    buildAvailabilityHeatmap,
    resolveAvailabilityWindow,
    startOfWeek,
    getRollingWeekDays,
} from './calendarDates';

// Build the Sunday-anchored week containing a known Wednesday (2026-06-17).
const WEEK_DAYS = (() => {
    const sunday = startOfWeek(new Date(2026, 5, 17));
    return getRollingWeekDays(sunday);
})();
const WED_INDEX = 3; // Sunday-anchored week → Wednesday is index 3.

const MEMBERS = [
    { id: 'a', share_mode: 'busy_free' },
    { id: 'b', share_mode: 'full' },
    { id: 'c', share_mode: 'hidden' },   // hidden → never counted
    { id: 'd', share_mode: 'busy_free' }, // participates but paints nothing → excluded
];

describe('buildAvailabilityHeatmap', () => {
    it('excludes members with no painted data from the denominator', () => {
        const availability = [
            { user_id: 'a', day_of_week: 3, hour: 15 },
            { user_id: 'b', day_of_week: 3, hour: 15 },
        ];

        const { denominator } = buildAvailabilityHeatmap({
            weekDays: WEEK_DAYS,
            startHour: 8,
            endHour: 23,
            members: MEMBERS,
            availability,
        });

        // a + b have data and participate; c is hidden; d painted nothing.
        expect(denominator).toBe(2);
    });

    it('counts a member free only when painted free AND not in class', () => {
        const availability = [
            { user_id: 'a', day_of_week: 3, hour: 15 },
            { user_id: 'b', day_of_week: 3, hour: 15 },
        ];
        const scheduleSlots = [
            // b has class 15:00–16:00 Wednesday → blocked despite painting free.
            { user_id: 'b', day_of_week: 3, start_time: '15:00', end_time: '16:00' },
        ];

        const { cells } = buildAvailabilityHeatmap({
            weekDays: WEEK_DAYS,
            startHour: 8,
            endHour: 23,
            members: MEMBERS,
            availability,
            scheduleSlots,
        });

        const cell = cells.get(`${WED_INDEX}-15`);
        expect(cell.freeCount).toBe(1);
        expect(cell.freeMemberIds).toEqual(['a']);
        expect(cell.busyMemberIds).toEqual(['b']);
    });

    it('marks a cell as taken when an active meetup overlaps it', () => {
        const availability = [{ user_id: 'a', day_of_week: 3, hour: 15 }];
        const wednesday = WEEK_DAYS[WED_INDEX];
        const start = new Date(wednesday);
        start.setHours(15, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const { cells } = buildAvailabilityHeatmap({
            weekDays: WEEK_DAYS,
            startHour: 8,
            endHour: 23,
            members: MEMBERS,
            availability,
            meetups: [{ id: 'm1', status: 'scheduled', start_at: start.toISOString(), end_at: end.toISOString() }],
        });

        const cell = cells.get(`${WED_INDEX}-15`);
        expect(cell.meetup?.id).toBe('m1');
        expect(cell.freeCount).toBe(0);
    });

    it('ignores cancelled meetups', () => {
        const availability = [{ user_id: 'a', day_of_week: 3, hour: 15 }];
        const wednesday = WEEK_DAYS[WED_INDEX];
        const start = new Date(wednesday);
        start.setHours(15, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);

        const { cells } = buildAvailabilityHeatmap({
            weekDays: WEEK_DAYS,
            startHour: 8,
            endHour: 23,
            members: MEMBERS,
            availability,
            meetups: [{ id: 'm1', status: 'cancelled', start_at: start.toISOString(), end_at: end.toISOString() }],
        });

        const cell = cells.get(`${WED_INDEX}-15`);
        expect(cell.meetup).toBeNull();
        expect(cell.freeCount).toBe(1);
    });
});

describe('resolveAvailabilityWindow', () => {
    it('falls back to the default waking window with no data', () => {
        expect(resolveAvailabilityWindow([], [])).toEqual({ startHour: 8, endHour: 23 });
    });

    it('widens to include early/late painted hours with a buffer', () => {
        const window = resolveAvailabilityWindow([
            { user_id: 'a', day_of_week: 1, hour: 7 },
        ]);
        expect(window.startHour).toBe(6); // 7 - 1 buffer
        expect(window.endHour).toBe(23);
    });
});
