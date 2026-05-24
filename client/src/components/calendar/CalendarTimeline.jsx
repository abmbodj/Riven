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

function getAssignmentEndDate(assignment, dueDate) {
    const rawEnd = assignment.end_date || assignment.end_at;
    if (!rawEnd) return new Date(dueDate.getTime() + 45 * 60 * 1000);

    const endDate = new Date(rawEnd);
    if (Number.isNaN(endDate.getTime()) || endDate <= dueDate) {
        return new Date(dueDate.getTime() + 45 * 60 * 1000);
    }

    return endDate;
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
    density = 'comfortable',
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
    const compactDensity = density === 'compact';
    const denseDensity = density === 'dense';
    const tightDensity = compactDensity || denseDensity;
    const hourHeight = denseDensity ? 42 : compactDensity ? 46 : HOUR_HEIGHT;
    const dayHeaderHeight = denseDensity ? 52 : compactDensity ? 56 : DAY_HEADER_HEIGHT;
    const allDayRowHeight = denseDensity ? 44 : compactDensity ? 48 : ALL_DAY_ROW_HEIGHT;
    const gridHeight = (END_HOUR - START_HOUR) * hourHeight;
    const columnWidth = 320;
    const railWidth = view === 'week' ? 92 : 72;

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
                kind: assignment.calendar_kind || 'assignment',
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
                    kind: assignment.calendar_kind || 'assignment',
                    id: `assignment-${assignment.id}`,
                    title: assignment.title,
                    subtitle: assignment.assignment_type && assignment.assignment_type !== 'assignment'
                        ? assignment.assignment_type
                        : 'Due',
                    color: classMap[assignment.class_id]?.color || 'var(--accent-color)',
                    className: classMap[assignment.class_id]?.name || 'General',
                    date: dueDate,
                    startMinutes: (dueDate.getHours() * 60) + dueDate.getMinutes(),
                    endMinutes: (getAssignmentEndDate(assignment, dueDate).getHours() * 60) + getAssignmentEndDate(assignment, dueDate).getMinutes(),
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
        container.scrollTop = getDefaultScrollTop(timedEvents, view, { hourHeight, startHour: START_HOUR });
    }, [hourHeight, timedEvents, view, anchorDate]);

    return (
        <div
            data-testid="calendar-timeline"
            data-density={denseDensity ? 'dense' : compactDensity ? 'compact' : 'comfortable'}
            className={`overflow-hidden border border-claude-border/30 bg-claude-surface/55 shadow-[0_12px_40px_rgba(7,14,33,0.18)] ${tightDensity ? 'mt-1 rounded-[1.5rem]' : 'mt-2 rounded-[1.75rem]'}`}
        >
            <div
                ref={scrollRef}
                className={`overflow-auto overscroll-contain scroll-smooth ${tightDensity ? (denseDensity ? 'max-h-[64vh]' : 'max-h-[68vh]') : 'max-h-[72vh]'}`}
                aria-label={`${view === 'day' ? 'Day' : 'Week'} timeline`}
            >
                <div
                    className="grid min-w-full"
                    style={{ gridTemplateColumns: `${railWidth}px repeat(${visibleDates.length}, ${view === 'day' ? `minmax(${columnWidth}px, 1fr)` : 'minmax(0, 1fr)'})` }}
                >
                    <div className={`sticky top-0 left-0 z-40 border-b border-r border-claude-border/20 bg-[color:color-mix(in_srgb,var(--surface-color)_92%,transparent)] backdrop-blur-xl ${compactHeaders || tightDensity ? 'px-2.5 py-2' : 'px-3 py-3'}`}>
                        <div className={`font-mono uppercase text-claude-secondary ${tightDensity ? (denseDensity ? 'text-[7px] tracking-[0.16em]' : 'text-[8px] tracking-[0.2em]') : 'text-[9px] tracking-[0.24em]'}`}>
                            {view === 'day' ? 'Focus' : 'Week'}
                        </div>
                        <div className={`mt-0.5 font-serif italic font-bold text-claude-text ${compactHeaders || tightDensity ? (denseDensity ? 'text-[0.85rem] leading-tight' : 'text-[0.9rem] leading-tight') : 'text-sm'}`}>
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
                                    `sticky top-0 z-30 min-w-0 border-b border-claude-border/20 text-left transition-colors cursor-pointer ${(compactHeaders || tightDensity) ? (denseDensity ? 'px-2 py-1.5' : 'px-2 py-2') : 'px-3 py-3'}`,
                                    'bg-[color:color-mix(in_srgb,var(--surface-color)_92%,transparent)] backdrop-blur-xl',
                                    isToday ? 'shadow-[inset_0_-2px_0_var(--accent-color)]' : '',
                                ].join(' ')}
                                style={{ minHeight: dayHeaderHeight }}
                                aria-label={`Open ${formatDateHeader(date, false)}`}
                            >
                                <div className="flex min-w-0 items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className={`truncate font-mono uppercase text-claude-secondary ${(compactHeaders || tightDensity) ? (denseDensity ? 'text-[7px] tracking-[0.14em]' : 'text-[7px] tracking-[0.16em]') : 'text-[9px] tracking-[0.22em]'}`}>
                                            {compactHeaders ? formatDateHeader(date, true) : formatDateHeader(date, false)}
                                        </div>
                                        <div className={`mt-0.5 flex items-center ${(compactHeaders || tightDensity) ? (denseDensity ? 'gap-0.5' : 'gap-1') : 'gap-2'}`}>
                                            <span className={[
                                                (compactHeaders || tightDensity) ? (denseDensity ? 'font-serif text-[0.9rem] italic font-bold leading-none' : 'font-serif text-[0.95rem] italic font-bold leading-none') : 'font-serif text-lg italic font-bold leading-none',
                                                isToday ? 'text-claude-accent' : 'text-claude-text',
                                            ].join(' ')}>
                                                {date.getDate()}
                                            </span>
                                            {isToday && (
                                                <span className={`rounded-full border border-claude-accent/40 bg-claude-accent/12 font-mono uppercase text-claude-accent ${(compactHeaders || tightDensity) ? (denseDensity ? 'px-1 py-[1px] text-[6px] tracking-[0.14em]' : 'px-1.5 py-[2px] text-[7px] tracking-[0.16em]') : 'px-2 py-1 text-[8px] tracking-[0.22em]'}`}>
                                                    Today
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="min-w-0 text-right">
                                        <div className={`truncate font-mono uppercase text-claude-secondary ${(compactHeaders || tightDensity) ? (denseDensity ? 'text-[6px] tracking-[0.12em]' : 'text-[7px] tracking-[0.14em]') : 'text-[9px] tracking-[0.2em]'}`}>
                                            {allDayItems.length} all day
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    <div
                        className={`sticky left-0 z-30 border-r border-b border-claude-border/20 bg-[color:color-mix(in_srgb,var(--surface-color)_94%,transparent)] backdrop-blur-xl ${tightDensity ? (denseDensity ? 'px-2 py-2' : 'px-2.5 py-2.5') : 'px-3 py-3'}`}
                        style={{ top: dayHeaderHeight, minHeight: allDayRowHeight }}
                    >
                        <div className={`font-mono uppercase text-claude-secondary ${tightDensity ? (denseDensity ? 'text-[6px] tracking-[0.14em]' : 'text-[7px] tracking-[0.16em]') : 'text-[9px] tracking-[0.22em]'}`}>
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
                                    `sticky z-20 min-w-0 border-b border-claude-border/20 backdrop-blur-xl ${tightDensity ? (denseDensity ? 'px-1.5 py-[6px]' : 'px-1.5 py-1.5') : 'px-2 py-2'}`,
                                    isToday ? 'bg-claude-accent/[0.05]' : 'bg-[color:color-mix(in_srgb,var(--surface-color)_90%,transparent)]',
                                ].join(' ')}
                                style={{ top: dayHeaderHeight, minHeight: allDayRowHeight }}
                            >
                                <div className={`flex min-w-0 flex-wrap overflow-hidden ${tightDensity ? (denseDensity ? 'gap-0.5' : 'gap-1') : 'gap-1.5'}`}>
                                    {visibleItems.map((event) => (
                                        <button
                                            key={event.id}
                                            onClick={() => onDaySelect(date)}
                                            className={`max-w-full rounded-full border text-left transition-transform hover:-translate-y-0.5 tap-action cursor-pointer ${tightDensity ? (denseDensity ? 'px-2 py-[3px]' : 'px-2 py-0.5') : 'px-2.5 py-1'}`}
                                            style={{
                                                backgroundColor: `${event.color}16`,
                                                borderColor: `${event.color}42`,
                                                color: event.color,
                                            }}
                                        >
                                            <span className={`block truncate font-mono uppercase ${tightDensity ? (denseDensity ? 'text-[6px] tracking-[0.12em]' : 'text-[7px] tracking-[0.14em]') : 'text-[9px] tracking-[0.18em]'}`}>
                                                {event.className}
                                            </span>
                                            <span className={`block truncate font-serif italic font-bold ${tightDensity ? (denseDensity ? 'text-[10px]' : 'text-[11px]') : 'text-xs'}`}>
                                                {event.title}
                                            </span>
                                        </button>
                                    ))}
                                    {hiddenCount > 0 && (
                                        <button
                                            onClick={() => onDaySelect(date)}
                                            className={`rounded-full border border-claude-border/25 bg-claude-border/10 font-mono uppercase tracking-[0.18em] text-claude-secondary ${tightDensity ? (denseDensity ? 'px-2 py-[3px] text-[6px]' : 'px-2 py-0.5 text-[7px]') : 'px-2.5 py-1 text-[9px]'}`}
                                        >
                                            +{hiddenCount} more
                                        </button>
                                    )}
                                    {events.length === 0 && (
                                        <span className={`truncate font-mono uppercase tracking-[0.18em] text-claude-secondary/70 ${tightDensity ? (denseDensity ? 'text-[6px]' : 'text-[7px]') : 'text-[9px]'}`}>
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
                                    className={`absolute inset-x-0 flex items-start justify-end font-mono uppercase tracking-[0.18em] text-claude-secondary ${tightDensity ? (denseDensity ? 'pr-2 text-[7px]' : 'pr-2 text-[8px]') : 'pr-3 text-[9px]'}`}
                                    style={{ top: (index * hourHeight) - 7 }}
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
                        const currentTimeTop = getCurrentTimeTop(now, { hourHeight, startHour: START_HOUR });

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
                                        style={{ top: index * hourHeight }}
                                        aria-hidden="true"
                                    />
                                ))}

                                {showCurrentTime && currentTimeTop >= 0 && currentTimeTop <= gridHeight && (
                                    <div
                                        className="absolute inset-x-0 z-20"
                                        style={{ top: currentTimeTop }}
                                        aria-hidden="true"
                                    >
                                        <div className={`absolute -left-1.5 top-[-5px] rounded-full bg-claude-accent shadow-[0_0_0_3px_rgba(225,111,181,0.18)] ${tightDensity ? (denseDensity ? 'h-2 w-2' : 'h-2.5 w-2.5') : 'h-3 w-3'}`} />
                                        <div className="border-t border-claude-accent/70" />
                                    </div>
                                )}

                                {events.map((event) => {
                                    const durationMinutes = Math.max(event.endMinutes - event.startMinutes, event.kind === 'assignment' ? 38 : 32);
                                    const safeTopScaled = ((event.startMinutes - (START_HOUR * 60)) / 60) * hourHeight;
                                    const safeHeight = Math.max((durationMinutes / 60) * hourHeight, event.kind === 'class' ? (compactDensity ? 46 : 56) : (compactDensity ? 38 : 44));
                                    const horizontalGap = 8;
                                    const laneWidth = `calc((100% - ${horizontalGap * 2}px) / ${event.laneCount})`;
                                    const leftOffset = `calc(${horizontalGap}px + (${event.laneIndex} * ((100% - ${horizontalGap * 2}px) / ${event.laneCount})))`;

                                    if (safeTopScaled + safeHeight < 0 || safeTopScaled > gridHeight) return null;

                                    return (
                                        <button
                                            key={event.id}
                                            onClick={() => onDaySelect(date)}
                                            className={[
                                                `absolute rounded-2xl border text-left shadow-[0_12px_30px_rgba(8,15,32,0.16)] ${tightDensity ? (denseDensity ? 'px-2 py-1' : 'px-2 py-1.5') : 'px-3 py-2'}`,
                                                'transition-transform hover:-translate-y-0.5 tap-action cursor-pointer overflow-hidden',
                                                event.kind === 'class'
                                                    ? 'bg-[color:color-mix(in_srgb,var(--surface-color)_70%,transparent)]'
                                                    : 'bg-[color:color-mix(in_srgb,var(--surface-color)_84%,transparent)]',
                                            ].join(' ')}
                                            style={{
                                                top: Math.max(safeTopScaled, 0),
                                                height: Math.min(safeHeight, gridHeight - Math.max(safeTopScaled, 0)),
                                                width: laneWidth,
                                                left: leftOffset,
                                                backgroundColor: event.kind === 'class' ? `${event.color}22` : `${event.color}12`,
                                                borderColor: event.kind === 'class' ? `${event.color}50` : `${event.color}36`,
                                            }}
                                            aria-label={`${event.kind === 'class' ? 'Class' : event.kind === 'meetup' ? 'Study session' : 'Assignment'} ${event.title} on ${formatDateHeader(date, false)}`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0">
                                                    <div
                                                        className={`font-mono font-bold uppercase ${tightDensity ? (denseDensity ? 'text-[7px] tracking-[0.12em]' : 'text-[8px] tracking-[0.14em]') : 'text-[9px] tracking-[0.18em]'}`}
                                                        style={{ color: event.color }}
                                                    >
                                                        {event.kind === 'class' ? formatEventTimeRange(event.startMinutes, event.endMinutes) : event.kind === 'meetup' ? formatEventTimeRange(event.startMinutes, event.endMinutes) : `Due ${formatEventTime(event.startMinutes)}`}
                                                    </div>
                                                    <div className={`mt-0.5 line-clamp-2 font-serif italic font-bold text-claude-text ${tightDensity ? (denseDensity ? 'text-[12px]' : 'text-[13px]') : 'text-sm'}`}>
                                                        {event.title}
                                                    </div>
                                                </div>
                                                <span
                                                    className={`mt-0.5 shrink-0 rounded-full ${tightDensity ? (denseDensity ? 'h-1.5 w-1.5' : 'h-2 w-2') : 'h-2.5 w-2.5'}`}
                                                    style={{ backgroundColor: event.color }}
                                                />
                                            </div>

                                            <div className={`mt-1 space-y-0.5 ${tightDensity ? 'text-[8px]' : ''}`}>
                                                <div className={`truncate font-mono uppercase tracking-[0.16em] text-claude-secondary ${tightDensity ? (denseDensity ? 'text-[7px]' : 'text-[8px]') : 'text-[9px]'}`}>
                                                    {event.className}
                                                </div>
                                                <div className={`truncate font-mono uppercase tracking-[0.16em] text-claude-secondary/80 ${tightDensity ? (denseDensity ? 'text-[7px]' : 'text-[8px]') : 'text-[9px]'}`}>
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

            <div className={`border-t border-claude-border/20 bg-claude-surface/65 ${tightDensity ? (denseDensity ? 'px-3 py-1' : 'px-3 py-1.5') : 'px-4 py-2'}`}>
                <div className={`flex flex-wrap items-center gap-3 font-mono uppercase tracking-[0.18em] text-claude-secondary ${tightDensity ? (denseDensity ? 'text-[7px]' : 'text-[8px]') : 'text-[9px]'}`}>
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
