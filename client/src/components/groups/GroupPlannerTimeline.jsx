import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ALL_DAY_ROW_HEIGHT,
    HOUR_HEIGHT,
    buildVisibleDates,
    formatDateHeader,
    formatHour,
    getCurrentTimeTop,
    getDateKey,
    getDefaultScrollTop,
    getMinutesSinceStart,
    isSameDay,
    layoutTimedEvents,
    resolveTimelineWindow,
} from '../calendar/calendarTimeline.utils';

const DEFAULT_COPY = {
    railTitle: 'Shared windows',
    railWeekEyebrow: 'Overlap',
    railDayEyebrow: 'Today',
    allDayLaneLabel: 'Sessions',
    emptyAllDayLabel: 'No sessions yet',
    ariaClassLabel: 'Availability block',
    ariaAssignmentLabel: 'Study session',
    ariaMeetupLabel: 'Study session',
    defaultSourceName: 'Study group',
};

function isAllDayAssignment(dueDate) {
    return dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
}

function getAssignmentEndDate(assignment, dueDate) {
    const rawEnd = assignment.end_date || assignment.end_at;
    if (!rawEnd) return new Date(dueDate.getTime() + 45 * 60 * 1000);

    const endDate = new Date(rawEnd);
    if (Number.isNaN(endDate.getTime()) || endDate <= dueDate) {
        return new Date(dueDate.getTime() + 45 * 60 * 1000);
    }

    return endDate;
}

function formatEventTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return new Date(2000, 0, 1, hours, mins).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatEventTimeRange(startMinutes, endMinutes) {
    return `${formatEventTime(startMinutes)} - ${formatEventTime(endMinutes)}`;
}

function laneStyle(event) {
    const leftPercent = (event.laneIndex / event.laneCount) * 100;
    const widthPercent = 100 / event.laneCount;
    return {
        left: `calc(${leftPercent}% + 3px)`,
        width: `calc(${widthPercent}% - 6px)`,
    };
}

export default function GroupPlannerTimeline({
    anchorDate,
    view,
    assignments,
    scheduleSlots,
    classes,
    activeFilters,
    contentMode,
    onDaySelect,
    density = 'compact',
    fitMode = 'default',
    copy,
}) {
    const scrollRef = useRef(null);
    const [now, setNow] = useState(() => new Date());
    const timelineCopy = useMemo(() => ({ ...DEFAULT_COPY, ...copy }), [copy]);
    const visibleDates = useMemo(() => buildVisibleDates(anchorDate, view), [anchorDate, view]);
    const showAssignments = contentMode === 'assignments' || contentMode === 'both';
    const showAvailability = contentMode === 'classes' || contentMode === 'both';
    const compactHeaders = view === 'week';
    const fitWeekdayView = fitMode === 'group-weekday';
    const classMap = useMemo(() => {
        const next = {};
        for (const classItem of classes) next[classItem.id] = classItem;
        return next;
    }, [classes]);

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(new Date());
        }, 60000);

        return () => window.clearInterval(interval);
    }, []);

    const allDayAssignmentsByDate = useMemo(() => {
        const map = {};
        if (!showAssignments) return map;

        for (const assignment of assignments) {
            if (!assignment.due_date) continue;
            if (activeFilters.length > 0 && !activeFilters.includes(assignment.class_id)) continue;

            const dueDate = new Date(assignment.due_date);
            if (Number.isNaN(dueDate.getTime()) || !isAllDayAssignment(dueDate)) continue;
            if (!visibleDates.some((date) => isSameDay(date, dueDate))) continue;

            const key = getDateKey(dueDate);
            if (!map[key]) map[key] = [];

            map[key].push({
                id: `allday-${assignment.id}`,
                title: assignment.title,
                kind: assignment.calendar_kind || 'assignment',
                color: classMap[assignment.class_id]?.color || 'var(--accent-color)',
            });
        }

        return map;
    }, [activeFilters, assignments, classMap, showAssignments, visibleDates]);

    const timedEventsByDate = useMemo(() => {
        const map = {};

        if (showAvailability) {
            for (const date of visibleDates) {
                for (const slot of scheduleSlots) {
                    if (slot.day_of_week !== date.getDay()) continue;
                    if (activeFilters.length > 0 && !activeFilters.includes(slot.class_id)) continue;

                    const source = classMap[slot.class_id];
                    const key = getDateKey(date);
                    if (!map[key]) map[key] = [];

                    const visibleName = source?.name || slot.member_name || 'Member';
                    const isFull = slot.visibility_mode === 'full' && slot.class_name;

                    map[key].push({
                        kind: 'class',
                        id: `availability-${slot.id}-${date.toISOString()}`,
                        title: isFull ? slot.class_name : `${visibleName} busy`,
                        subtitle: isFull ? (slot.member_name || visibleName) : 'Availability block',
                        color: source?.color || '#7a9e72',
                        className: visibleName,
                        startMinutes: getMinutesSinceStart(slot.start_time),
                        endMinutes: getMinutesSinceStart(slot.end_time),
                    });
                }
            }
        }

        if (showAssignments) {
            for (const assignment of assignments) {
                if (!assignment.due_date) continue;
                if (activeFilters.length > 0 && !activeFilters.includes(assignment.class_id)) continue;

                const dueDate = new Date(assignment.due_date);
                if (Number.isNaN(dueDate.getTime()) || isAllDayAssignment(dueDate)) continue;
                if (!visibleDates.some((date) => isSameDay(date, dueDate))) continue;

                const key = getDateKey(dueDate);
                if (!map[key]) map[key] = [];

                const endDate = getAssignmentEndDate(assignment, dueDate);
                map[key].push({
                    kind: assignment.calendar_kind || 'assignment',
                    id: `session-${assignment.id}`,
                    title: assignment.title,
                    subtitle: assignment.assignment_type === 'cancelled' ? 'Cancelled' : 'Study session',
                    color: classMap[assignment.class_id]?.color || '#deb96a',
                    className: classMap[assignment.class_id]?.name || timelineCopy.defaultSourceName,
                    startMinutes: (dueDate.getHours() * 60) + dueDate.getMinutes(),
                    endMinutes: (endDate.getHours() * 60) + endDate.getMinutes(),
                });
            }
        }

        Object.keys(map).forEach((key) => {
            map[key] = layoutTimedEvents(map[key]);
        });

        return map;
    }, [activeFilters, assignments, classMap, scheduleSlots, showAssignments, showAvailability, timelineCopy.defaultSourceName, visibleDates]);

    const timedEvents = useMemo(() => Object.values(timedEventsByDate).flat(), [timedEventsByDate]);
    const timelineWindow = useMemo(
        () => resolveTimelineWindow(timedEvents, fitMode),
        [fitMode, timedEvents],
    );
    const visibleStartHour = timelineWindow.startHour;
    const visibleEndHour = timelineWindow.endHour;
    const hourHeight = fitWeekdayView ? 26 : density === 'dense' ? 42 : density === 'compact' ? 46 : HOUR_HEIGHT;
    const allDayRowHeight = fitWeekdayView ? 34 : density === 'dense' ? 44 : density === 'compact' ? 48 : ALL_DAY_ROW_HEIGHT;
    const hours = useMemo(
        () => Array.from({ length: visibleEndHour - visibleStartHour }, (_, index) => visibleStartHour + index),
        [visibleEndHour, visibleStartHour],
    );
    const gridHeight = (visibleEndHour - visibleStartHour) * hourHeight;

    useLayoutEffect(() => {
        const container = scrollRef.current;
        if (!container) return;

        container.scrollTop = fitWeekdayView
            ? 0
            : getDefaultScrollTop(timedEvents, view, {
                hourHeight,
                startHour: visibleStartHour,
            });
    }, [fitWeekdayView, hourHeight, timedEvents, view, visibleStartHour]);

    return (
        <section
            data-testid="calendar-timeline"
            data-density={density}
            data-fit-mode={fitMode}
            className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[linear-gradient(165deg,rgba(12,18,28,0.98),rgba(8,11,18,1))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
            <div className="border-b border-white/8 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            {view === 'day' ? timelineCopy.railDayEyebrow : timelineCopy.railWeekEyebrow}
                        </div>
                        <div className="mt-1 text-[1rem] font-semibold text-claude-text">
                            {timelineCopy.railTitle}
                        </div>
                    </div>
                    <div className="text-[10px] font-medium text-claude-secondary">
                        Tap a column to lock the day queue.
                    </div>
                </div>
            </div>

            <div ref={scrollRef} className="overflow-auto">
                <div className="min-w-[760px]">
                    <div
                        className="sticky top-0 z-20 border-b border-white/8 bg-[#0c111a]/96 backdrop-blur-xl"
                        style={{ gridTemplateColumns: `72px repeat(${visibleDates.length}, minmax(0, 1fr))` }}
                    >
                        <div className="grid" style={{ gridTemplateColumns: `72px repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                            <div className="border-r border-white/8 px-3 py-3">
                                <div className="text-[8px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                    Lane
                                </div>
                            </div>

                            {visibleDates.map((date) => {
                                const isToday = isSameDay(date, now);
                                return (
                                    <button
                                        key={date.toISOString()}
                                        type="button"
                                        onClick={() => onDaySelect(date)}
                                        className={`border-r border-white/8 px-3 py-3 text-left transition-colors last:border-r-0 ${
                                            isToday ? 'bg-claude-accent/10' : 'hover:bg-white/[0.03]'
                                        }`}
                                    >
                                        <div className="text-[8px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            {compactHeaders ? formatDateHeader(date, true) : formatDateHeader(date, false)}
                                        </div>
                                        {isToday && (
                                            <div className="mt-1 inline-flex rounded-full border border-claude-accent/24 bg-claude-accent/12 px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-[0.14em] text-claude-accent">
                                                Today
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="grid border-t border-white/8" style={{ gridTemplateColumns: `72px repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                            <div className="border-r border-white/8 px-3 py-2">
                                <div className="text-[8px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                    {timelineCopy.allDayLaneLabel}
                                </div>
                            </div>

                            {visibleDates.map((date) => {
                                const allDayItems = allDayAssignmentsByDate[getDateKey(date)] || [];

                                return (
                                    <div
                                        key={`allday-${date.toISOString()}`}
                                        className="border-r border-white/8 px-2 py-2 last:border-r-0"
                                        style={{ minHeight: `${allDayRowHeight}px` }}
                                    >
                                        {allDayItems.length > 0 ? (
                                            <div className="space-y-1">
                                                {allDayItems.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="truncate rounded-full px-2 py-1 text-[10px] font-medium text-claude-text"
                                                        style={{
                                                            backgroundColor: `${item.color}20`,
                                                            color: item.color,
                                                        }}
                                                    >
                                                        {item.title}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="rounded-[0.95rem] border border-dashed border-white/10 bg-white/[0.02] px-2 py-1.5 text-[10px] font-medium text-claude-secondary">
                                                {timelineCopy.emptyAllDayLabel}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid" style={{ gridTemplateColumns: `72px repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                        <div className="border-r border-white/8">
                            {hours.map((hour) => (
                                <div
                                    key={hour}
                                    className="border-b border-white/6 px-3 pt-1.5 text-[10px] font-medium text-claude-secondary last:border-b-0"
                                    style={{ height: `${hourHeight}px` }}
                                >
                                    {formatHour(hour)}
                                </div>
                            ))}
                        </div>

                        {visibleDates.map((date) => {
                            const dateKey = getDateKey(date);
                            const events = timedEventsByDate[dateKey] || [];
                            const showCurrentTime = isSameDay(date, now)
                                && now.getHours() >= visibleStartHour
                                && now.getHours() <= visibleEndHour;

                            return (
                                <div
                                    key={`timeline-${date.toISOString()}`}
                                    className="relative border-r border-white/8 last:border-r-0"
                                    style={{ minHeight: `${gridHeight}px` }}
                                >
                                    {hours.map((hour) => (
                                        <div
                                            key={`${date.toISOString()}-${hour}`}
                                            className="border-b border-white/6"
                                            style={{ height: `${hourHeight}px` }}
                                        />
                                    ))}

                                    {showCurrentTime && (
                                        <div
                                            aria-hidden="true"
                                            className="pointer-events-none absolute left-0 right-0 z-10 border-t border-rose-300/70"
                                            style={{ top: `${getCurrentTimeTop(now, { hourHeight, startHour: visibleStartHour })}px` }}
                                        />
                                    )}

                                    {events.map((event) => {
                                        const top = ((event.startMinutes - (visibleStartHour * 60)) / 60) * hourHeight;
                                        const height = Math.max(32, ((event.endMinutes - event.startMinutes) / 60) * hourHeight);
                                        const isSession = event.kind === 'assignment' || event.kind === 'meetup';
                                        const isCancelled = event.subtitle === 'Cancelled';
                                        const ariaLabel = `${isSession ? timelineCopy.ariaMeetupLabel : timelineCopy.ariaClassLabel} ${event.title}`;

                                        return (
                                            <button
                                                key={event.id}
                                                type="button"
                                                aria-label={ariaLabel}
                                                onClick={() => onDaySelect(date)}
                                                className={`absolute rounded-[1rem] border px-2 py-1.5 text-left shadow-[0_18px_28px_rgba(0,0,0,0.18)] transition-transform hover:-translate-y-0.5 ${
                                                    isSession
                                                        ? 'border-claude-accent/22 bg-[linear-gradient(155deg,rgba(222,185,106,0.24),rgba(42,28,10,0.78))]'
                                                        : 'border-emerald-300/18 bg-[linear-gradient(155deg,rgba(82,147,118,0.24),rgba(16,38,33,0.84))]'
                                                } ${isCancelled ? 'opacity-70 grayscale-[0.1]' : ''}`}
                                                style={{
                                                    top: `${top}px`,
                                                    height: `${height}px`,
                                                    ...laneStyle(event),
                                                }}
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <span
                                                        className="rounded-full px-2 py-0.5 text-[8px] font-mono font-bold uppercase tracking-[0.14em]"
                                                        style={{
                                                            backgroundColor: `${event.color}22`,
                                                            color: event.color,
                                                        }}
                                                    >
                                                        {isSession ? 'Session' : 'Availability'}
                                                    </span>
                                                    <span className="text-[9px] font-medium text-claude-secondary">
                                                        {formatEventTimeRange(event.startMinutes, event.endMinutes)}
                                                    </span>
                                                </div>
                                                <div className="mt-1 text-[12px] font-semibold leading-4 text-claude-text">
                                                    {event.title}
                                                </div>
                                                <div className="mt-1 text-[10px] font-medium text-claude-secondary">
                                                    {event.subtitle}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
}
