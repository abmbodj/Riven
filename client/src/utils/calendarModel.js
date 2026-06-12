/**
 * Normalized calendar model — the shared vocabulary every calendar surface
 * (personal, group, exams) feeds into the presentational components
 * (CalendarGrid / CalendarTimeline / DaySheet).
 *
 * Today this owns the GROUP adapter, lifted verbatim out of GroupScheduleHub so
 * the normalization lives in one tested place instead of inline in a 1100-line
 * component. Personal/exam adapters can join here when those surfaces are
 * refactored onto the same shape.
 *
 * @typedef {Object} CalendarEvent
 * @property {string|number} id
 * @property {string} title
 * @property {string} due_date            ISO start timestamp
 * @property {string} [end_date]          ISO end timestamp
 * @property {string|number|null} [class_id]   colour / source the event belongs to
 * @property {string} [assignment_type]
 * @property {'assignment'|'meetup'|'exam'|'class'} [calendar_kind]
 * @property {Object} [meta]
 *
 * @typedef {Object} CalendarSource
 * @property {string|number} id
 * @property {string} name
 * @property {string} color
 * @property {string} [room]
 */

import { formatMemberName } from './calendarDates';

const EMPTY_ARRAY = [];

// The group calendar renders one lane for proposed study sessions plus one lane
// per member who shares availability. These constants are the single source of
// truth for that mapping (imported by GroupScheduleHub).
export const MEETUP_SOURCE_ID = 'group-meetups';
export const MEETUP_COLOR = '#deb96a';
export const MEMBER_COLORS = ['#7a9e72', '#5e7b8f', '#c47c7c', '#8b5cf6', '#06b6d4', '#f59e0b', '#22c55e', '#ec4899'];

/** Stable calendar-source id for a group member's availability lane. */
export function getMemberSourceId(memberId) {
    return `member:${memberId}`;
}

/**
 * Normalize a group schedule payload into the shared calendar shape.
 *
 * @param {{ members?: any[], schedule_slots?: any[], meetups?: any[] }} payload
 * @returns {{ sources: CalendarSource[], scheduleSlots: any[], events: CalendarEvent[] }}
 *   - `sources`: the "Study Sessions" lane followed by one lane per visible member
 *   - `scheduleSlots`: member availability bands re-keyed onto their member source
 *     (archived classes and hidden members dropped)
 *   - `events`: meetups as calendar events
 */
export function groupToCalendar({ members = EMPTY_ARRAY, schedule_slots = EMPTY_ARRAY, meetups = EMPTY_ARRAY } = {}) {
    const memberSources = members
        .filter((member) => member.share_mode !== 'hidden')
        .map((member, index) => ({
            id: getMemberSourceId(member.id),
            name: formatMemberName(member),
            color: MEMBER_COLORS[index % MEMBER_COLORS.length],
            room: member.share_mode === 'full' ? 'Full schedule' : 'Busy/free',
        }));

    const sources = [
        {
            id: MEETUP_SOURCE_ID,
            name: 'Study Sessions',
            color: MEETUP_COLOR,
            room: 'Group meetup',
        },
        ...memberSources,
    ];

    const visibleSourceIds = new Set(sources.map((source) => source.id));
    const scheduleSlots = schedule_slots
        .filter((slot) => slot.class_is_archived !== true)
        .map((slot) => ({ ...slot, class_id: getMemberSourceId(slot.user_id) }))
        .filter((slot) => visibleSourceIds.has(slot.class_id));

    const events = meetups.map((meetup) => ({
        id: meetup.id,
        title: meetup.topic,
        due_date: meetup.start_at,
        end_date: meetup.end_at,
        class_id: MEETUP_SOURCE_ID,
        assignment_type: meetup.status === 'cancelled' ? 'cancelled' : 'study session',
        calendar_kind: 'meetup',
    }));

    return { sources, scheduleSlots, events };
}
