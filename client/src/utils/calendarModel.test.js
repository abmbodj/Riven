import { describe, expect, it } from 'vitest';
import {
    AVAILABILITY_RGB,
    formatFreeLabel,
    getHeatmapCellStyle,
    getMeetupStateLabel,
    isMeetupCancelled,
    isMeetupEnded,
    MEETUP_COLOR,
} from './calendarModel';

describe('calendarModel — constants', () => {
    it('MEETUP_COLOR is the gold used across the group calendar', () => {
        expect(MEETUP_COLOR).toBe('#deb96a');
    });
});

describe('getHeatmapCellStyle', () => {
    it('returns a faint neutral when there is no shared data (denominator 0)', () => {
        expect(getHeatmapCellStyle(0, 0)).toEqual({ backgroundColor: 'rgba(255, 255, 255, 0.03)' });
    });

    it('returns a neutral wash when nobody is free at the cell', () => {
        expect(getHeatmapCellStyle(0, 4)).toEqual({ backgroundColor: 'rgba(255, 255, 255, 0.04)' });
    });

    it('scales green opacity with the free ratio', () => {
        const half = getHeatmapCellStyle(2, 4);
        const full = getHeatmapCellStyle(4, 4);
        expect(half.backgroundColor).toContain(AVAILABILITY_RGB);
        expect(full.backgroundColor).toContain(AVAILABILITY_RGB);
        // Fuller overlap → stronger alpha.
        const halfAlpha = Number(half.backgroundColor.match(/, ([\d.]+)\)$/)[1]);
        const fullAlpha = Number(full.backgroundColor.match(/, ([\d.]+)\)$/)[1]);
        expect(fullAlpha).toBeGreaterThan(halfAlpha);
    });
});

describe('formatFreeLabel', () => {
    it('returns null when there is no data', () => {
        expect(formatFreeLabel(0, 0)).toBeNull();
    });

    it('formats an X of N label', () => {
        expect(formatFreeLabel(3, 5)).toBe('3 of 5 free');
    });
});

describe('meetup state helpers', () => {
    it('detects cancelled meetups', () => {
        expect(isMeetupCancelled({ status: 'cancelled' })).toBe(true);
        expect(isMeetupCancelled({ status: 'scheduled' })).toBe(false);
    });

    it('detects ended meetups relative to a stable clock', () => {
        const now = new Date('2026-06-18T17:00:00Z').getTime();

        expect(isMeetupEnded({
            status: 'scheduled',
            end_at: '2026-06-18T16:59:00Z',
        }, now)).toBe(true);
        expect(isMeetupEnded({
            status: 'scheduled',
            end_at: '2026-06-18T17:01:00Z',
        }, now)).toBe(false);
        expect(isMeetupEnded({
            status: 'cancelled',
            end_at: '2026-06-18T16:59:00Z',
        }, now)).toBe(false);
    });

    it('labels meetup state by membership', () => {
        const now = new Date('2026-06-18T17:00:00Z').getTime();

        expect(getMeetupStateLabel({ status: 'cancelled' })).toBe('Cancelled');
        expect(getMeetupStateLabel({ status: 'scheduled', end_at: '2026-06-18T16:59:00Z' }, now)).toBe('Ended');
        expect(getMeetupStateLabel({ is_joined: true }, now)).toBe('Going');
        expect(getMeetupStateLabel({ is_creator: true }, now)).toBe('You proposed');
        expect(getMeetupStateLabel({}, now)).toBe('Open');
    });
});
