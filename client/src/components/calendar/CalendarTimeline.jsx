import React, { useMemo } from 'react';

const START_HOUR = 6;
const END_HOUR = 22;
const HOUR_HEIGHT = 64;

function startOfWeek(date) {
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    next.setDate(next.getDate() - next.getDay());
    return next;
}

function isSameDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function getMinutesSinceStart(timeValue) {
    const [hours = '0', minutes = '0'] = String(timeValue || '0:00').split(':');
    return (Number(hours) * 60) + Number(minutes);
}

function formatHour(hour) {
    return new Date(2000, 0, 1, hour, 0).toLocaleTimeString([], {
        hour: 'numeric',
    });
}

function formatDateHeader(date, compact) {
    return date.toLocaleDateString('en-US', compact ? {
        weekday: 'short',
        day: 'numeric',
    } : {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
    });
}

function formatTimeRange(startTime, endTime) {
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    return `${start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
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
    const showAssignments = contentMode === 'assignments' || contentMode === 'both';
    const showClasses = contentMode === 'classes' || contentMode === 'both';
    const compactHeaders = view === 'week';
    const visibleDates = useMemo(() => {
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
    }, [anchorDate, view]);

    const classMap = useMemo(() => {
        const next = {};
        for (const cls of classes) next[cls.id] = cls;
        return next;
    }, [classes]);

    const scheduleEvents = useMemo(() => {
        if (!showClasses) return [];

        return visibleDates.flatMap((date) => (
            scheduleSlots
                .filter((slot) => slot.day_of_week === date.getDay())
                .filter((slot) => activeFilters.length === 0 || activeFilters.includes(slot.class_id))
                .map((slot) => ({
                    kind: 'class',
                    id: `class-${slot.id}-${date.toISOString()}`,
                    date,
                    title: classMap[slot.class_id]?.name || 'Class',
                    subtitle: formatTimeRange(slot.start_time, slot.end_time),
                    color: classMap[slot.class_id]?.color || 'var(--accent-color)',
                    classId: slot.class_id,
                    startMinutes: getMinutesSinceStart(slot.start_time),
                    endMinutes: getMinutesSinceStart(slot.end_time),
                }))
        ));
    }, [scheduleSlots, visibleDates, activeFilters, classMap, showClasses]);

    const assignmentEvents = useMemo(() => {
        if (!showAssignments) return [];

        return assignments
            .filter((assignment) => assignment.due_date)
            .map((assignment) => ({
                assignment,
                dueDate: new Date(assignment.due_date),
            }))
            .filter(({ dueDate }) => !Number.isNaN(dueDate.getTime()))
            .filter(({ assignment }) => activeFilters.length === 0 || activeFilters.includes(assignment.class_id))
            .filter(({ dueDate }) => visibleDates.some((date) => isSameDay(date, dueDate)))
            .map(({ assignment, dueDate }) => ({
                kind: 'assignment',
                id: `assignment-${assignment.id}`,
                date: dueDate,
                title: assignment.title,
                subtitle: assignment.assignment_type && assignment.assignment_type !== 'assignment'
                    ? assignment.assignment_type
                    : 'Assignment',
                color: classMap[assignment.class_id]?.color || 'var(--accent-color)',
                classId: assignment.class_id,
                allDay: dueDate.getHours() === 0 && dueDate.getMinutes() === 0,
                startMinutes: (dueDate.getHours() * 60) + dueDate.getMinutes(),
                endMinutes: (dueDate.getHours() * 60) + dueDate.getMinutes() + 45,
            }));
    }, [assignments, visibleDates, activeFilters, classMap, showAssignments]);

    const allDayAssignmentsByDate = useMemo(() => {
        const map = {};
        for (const event of assignmentEvents.filter((event) => event.allDay)) {
            const key = event.date.toDateString();
            if (!map[key]) map[key] = [];
            map[key].push(event);
        }
        return map;
    }, [assignmentEvents]);

    const timedEventsByDate = useMemo(() => {
        const map = {};
        for (const event of [...scheduleEvents, ...assignmentEvents.filter((event) => !event.allDay)]) {
            const key = event.date.toDateString();
            if (!map[key]) map[key] = [];
            map[key].push(event);
        }

        Object.values(map).forEach((events) => {
            events.sort((a, b) => a.startMinutes - b.startMinutes);
        });

        return map;
    }, [scheduleEvents, assignmentEvents]);

    const gridHeight = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

    return (
        <div className="space-y-4 mt-2">
            <div className="grid gap-3" style={{ gridTemplateColumns: `72px repeat(${visibleDates.length}, minmax(0, 1fr))` }}>
                <div />
                {visibleDates.map((date) => (
                    <button
                        key={date.toISOString()}
                        onClick={() => onDaySelect(date)}
                        className="rounded-2xl glass-panel px-3 py-2 text-left hover:border-claude-accent/30 transition-colors tap-action cursor-pointer"
                        aria-label={`Open ${formatDateHeader(date, false)}`}
                    >
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-claude-secondary">
                            {formatDateHeader(date, compactHeaders)}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                            {(allDayAssignmentsByDate[date.toDateString()] || []).slice(0, 2).map((event) => (
                                <span
                                    key={event.id}
                                    className="px-2 py-1 rounded-full font-mono text-[9px] font-bold uppercase tracking-wide truncate max-w-full"
                                    style={{ backgroundColor: `${event.color}18`, color: event.color }}
                                >
                                    {event.title}
                                </span>
                            ))}
                            {(allDayAssignmentsByDate[date.toDateString()] || []).length > 2 && (
                                <span className="px-2 py-1 rounded-full font-mono text-[9px] uppercase tracking-wide bg-claude-border/20 text-claude-secondary">
                                    +{(allDayAssignmentsByDate[date.toDateString()] || []).length - 2}
                                </span>
                            )}
                        </div>
                    </button>
                ))}
            </div>

            <div className="grid gap-3 overflow-x-auto pb-2" style={{ gridTemplateColumns: `72px repeat(${visibleDates.length}, minmax(220px, 1fr))` }}>
                <div className="relative" style={{ height: gridHeight }}>
                    {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, index) => {
                        const hour = START_HOUR + index;
                        return (
                            <div
                                key={hour}
                                className="absolute inset-x-0 flex items-start justify-end pr-3 font-mono text-[10px] uppercase tracking-wide text-claude-secondary"
                                style={{ top: index * HOUR_HEIGHT - 8 }}
                            >
                                {hour < END_HOUR ? formatHour(hour) : ''}
                            </div>
                        );
                    })}
                </div>

                {visibleDates.map((date) => {
                    const events = timedEventsByDate[date.toDateString()] || [];

                    return (
                        <div
                            key={date.toISOString()}
                            className="relative rounded-[1.75rem] overflow-hidden border border-claude-border/30 bg-claude-surface/70"
                            style={{ height: gridHeight }}
                        >
                            {Array.from({ length: END_HOUR - START_HOUR }, (_, index) => (
                                <div
                                    key={index}
                                    className="absolute inset-x-0 border-t border-claude-border/20"
                                    style={{ top: index * HOUR_HEIGHT }}
                                    aria-hidden="true"
                                />
                            ))}

                            {events.map((event, index) => {
                                const top = ((event.startMinutes - (START_HOUR * 60)) / 60) * HOUR_HEIGHT;
                                const durationMinutes = Math.max(event.endMinutes - event.startMinutes, 30);
                                const height = (durationMinutes / 60) * HOUR_HEIGHT;
                                const width = visibleDates.length === 1 ? 'calc(100% - 16px)' : 'calc(100% - 20px)';

                                if (top + height < 0 || top > gridHeight) return null;

                                return (
                                    <button
                                        key={event.id}
                                        onClick={() => onDaySelect(date)}
                                        className="absolute left-2 right-2 rounded-2xl px-3 py-2 text-left shadow-sm border tap-action cursor-pointer transition-transform hover:-translate-y-0.5"
                                        style={{
                                            top: Math.max(top, 0),
                                            height: Math.min(height, gridHeight - Math.max(top, 0)),
                                            width,
                                            backgroundColor: `${event.color}16`,
                                            borderColor: `${event.color}45`,
                                        }}
                                        aria-label={`${event.kind === 'class' ? 'Class' : 'Assignment'} ${event.title} on ${formatDateHeader(date, false)}`}
                                    >
                                        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: event.color }}>
                                            {event.kind === 'class' ? 'Class' : 'Assignment'}
                                        </div>
                                        <div className="mt-1 font-serif italic font-bold text-sm text-claude-text line-clamp-2">
                                            {event.title}
                                        </div>
                                        <div className="mt-1 font-mono text-[9px] uppercase tracking-wide text-claude-secondary line-clamp-2">
                                            {event.subtitle}
                                        </div>
                                        {index < events.length - 1 && (
                                            <span className="sr-only">{event.kind} continues in timeline order</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
