import { describe, expect, it } from 'vitest';
import {
    getMemberSourceId,
    groupToCalendar,
    MEETUP_COLOR,
    MEETUP_SOURCE_ID,
    MEMBER_COLORS,
} from './calendarModel';

const MEMBERS = [
    { id: 'u1', first_name: 'Alice', last_name: 'A', share_mode: 'full' },
    { id: 'u2', first_name: 'Bob', last_name: 'B', share_mode: 'busy_free' },
    { id: 'u3', first_name: 'Carol', last_name: 'C', share_mode: 'hidden' },
];

const SLOTS = [
    { id: 's1', user_id: 'u1', class_is_archived: false, title: 'CS101' },
    { id: 's2', user_id: 'u2', class_is_archived: false, title: 'MATH' },
    { id: 's3', user_id: 'u1', class_is_archived: true, title: 'OLD' },
    { id: 's4', user_id: 'u3', class_is_archived: false, title: 'Hidden slot' },
];

const MEETUPS = [
    { id: 'm1', topic: 'Review', start_at: '2026-06-15T18:00:00Z', end_at: '2026-06-15T19:00:00Z', status: 'active' },
    { id: 'm2', topic: 'Cancelled', start_at: '2026-06-16T18:00:00Z', end_at: '2026-06-16T19:00:00Z', status: 'cancelled' },
];

describe('getMemberSourceId', () => {
    it('returns stable member: prefix id', () => {
        expect(getMemberSourceId('u1')).toBe('member:u1');
    });
});

describe('groupToCalendar — constants', () => {
    it('MEETUP_SOURCE_ID is the well-known key', () => {
        expect(MEETUP_SOURCE_ID).toBe('group-meetups');
    });

    it('MEETUP_COLOR is the gold used in GroupScheduleHub', () => {
        expect(MEETUP_COLOR).toBe('#deb96a');
    });

    it('MEMBER_COLORS has 8 entries', () => {
        expect(MEMBER_COLORS).toHaveLength(8);
    });
});

describe('groupToCalendar — defaults', () => {
    it('returns empty shape when called with no args', () => {
        const result = groupToCalendar();
        expect(result.sources).toHaveLength(1); // just the meetup lane
        expect(result.sources[0].id).toBe(MEETUP_SOURCE_ID);
        expect(result.scheduleSlots).toHaveLength(0);
        expect(result.events).toHaveLength(0);
    });
});

describe('groupToCalendar — sources', () => {
    it('always includes the meetup lane as the first source', () => {
        const { sources } = groupToCalendar({ members: MEMBERS });
        expect(sources[0]).toMatchObject({
            id: MEETUP_SOURCE_ID,
            name: 'Study Sessions',
            color: MEETUP_COLOR,
            room: 'Group meetup',
        });
    });

    it('creates one source per non-hidden member', () => {
        const { sources } = groupToCalendar({ members: MEMBERS });
        // 2 visible (u1 full, u2 busy_free) + 1 meetup lane = 3
        expect(sources).toHaveLength(3);
        expect(sources.map((s) => s.id)).not.toContain(getMemberSourceId('u3'));
    });

    it('sets room to "Full schedule" for full members', () => {
        const { sources } = groupToCalendar({ members: MEMBERS });
        const u1 = sources.find((s) => s.id === getMemberSourceId('u1'));
        expect(u1?.room).toBe('Full schedule');
    });

    it('sets room to "Busy/free" for busy_free members', () => {
        const { sources } = groupToCalendar({ members: MEMBERS });
        const u2 = sources.find((s) => s.id === getMemberSourceId('u2'));
        expect(u2?.room).toBe('Busy/free');
    });

    it('assigns colors from MEMBER_COLORS by index', () => {
        const { sources } = groupToCalendar({ members: MEMBERS });
        expect(sources[1].color).toBe(MEMBER_COLORS[0]);
        expect(sources[2].color).toBe(MEMBER_COLORS[1]);
    });

    it('wraps color index for groups with >8 members', () => {
        const manyMembers = Array.from({ length: 10 }, (_, i) => ({
            id: `u${i}`, first_name: `M${i}`, last_name: '', share_mode: 'busy_free',
        }));
        const { sources } = groupToCalendar({ members: manyMembers });
        // source[9] is the 9th member (index 8); 8 % 8 === 0
        expect(sources[9].color).toBe(MEMBER_COLORS[0]);
    });
});

describe('groupToCalendar — scheduleSlots', () => {
    it('re-keys slots onto member source ids', () => {
        const { scheduleSlots } = groupToCalendar({ members: MEMBERS, schedule_slots: SLOTS });
        for (const slot of scheduleSlots) {
            expect(slot.class_id).toBe(getMemberSourceId(slot.user_id));
        }
    });

    it('drops archived slots', () => {
        const { scheduleSlots } = groupToCalendar({ members: MEMBERS, schedule_slots: SLOTS });
        expect(scheduleSlots.find((s) => s.id === 's3')).toBeUndefined();
    });

    it('drops slots belonging to hidden members', () => {
        const { scheduleSlots } = groupToCalendar({ members: MEMBERS, schedule_slots: SLOTS });
        expect(scheduleSlots.find((s) => s.id === 's4')).toBeUndefined();
    });

    it('keeps slots for visible members', () => {
        const { scheduleSlots } = groupToCalendar({ members: MEMBERS, schedule_slots: SLOTS });
        const ids = scheduleSlots.map((s) => s.id);
        expect(ids).toContain('s1');
        expect(ids).toContain('s2');
        expect(ids).toHaveLength(2);
    });
});

describe('groupToCalendar — events (meetups)', () => {
    it('maps meetup fields onto CalendarEvent shape', () => {
        const { events } = groupToCalendar({ meetups: MEETUPS });
        expect(events[0]).toMatchObject({
            id: 'm1',
            title: 'Review',
            due_date: '2026-06-15T18:00:00Z',
            end_date: '2026-06-15T19:00:00Z',
            class_id: MEETUP_SOURCE_ID,
            assignment_type: 'study session',
            calendar_kind: 'meetup',
        });
    });

    it('sets assignment_type to "cancelled" for cancelled meetups', () => {
        const { events } = groupToCalendar({ meetups: MEETUPS });
        expect(events[1].assignment_type).toBe('cancelled');
    });
});
