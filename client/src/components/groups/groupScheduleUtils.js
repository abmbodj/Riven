const HALF_HOUR_IN_MINUTES = 30;
const DEFAULT_START_HOUR = 8;
const DEFAULT_END_HOUR = 22;

export const SHORT_DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toValidDate(value) {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function toIdentity(value) {
    if (value === null || value === undefined) return null;
    return String(value);
}

export function startOfDay(value) {
    const date = toValidDate(value) || new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

export function startOfMonth(value) {
    const date = startOfDay(value);
    date.setDate(1);
    return date;
}

export function addDays(value, amount) {
    const date = startOfDay(value);
    date.setDate(date.getDate() + amount);
    return date;
}

export function addMonths(value, amount) {
    const date = startOfMonth(value);
    date.setMonth(date.getMonth() + amount);
    return date;
}

export function toDateKey(value) {
    const date = toValidDate(value);
    if (!date) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function isSameLocalDay(left, right) {
    return toDateKey(left) === toDateKey(right);
}

export function isSameLocalMonth(left, right) {
    const leftDate = toValidDate(left);
    const rightDate = toValidDate(right);

    if (!leftDate || !rightDate) return false;

    return leftDate.getFullYear() === rightDate.getFullYear()
        && leftDate.getMonth() === rightDate.getMonth();
}

export function getRollingWeekDays(anchorDate) {
    return Array.from({ length: 7 }, (_, index) => addDays(anchorDate, index));
}

// The visible month shell is always a 6-row grid that begins on Sunday.
export function getVisibleMonthRange(anchorDate) {
    const firstOfMonth = startOfMonth(anchorDate);
    const start = addDays(firstOfMonth, -firstOfMonth.getDay());
    const end = addDays(start, 41);

    return { start, end };
}

export function getMonthGridDays(anchorDate) {
    const { start } = getVisibleMonthRange(anchorDate);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function getDateRangeDays(rangeStart, rangeEnd) {
    const start = startOfDay(rangeStart);
    const end = startOfDay(rangeEnd);
    const days = [];

    for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
        days.push(cursor);
    }

    return days;
}

export function formatTimeLabel(value) {
    if (!value) return '';

    const normalized = /^\d{2}:\d{2}/.test(value) ? value.slice(0, 5) : value;
    const [hours, minutes] = normalized.split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;

    const meridiem = hours >= 12 ? 'PM' : 'AM';
    const normalizedHour = hours % 12 || 12;
    return `${normalizedHour}:${String(minutes).padStart(2, '0')} ${meridiem}`;
}

export function formatDateLabel(value, options = {}) {
    const date = toValidDate(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(undefined, options).format(date);
}

export function formatMeetupRange(startAt, endAt) {
    const start = toValidDate(startAt);
    const end = toValidDate(endAt);
    if (!start || !end) return '';

    const sameDay = isSameLocalDay(start, end);
    const startLabel = new Intl.DateTimeFormat(undefined, sameDay ? {
        hour: 'numeric',
        minute: '2-digit',
    } : {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(start);

    const endLabel = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(end);

    return `${startLabel} - ${endLabel}`;
}

export function combineDateAndTime(date, time24) {
    const base = startOfDay(date);
    const [hours, minutes] = String(time24 || '00:00').slice(0, 5).split(':').map(Number);
    base.setHours(Number.isNaN(hours) ? 0 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
    return base;
}

export function toLocalDateTimeValue(value) {
    const date = toValidDate(value);
    if (!date) return '';

    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60 * 1000);
    return local.toISOString().slice(0, 16);
}

export function fromLocalDateTimeValue(value) {
    return toValidDate(value);
}

export function formatMemberName(member) {
    return member?.display_name || member?.username || 'Member';
}

function slotToAgendaItem(slot, date) {
    const startAt = combineDateAndTime(date, slot.start_time);
    const endAt = combineDateAndTime(date, slot.end_time);
    const visibilityMode = slot.visibility_mode || 'busy_free';
    const memberName = slot.member_name || 'Member';

    return {
        id: `slot:${slot.id}:${toDateKey(date)}`,
        kind: 'schedule',
        startAt,
        endAt,
        visibilityMode,
        title: visibilityMode === 'full' && slot.class_name
            ? slot.class_name
            : `${memberName} busy`,
        subtitle: visibilityMode === 'full' && slot.class_name
            ? memberName
            : 'Class time',
        memberName,
        className: visibilityMode === 'full' ? slot.class_name : null,
        memberAvatar: slot.member_avatar || null,
    };
}

function meetupToAgendaItem(meetup) {
    return {
        id: `meetup:${meetup.id}`,
        kind: 'meetup',
        startAt: new Date(meetup.start_at),
        endAt: new Date(meetup.end_at),
        meetup,
    };
}

export function getScheduleItemsForDate(date, scheduleSlots = []) {
    return scheduleSlots
        .filter((slot) => Number(slot.day_of_week) === startOfDay(date).getDay())
        .map((slot) => slotToAgendaItem(slot, date));
}

export function getMeetupsForDate(date, meetups = []) {
    return meetups
        .filter((meetup) => isSameLocalDay(meetup.start_at, date))
        .sort((left, right) => new Date(left.start_at) - new Date(right.start_at));
}

export function summarizeDay(date, scheduleSlots = [], meetups = []) {
    const scheduleItems = getScheduleItemsForDate(date, scheduleSlots);
    const dayMeetups = getMeetupsForDate(date, meetups);
    const agendaItems = [
        ...scheduleItems,
        ...dayMeetups.map((meetup) => meetupToAgendaItem(meetup)),
    ].sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

    return {
        scheduleItems,
        meetups: dayMeetups,
        agendaItems,
        scheduleCount: scheduleItems.length,
        meetupCount: dayMeetups.length,
        activeMeetupCount: dayMeetups.filter((meetup) => meetup.status !== 'cancelled').length,
        cancelledMeetupCount: dayMeetups.filter((meetup) => meetup.status === 'cancelled').length,
    };
}

export function buildAgendaForDate(date, scheduleSlots = [], meetups = []) {
    return summarizeDay(date, scheduleSlots, meetups).agendaItems;
}

function getOccupiedIntervalsForMember(memberId, date, scheduleSlots, meetups) {
    const identity = toIdentity(memberId);

    const slotIntervals = scheduleSlots
        .filter((slot) => toIdentity(slot.user_id) === identity && Number(slot.day_of_week) === date.getDay())
        .map((slot) => ({
            start: combineDateAndTime(date, slot.start_time).getTime(),
            end: combineDateAndTime(date, slot.end_time).getTime(),
        }));

    const meetupIntervals = meetups
        .filter((meetup) => {
            const attendeeIds = Array.isArray(meetup.attendee_ids) ? meetup.attendee_ids : [];
            return attendeeIds.some((attendeeId) => toIdentity(attendeeId) === identity)
                && meetup.status !== 'cancelled'
                && isSameLocalDay(meetup.start_at, date);
        })
        .map((meetup) => ({
            start: new Date(meetup.start_at).getTime(),
            end: new Date(meetup.end_at).getTime(),
        }));

    return [...slotIntervals, ...meetupIntervals];
}

function overlapsRange(start, end, intervals) {
    return intervals.some((interval) => start < interval.end && end > interval.start);
}

function overlapsAnyMeetup(start, end, meetups, date) {
    return meetups.some((meetup) => (
        meetup.status !== 'cancelled'
        && isSameLocalDay(meetup.start_at, date)
        && start < new Date(meetup.end_at).getTime()
        && end > new Date(meetup.start_at).getTime()
    ));
}

export function calculateBestTimes({
    anchorDate,
    rangeStart,
    rangeEnd,
    members = [],
    scheduleSlots = [],
    meetups = [],
    durationMinutes = 60,
    limit = 3,
}) {
    const visibleMembers = members.filter((member) => member.share_mode && member.share_mode !== 'hidden');
    if (visibleMembers.length < 2) return [];

    const days = rangeStart && rangeEnd
        ? getDateRangeDays(rangeStart, rangeEnd)
        : getRollingWeekDays(anchorDate || new Date());

    const candidates = [];

    days.forEach((date, dayIndex) => {
        for (
            let minutes = DEFAULT_START_HOUR * 60;
            minutes <= (DEFAULT_END_HOUR * 60) - durationMinutes;
            minutes += HALF_HOUR_IN_MINUTES
        ) {
            const startsAt = new Date(startOfDay(date));
            startsAt.setMinutes(minutes);
            const endsAt = new Date(startsAt.getTime() + durationMinutes * 60 * 1000);

            if (overlapsAnyMeetup(startsAt.getTime(), endsAt.getTime(), meetups, date)) {
                continue;
            }

            const freeMembers = visibleMembers.filter((member) => {
                const occupiedIntervals = getOccupiedIntervalsForMember(member.id, date, scheduleSlots, meetups);
                return !overlapsRange(startsAt.getTime(), endsAt.getTime(), occupiedIntervals);
            });

            if (freeMembers.length < 2) continue;

            const proximityScore = Math.abs((minutes / 60) - 18);
            candidates.push({
                key: `${toDateKey(startsAt)}-${minutes}`,
                startsAt,
                endsAt,
                freeCount: freeMembers.length,
                memberIds: freeMembers.map((member) => member.id),
                score: (freeMembers.length * 100) - (dayIndex * 2) - proximityScore,
            });
        }
    });

    const chosen = [];
    const sorted = candidates.sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.startsAt.getTime() - right.startsAt.getTime();
    });

    for (const candidate of sorted) {
        const tooCloseToExisting = chosen.some((selected) => (
            Math.abs(selected.startsAt.getTime() - candidate.startsAt.getTime()) < (90 * 60 * 1000)
        ));

        if (tooCloseToExisting) continue;
        chosen.push(candidate);
        if (chosen.length >= limit) break;
    }

    return chosen;
}
