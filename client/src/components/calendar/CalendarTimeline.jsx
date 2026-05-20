import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
    ALL_DAY_ROW_HEIGHT,
    DAY_HEADER_HEIGHT,
    END_HOUR,
    HOUR_HEIGHT,
    START_HOUR,
    buildVisibleDates,
    formatDateHeader,
    formatHour,
    getCurrentTimeTop,
    getDateKey,
    getDefaultScrollTop,
    getMinutesSinceStart,
    isSameDay,
    layoutTimedEvents,
} from './calendarTimeline.utils';

function isAllDayAssignment(dueDate) {
    return dueDate.getHours() === 0 && dueDate.getMinutes() === 0;
}

function formatChipDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
    });
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

function buildTodayMap(visibleDates) {
    const today = new Date();
    return Object.fromEntries(
        visibleDates.map((date) => [getDateKey(date), isSameDay(today, date)])
    );
}

export default function CalendarTimeline({
    anchorDate,
    view,
    assignments,
    scheduleSlots,
    classes,
    activeFilters,
    contentMode,
    onDaySelect,
}) {
    const scrollRef = useRef(null);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const interval = window.setInterval(() => {
            setNow(new Date());
        }, 60000);

        return () => window.clearInterval(interval);
    }, []);

    const showAssignments = contentMode === 'assignments' || contentMode === 'both';
    const showClasses = contentMode === 'classes' || contentMode === 'both';
    const visibleDates = useMemo(() => buildVisibleDates(anchorDate, view), [anchorDate, view]);
    const todayByKey = useMemo(() => buildTodayMap(visibleDates), [visibleDates]);
    const compactHeaders = view === 'week';
    const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
    const columnWidth = 320;

    const classMap = useMemo(() => {
        const next = {};
        for (const cls of classes) next[cls.id] = cls;
        return next;
    }, [classes]);

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
                kind: 'assignment',
                id: `assignment-all-day-${assignment.id}`,
                title: assignment.title,
                subtitle: assignment.assignment_type && assignment.assignment_type !== 'assignment'
                    ? assignment.assignment_type
                    : 'All day due',
                color: classMap[assignment.class_id]?.color || 'var(--accent-color)',
                className: classMap[assignment.class_id]?.name || 'General',
                date: dueDate,
            });
        }

        Object.values(map).forEach((events) => {
            events.sort((a, b) => a.title.localeCompare(b.title));
        });

        return map;
    }, [activeFilters, assignments, classMap, showAssignments, visibleDates]);

    const timedEventsByDate = useMemo(() => {
        const map = {};

        if (showClasses) {
            for (const date of visibleDates) {
                for (const slot of scheduleSlots) {
                    if (slot.day_of_week !== date.getDay()) continue;
                    if (activeFilters.length > 0 && !activeFilters.includes(slot.class_id)) continue;

                    const cls = classMap[slot.class_id];
                    const key = getDateKey(date);
                    if (!map[key]) map[key] = [];
                    map[key].push({
                        kind: 'class',
                        id: `class-${slot.id}-${date.toISOString()}`,
                        title: cls?.name || 'Class',
                        subtitle: cls?.room || formatEventTimeRange(
                            getMinutesSinceStart(slot.start_time),
                            getMinutesSinceStart(slot.end_time),
                        ),
                        color: cls?.color || 'var(--accent-color)',
                        className: cls?.name || 'Class',
                        date,
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
                map[key].push({
                    kind: 'assignment',
                    id: `assignment-${assignment.id}`,
                    title: assignment.title,
                    subtitle: assignment.assignment_type && assignment.assignment_type !== 'assignment'
                        ? assignment.assignment_type
                        : 'Due',
                    color: classMap[assignment.class_id]?.color || 'var(--accent-color)',
                    className: classMap[assignment.class_id]?.name || 'General',
                    date: dueDate,
                    startMinutes: (dueDate.getHours() * 60) + dueDate.getMinutes(),
                    endMinutes: (dueDate.getHours() * 60) + dueDate.getMinutes() + 45,
                });
            }
        }

        for (const key of Object.keys(map)) {
            map[key] = layoutTimedEvents(map[key]);
        }

        return map;
    }, [activeFilters, assignments, classMap, scheduleSlots, showAssignments, showClasses, visibleDates]);

    const timedEvents = useMemo(
        () => Object.values(timedEventsByDate).flat(),
        [timedEventsByDate],
    );

    useLayoutEffect(() => {
        const container = scrollRef.current;
        if (!container) return;
        container.scrollTop = getDefaultScrollTop(timedEvents, view);
    }, [timedEvents, view, anchorDate]);

    return (
        <div className="mt-2 rounded-[1.75rem] border border-claude-border/30 bg-claude-surface/55 shadow-[0_12px_40px_rgba(7,14,33,0.18)] overflow-hidden">
            <div
                ref={scrollRef}
                className="overflow-auto max-h-[72vh] overscroll-contain scroll-smooth"
                aria-label={`${view === 'day' ? 'Day' : 'Week'} timeline`}
            >
                <div
                    className="grid min-w-full"
                    style={{ gridTemplateColumns: `72px repeat(${visibleDates.length}, ${view === 'day' ? `minmax(${columnWidth}px, 1fr)` : 'minmax(0, 1fr)'})` }}
                >
                    <div className="sticky top-0 left-0 z-40 border-b border-r border-claude-border/20 bg-[color:color-mix(in_srgb,var(--surface-color)_92%,transparent)] backdrop-blur-xl px-3 py-3">
                        <div className="font-mono text-[9px] uppercase tracking-[0.24em] text-claude-secondary">
                            {view === 'day' ? 'Focus' : 'Week'}
                        </div>
                        <div className="mt-1 font-serif text-sm italic font-bold text-claude-text">
                            Schedule
                        </div>
                    </div>

                    {visibleDates.map((date) => {
                        const key = getDateKey(date);
                        const isToday = todayByKey[key];
                        const allDayItems = allDayAssignmentsByDate[key] || [];

                        return (
                            <button
                                key={date.toISOString()}
                                onClick={() => onDaySelect(date)}
                                className={[
                                    'sticky top-0 z-30 min-w-0 border-b border-claude-border/20 px-3 py-3 text-left transition-colors cursor-pointer',
                                    'bg-[color:color-mix(in_srgb,var(--surface-color)_92%,transparent)] backdrop-blur-xl',
                                    isToday ? 'shadow-[inset_0_-2px_0_var(--accent-color)]' : '',
                                ].join(' ')}
                                style={{ minHeight: DAY_HEADER_HEIGHT }}
                                aria-label={`Open ${formatDateHeader(date, false)}`}
                            >
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="truncate font-mono text-[9px] uppercase tracking-[0.22em] text-claude-secondary">
                                            {compactHeaders ? formatDateHeader(date, true) : formatDateHeader(date, false)}
                                        </div>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span className={[
                                                'font-serif text-lg italic font-bold leading-none',
                                                isToday ? 'text-claude-accent' : 'text-claude-text',
                                            ].join(' ')}>
                                                {date.getDate()}
                                            </span>
                                            {isToday && (
                                                <span className="rounded-full border border-claude-accent/40 bg-claude-accent/12 px-2 py-1 font-mono text-[8px] uppercase tracking-[0.22em] text-claude-accent">
                                                    Today
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-w-0 text-right">
                                        <div className="truncate font-mono text-[9px] uppercase tracking-[0.2em] text-claude-secondary">
                                            {allDayItems.length} all day
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    <div
                        className="sticky left-0 z-30 border-r border-b border-claude-border/20 bg-[color:color-mix(in_srgb,var(--surface-color)_94%,transparent)] backdrop-blur-xl px-3 py-3"
                        style={{ top: DAY_HEADER_HEIGHT, minHeight: ALL_DAY_ROW_HEIGHT }}
                    >
                        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-claude-secondary">
                            All day
                        </div>
                    </div>

                    {visibleDates.map((date) => {
                        const key = getDateKey(date);
                        const events = allDayAssignmentsByDate[key] || [];
                        const visibleItems = view === 'day' ? events : events.slice(0, 2);
                        const hiddenCount = events.length - visibleItems.length;
                        const isToday = todayByKey[key];

                        return (
                            <div
                                key={`${date.toISOString()}-all-day`}
                                className={[
                                    'sticky z-20 min-w-0 border-b border-claude-border/20 px-2 py-2 backdrop-blur-xl',
                                    isToday ? 'bg-claude-accent/[0.05]' : 'bg-[color:color-mix(in_srgb,var(--surface-color)_90%,transparent)]',
                                ].join(' ')}
                                style={{ top: DAY_HEADER_HEIGHT, minHeight: ALL_DAY_ROW_HEIGHT }}
                            >
                                <div className="flex min-w-0 flex-wrap gap-1.5 overflow-hidden">
                                    {visibleItems.map((event) => (
                                        <button
                                            key={event.id}
                                            onClick={() => onDaySelect(date)}
                                            className="max-w-full rounded-full border px-2.5 py-1 text-left transition-transform hover:-translate-y-0.5 tap-action cursor-pointer"
                                            style={{
                                                backgroundColor: `${event.color}16`,
                                                borderColor: `${event.color}42`,
                                                color: event.color,
                                            }}
                                        >
                                            <span className="block truncate font-mono text-[9px] uppercase tracking-[0.18em]">
                                                {event.className}
                                            </span>
                                            <span className="block truncate font-serif text-xs italic font-bold">
                                                {event.title}
                                            </span>
                                        </button>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <button
                                            onClick={() => onDaySelect(date)}
                                            className="rounded-full border border-claude-border/25 bg-claude-border/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.18em] text-claude-secondary"
                                        >
                                            +{hiddenCount} more
                                        </button>
                                    )}
                                    {events.length === 0 && (
                                        <span className="truncate font-mono text-[9px] uppercase tracking-[0.18em] text-claude-secondary/70">
                                            Nothing due
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <div
                        className="relative sticky left-0 z-20 border-r bg-[color:color-mix(in_srgb,var(--surface-color)_96%,transparent)]"
                        style={{ height: gridHeight }}
                    >
                        {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
                            const hour = START_HOUR + index;
                            return (
                                <div
                                    key={hour}
                                    className="absolute inset-x-0 flex items-start justify-end pr-3 font-mono text-[9px] uppercase tracking-[0.18em] text-claude-secondary"
                                    style={{ top: (index * HOUR_HEIGHT) - 7 }}
                                >
                                    {hour < END_HOUR ? formatHour(hour) : ''}
                                </div>
                            );
                        })}
                    </div>

                    {visibleDates.map((date) => {
                        const key = getDateKey(date);
                        const events = timedEventsByDate[key] || [];
                        const isToday = todayByKey[key];
                        const showCurrentTime = isToday && now.getHours() >= START_HOUR && now.getHours() < END_HOUR;
                        const currentTimeTop = getCurrentTimeTop(now);

                        return (
                            <div
                                key={`${date.toISOString()}-grid`}
                                className={[
                                    'relative min-w-0 border-l border-claude-border/15',
                                    isToday ? 'bg-claude-accent/[0.035]' : 'bg-transparent',
                                ].join(' ')}
                                style={{ height: gridHeight, minWidth: view === 'day' ? `${columnWidth}px` : undefined }}
                            >
                                {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                                    <div
                                        key={index}
                                        className="absolute inset-x-0 border-t border-claude-border/15"
                                        style={{ top: index * HOUR_HEIGHT }}
                                        aria-hidden="true"
                                    />
                                ))}

                                {showCurrentTime && currentTimeTop >= 0 && currentTimeTop <= gridHeight && (
                                    <div
                                        className="absolute inset-x-0 z-20"
                                        style={{ top: currentTimeTop }}
                                        aria-hidden="true"
                                    >
                                        <div className="absolute -left-1.5 top-[-5px] h-3 w-3 rounded-full bg-claude-accent shadow-[0_0_0_3px_rgba(225,111,181,0.18)]" />
                                        <div className="border-t border-claude-accent/70" />
                                    </div>
                                )}

                                {events.map((event) => {
                                    const safeTop = ((event.startMinutes - (START_HOUR * 60)) / 60) * HOUR_HEIGHT;
                                    const durationMinutes = Math.max(event.endMinutes - event.startMinutes, event.kind === 'assignment' ? 38 : 32);
                                    const safeHeight = Math.max((durationMinutes / 60) * HOUR_HEIGHT, event.kind === 'class' ? 56 : 44);
                                    const horizontalGap = 8;
                                    const laneWidth = `calc((100% - ${horizontalGap * 2}px) / ${event.laneCount})`;
                                    const leftOffset = `calc(${horizontalGap}px + (${event.laneIndex} * ((100% - ${horizontalGap * 2}px) / ${event.laneCount})))`;

                                    if (safeTop + safeHeight < 0 || safeTop > gridHeight) return null;

                                    return (
                                        <button
                                            key={event.id}
                                            onClick={() => onDaySelect(date)}
                                            className={[
                                                'absolute rounded-2xl border px-3 py-2 text-left shadow-[0_12px_30px_rgba(8,15,32,0.16)]',
                                                'transition-transform hover:-translate-y-0.5 tap-action cursor-pointer overflow-hidden',
                                                event.kind === 'class'
                                                    ? 'bg-[color:color-mix(in_srgb,var(--surface-color)_70%,transparent)]'
                                                    : 'bg-[color:color-mix(in_srgb,var(--surface-color)_84%,transparent)]',
                                            ].join(' ')}
                                            style={{
                                                top: Math.max(safeTop, 0),
                                                height: Math.min(safeHeight, gridHeight - Math.max(safeTop, 0)),
                                                width: laneWidth,
                                                left: leftOffset,
                                                backgroundColor: event.kind === 'class' ? `${event.color}22` : `${event.color}12`,
                                                borderColor: event.kind === 'class' ? `${event.color}50` : `${event.color}36`,
                                            }}
                                            aria-label={`${event.kind === 'class' ? 'Class' : 'Assignment'} ${event.title} on ${formatDateHeader(date, false)}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div
                                                        className="font-mono text-[9px] font-bold uppercase tracking-[0.18em]"
                                                        style={{ color: event.color }}
                                                    >
                                                        {event.kind === 'class' ? formatEventTimeRange(event.startMinutes, event.endMinutes) : `Due ${formatEventTime(event.startMinutes)}`}
                                                    </div>
                                                    <div className="mt-1 line-clamp-2 font-serif text-sm italic font-bold text-claude-text">
                                                        {event.title}
                                                    </div>
                                                </div>
                                                <span
                                                    className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                                                    style={{ backgroundColor: event.color }}
                                                />
                                            </div>

                                            <div className="mt-1.5 space-y-1">
                                                <div className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-claude-secondary">
                                                    {event.className}
                                                </div>
                                                <div className="truncate font-mono text-[9px] uppercase tracking-[0.16em] text-claude-secondary/80">
                                                    {event.subtitle}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="border-t border-claude-border/20 bg-claude-surface/65 px-4 py-2">
                <div className="flex flex-wrap items-center gap-3 font-mono text-[9px] uppercase tracking-[0.18em] text-claude-secondary">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-claude-accent" />
                        Current time
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-claude-border/80" />
                        Scroll for earlier and later hours
                    </span>
                    <span>
                        {view === 'day' ? formatChipDate(visibleDates[0]) : `${formatChipDate(visibleDates[0])} - ${formatChipDate(visibleDates[visibleDates.length - 1])}`}
                    </span>
                </div>
            </div>
        </div>
    );
}
