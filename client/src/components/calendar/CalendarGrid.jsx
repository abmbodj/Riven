import React, { useMemo } from 'react';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Build a 42-cell grid (6 weeks) starting from the Sunday before month start
function buildMonthGrid(viewMonth) {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();

    const firstOfMonth = new Date(year, month, 1);
    const startOffset = firstOfMonth.getDay(); // 0=Sun

    const cells = [];
    for (let i = 0; i < 42; i++) {
        const date = new Date(year, month, 1 - startOffset + i);
        cells.push(date);
    }
    return cells;
}

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();
}

export default function CalendarGrid({
    anchorDate,
    assignments,
    scheduleSlots,
    classes,
    activeFilters,
    contentMode,
    selectedDay,
    onDaySelect,
}) {
    const today = new Date();
    const viewMonth = useMemo(
        () => new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1),
        [anchorDate],
    );
    const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth]);
    const showAssignments = contentMode === 'assignments' || contentMode === 'both';
    const showClasses = contentMode === 'classes' || contentMode === 'both';

    // Index assignments by date string for O(1) lookup
    const assignmentsByDay = useMemo(() => {
        const map = {};
        if (!showAssignments) return map;

        for (const a of assignments) {
            if (!a.due_date) continue;
            const d = new Date(a.due_date);
            if (Number.isNaN(d.getTime())) continue;
            const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
            if (!map[key]) map[key] = [];
            map[key].push(a);
        }
        return map;
    }, [assignments, showAssignments]);

    // Index schedule slots by day_of_week
    const scheduleByDow = useMemo(() => {
        if (!showClasses) return {};
        const map = {};
        for (const s of scheduleSlots) {
            if (activeFilters.length > 0 && !activeFilters.includes(s.class_id)) continue;
            const dow = s.day_of_week;
            if (!map[dow]) map[dow] = [];
            map[dow].push(s);
        }
        return map;
    }, [scheduleSlots, showClasses, activeFilters]);

    const classColorMap = useMemo(() => {
        const m = {};
        for (const c of classes) m[c.id] = c.color;
        return m;
    }, [classes]);

    return (
        <div role="grid" aria-label="Monthly calendar">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 mb-1">
                {WEEKDAY_LABELS.map((d) => (
                    <div
                        key={d}
                        className="text-center font-mono text-[9px] uppercase tracking-widest font-bold text-claude-secondary py-1"
                    >
                        {d}
                    </div>
                ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-px bg-claude-border/20 rounded-2xl overflow-hidden">
                {cells.map((date, idx) => {
                    const inMonth = date.getMonth() === viewMonth.getMonth();
                    const isToday = isSameDay(date, today);
                    const isSelected = selectedDay && isSameDay(date, selectedDay);
                    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
                    const dayAssignments = assignmentsByDay[key] || [];
                    const scheduleCount = scheduleByDow[date.getDay()]?.length || 0;

                    const visibleDots = dayAssignments.slice(0, 4);
                    const overflow = dayAssignments.length - 4;

                    return (
                        <DayCell
                            key={idx}
                            date={date}
                            inMonth={inMonth}
                            isToday={isToday}
                            isSelected={isSelected}
                            assignments={dayAssignments}
                            visibleDots={visibleDots}
                            overflow={overflow}
                            scheduleCount={scheduleCount}
                            classColorMap={classColorMap}
                            onClick={() => onDaySelect(date)}
                        />
                    );
                })}
            </div>
        </div>
    );
}

function DayCell({ date, inMonth, isToday, isSelected, assignments, visibleDots, overflow, scheduleCount, classColorMap, onClick }) {
    const dateNum = date.getDate();
    const ariaLabel = [
        date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
        assignments.length > 0 ? `${assignments.length} assignment${assignments.length > 1 ? 's' : ''}` : null,
        scheduleCount > 0 ? `${scheduleCount} class session${scheduleCount > 1 ? 's' : ''}` : null,
    ].filter(Boolean).join(', ');

    return (
        <button
            role="gridcell"
            aria-label={ariaLabel}
            onClick={onClick}
            className={[
                'relative flex flex-col items-center justify-start pt-1.5 pb-1 aspect-square',
                'min-w-0 cursor-pointer tap-action transition-colors duration-150',
                'bg-claude-surface',
                isSelected ? 'bg-claude-accent/10' : '',
                isToday ? 'ring-2 ring-inset ring-claude-accent/60' : '',
                !inMonth ? 'opacity-30' : '',
                'hover:bg-claude-accent/[0.06] active:bg-claude-accent/15',
                // Desktop: taller cells with title preview
                'lg:aspect-auto lg:min-h-[90px] lg:items-start lg:px-1.5',
            ].filter(Boolean).join(' ')}
        >
            {/* Day number */}
            <span
                className={[
                    'font-mono text-[11px] font-bold leading-none',
                    isToday
                        ? 'w-5 h-5 flex items-center justify-center rounded-full bg-claude-accent text-claude-text text-[10px]'
                        : 'text-claude-text',
                    !inMonth ? 'text-claude-secondary' : '',
                ].filter(Boolean).join(' ')}
            >
                {dateNum}
            </span>

            {/* Schedule line indicators */}
            {scheduleCount > 0 && (
                <div className="flex flex-col gap-0.5 mt-0.5" aria-hidden="true">
                    {Array.from({ length: Math.min(scheduleCount, 2) }).map((_, index) => (
                        <div key={index} className="w-4 h-0.5 rounded-full bg-claude-secondary/40" />
                    ))}
                </div>
            )}

            {/* Assignment dots */}
            {visibleDots.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1 max-w-full">
                    {visibleDots.map((a, i) => (
                        <span
                            key={a.id ?? i}
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: classColorMap[a.class_id] || 'var(--accent-color)' }}
                        />
                    ))}
                    {overflow > 0 && (
                        <span className="font-mono text-[8px] text-claude-secondary leading-none">
                            +{overflow}
                        </span>
                    )}
                </div>
            )}

            {/* Desktop: first assignment title */}
            {assignments.length > 0 && (
                <div className="hidden lg:block w-full mt-1 space-y-0.5">
                    {assignments.slice(0, 2).map((a, i) => (
                        <div
                            key={a.id ?? i}
                            className="w-full text-left truncate font-mono text-[9px] font-bold px-1 py-0.5 rounded"
                            style={{
                                backgroundColor: (classColorMap[a.class_id] || 'var(--accent-color)') + '20',
                                color: classColorMap[a.class_id] || 'var(--accent-color)',
                            }}
                        >
                            {a.title}
                        </div>
                    ))}
                    {assignments.length > 2 && (
                        <div className="font-mono text-[9px] text-claude-secondary px-1">
                            +{assignments.length - 2} more
                        </div>
                    )}
                </div>
            )}
        </button>
    );
}
