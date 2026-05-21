export const START_HOUR = 6;
export const END_HOUR = 22;
export const HOUR_HEIGHT = 52;
export const DAY_HEADER_HEIGHT = 64;
export const ALL_DAY_ROW_HEIGHT = 56;

export function startOfWeek(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() - next.getDay());
    return next;
}

export function isSameDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

export function buildVisibleDates(anchorDate, view) {
    if (view === 'day') {
        const day = new Date(anchorDate);
        day.setHours(0, 0, 0, 0);
        return [day];
    }

    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + index);
        return date;
    });
}

export function getMinutesSinceStart(timeValue) {
    const [hours = '0', minutes = '0'] = String(timeValue || '0:00').split(':');
    return (Number(hours) * 60) + Number(minutes);
}

export function getMinutesFromDate(date) {
    return (date.getHours() * 60) + date.getMinutes();
}

export function isAssignmentAllDayForTimeline(date) {
    const minutes = getMinutesFromDate(date);
    return minutes === 0 || minutes >= END_HOUR * 60;
}

export function formatHour(hour) {
    return new Date(2000, 0, 1, hour, 0).toLocaleTimeString([], {
        hour: 'numeric',
    });
}

export function formatDateHeader(date, compact) {
    return date.toLocaleDateString('en-US', compact ? {
        weekday: 'short',
        day: 'numeric',
    } : {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
}

export function formatTimeRange(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

export function getDateKey(date) {
    return date.toDateString();
}

function assignLanes(clusterEvents) {
    const laneEndTimes = [];
    let maxLaneCount = 0;

    for (const event of clusterEvents) {
        let laneIndex = laneEndTimes.findIndex((endMinutes) => endMinutes <= event.startMinutes);
        if (laneIndex === -1) {
            laneIndex = laneEndTimes.length;
            laneEndTimes.push(event.endMinutes);
        } else {
            laneEndTimes[laneIndex] = event.endMinutes;
        }

        event.laneIndex = laneIndex;
        maxLaneCount = Math.max(maxLaneCount, laneEndTimes.length);
    }

    for (const event of clusterEvents) {
        event.laneCount = Math.max(maxLaneCount, 1);
    }
}

export function layoutTimedEvents(events) {
    if (events.length === 0) return [];

    const sortedEvents = [...events].sort((a, b) => {
        if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
        return a.endMinutes - b.endMinutes;
    });

    let cluster = [];
    let clusterEnd = -Infinity;

    for (const event of sortedEvents) {
        if (cluster.length === 0 || event.startMinutes < clusterEnd) {
            cluster.push(event);
            clusterEnd = Math.max(clusterEnd, event.endMinutes);
            continue;
        }

        assignLanes(cluster);
        cluster = [event];
        clusterEnd = event.endMinutes;
    }

    assignLanes(cluster);
    return sortedEvents;
}

export function getDefaultScrollTop(events, view) {
    if (view === 'month') return 0;
    if (events.length === 0) {
        return Math.max(0, ((8 * 60) - (START_HOUR * 60)) / 60 * HOUR_HEIGHT);
    }

    const earliestMinutes = Math.min(...events.map((event) => event.startMinutes));
    const preferredStart = Math.max((START_HOUR * 60), earliestMinutes - 60);
    return ((preferredStart - (START_HOUR * 60)) / 60) * HOUR_HEIGHT;
}

export function getCurrentTimeTop(now) {
    return (((now.getHours() * 60) + now.getMinutes()) - (START_HOUR * 60)) / 60 * HOUR_HEIGHT;
}
