import { describe, expect, it } from 'vitest';

import {
    buildDefaultClassTimeRow,
    isValidTimeRange,
    toTwelveHourParts,
    toTwentyFourHourTime,
} from './classTime';

describe('class time utilities', () => {
    it('converts stored 24-hour times into 12-hour parts', () => {
        expect(toTwelveHourParts('13:30')).toEqual({
            hour: '1',
            minute: '30',
            meridiem: 'PM',
        });
    });

    it('converts 12-hour parts back into 24-hour strings', () => {
        expect(toTwentyFourHourTime({ hour: '1', minute: '30', meridiem: 'PM' })).toBe('13:30');
    });

    it('handles noon and midnight correctly', () => {
        expect(toTwentyFourHourTime({ hour: '12', minute: '00', meridiem: 'AM' })).toBe('00:00');
        expect(toTwentyFourHourTime({ hour: '12', minute: '00', meridiem: 'PM' })).toBe('12:00');
    });

    it('creates a sensible default class time row', () => {
        expect(buildDefaultClassTimeRow()).toEqual({
            day: '',
            start_time: '09:00',
            end_time: '10:00',
            id: null,
        });
    });

    it('validates that end time must be after start time', () => {
        expect(isValidTimeRange('09:00', '10:00')).toBe(true);
        expect(isValidTimeRange('13:30', '13:30')).toBe(false);
        expect(isValidTimeRange('14:00', '13:30')).toBe(false);
    });
});
