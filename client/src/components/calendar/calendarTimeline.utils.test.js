import { describe, expect, it } from 'vitest';
import {
    HOUR_HEIGHT,
    START_HOUR,
    buildVisibleDates,
    getDefaultScrollTop,
    layoutTimedEvents,
} from './calendarTimeline.utils';

describe('calendarTimeline utils', () => {
    it('builds a seven-day range starting on Sunday for week view', () => {
        const dates = buildVisibleDates(new Date('2026-05-20T12:00:00'), 'week');

        expect(dates).toHaveLength(7);
        expect(dates[0].toISOString().slice(0, 10)).toBe('2026-05-17');
        expect(dates[6].toISOString().slice(0, 10)).toBe('2026-05-23');
    });

    it('assigns separate lanes to overlapping events', () => {
        const events = layoutTimedEvents([
            { id: 'a', startMinutes: 540, endMinutes: 600 },
            { id: 'b', startMinutes: 555, endMinutes: 615 },
            { id: 'c', startMinutes: 620, endMinutes: 660 },
        ]);

        const byId = Object.fromEntries(events.map((event) => [event.id, event]));

        expect(byId.a.laneIndex).toBe(0);
        expect(byId.b.laneIndex).toBe(1);
        expect(byId.a.laneCount).toBe(2);
        expect(byId.b.laneCount).toBe(2);
        expect(byId.c.laneCount).toBe(1);
    });

    it('scrolls toward the first relevant event with a one-hour buffer', () => {
        const scrollTop = getDefaultScrollTop([
            { startMinutes: 9 * 60, endMinutes: 10 * 60 },
        ], 'week');

        expect(scrollTop).toBe(((8 * 60) - (START_HOUR * 60)) / 60 * HOUR_HEIGHT);
    });
});
