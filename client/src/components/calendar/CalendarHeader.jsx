import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

function formatRangeLabel(anchorDate, view) {
    const date = new Date(anchorDate);
    if (view === 'day') {
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
        });
    }

    if (view === 'week') {
        const start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const sameMonth = start.getMonth() === end.getMonth();
        const sameYear = start.getFullYear() === end.getFullYear();

        if (sameMonth && sameYear) {
            return `${start.toLocaleDateString('en-US', { month: 'long' })} ${start.getDate()}-${end.getDate()}, ${start.getFullYear()}`;
        }

        return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }

    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function isCurrentRange(anchorDate, view) {
    const today = new Date();

    if (view === 'day') {
        return today.toDateString() === anchorDate.toDateString();
    }

    if (view === 'week') {
        const currentWeekStart = new Date(today);
        currentWeekStart.setHours(0, 0, 0, 0);
        currentWeekStart.setDate(today.getDate() - today.getDay());

        const anchorWeekStart = new Date(anchorDate);
        anchorWeekStart.setHours(0, 0, 0, 0);
        anchorWeekStart.setDate(anchorDate.getDate() - anchorDate.getDay());

        return currentWeekStart.getTime() === anchorWeekStart.getTime();
    }

    return (
        today.getMonth() === anchorDate.getMonth() &&
        today.getFullYear() === anchorDate.getFullYear()
    );
}

export default function CalendarHeader({
    anchorDate,
    view,
    onViewChange,
    onPrev,
    onNext,
    onToday,
    contentMode,
    onContentModeChange,
    classes,
    activeFilters,
    onFilterToggle,
}) {
    const rangeLabel = formatRangeLabel(anchorDate, view);
    const inCurrentRange = isCurrentRange(anchorDate, view);

    return (
        <div className="space-y-3 mb-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrev}
                        aria-label={`Previous ${view}`}
                        className="w-9 h-9 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="px-3 min-w-[210px] sm:min-w-[280px]">
                        <motion.span
                            key={`${view}-${rangeLabel}`}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className="block font-serif italic font-bold text-lg text-claude-text text-center lg:text-left"
                        >
                            {rangeLabel}
                        </motion.span>
                    </div>

                    <button
                        onClick={onNext}
                        aria-label={`Next ${view}`}
                        className="w-9 h-9 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-2 self-end lg:self-auto">
                    {!inCurrentRange && (
                        <button
                            onClick={onToday}
                            className="px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-widest glass-panel rounded-lg text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer"
                        >
                            Today
                        </button>
                    )}

                    <SegmentedControl
                        value={view}
                        onChange={onViewChange}
                        options={[
                            { value: 'month', label: 'Month' },
                            { value: 'week', label: 'Week' },
                            { value: 'day', label: 'Day' },
                        ]}
                        layoutId="calendar-view-pill"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-3">
                <SegmentedControl
                    value={contentMode}
                    onChange={onContentModeChange}
                    options={[
                        { value: 'assignments', label: 'Assignments' },
                        { value: 'classes', label: 'Classes' },
                        { value: 'both', label: 'Both' },
                    ]}
                    layoutId="calendar-content-pill"
                    compact={false}
                />

                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
                    <FilterPill
                        label="All"
                        active={activeFilters.length === 0}
                        onClick={() => onFilterToggle('all')}
                    />

                    {classes.map((cls) => (
                        <FilterPill
                            key={cls.id}
                            label={cls.name}
                            color={cls.color}
                            active={activeFilters.includes(cls.id)}
                            onClick={() => onFilterToggle(cls.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function SegmentedControl({ value, onChange, options, layoutId, compact = true }) {
    return (
        <div
            className={[
                'relative flex glass-panel rounded-xl p-1',
                compact ? '' : 'w-full sm:w-auto',
            ].join(' ')}
            role="tablist"
        >
            {options.map((option) => (
                <button
                    key={option.value}
                    onClick={() => onChange(option.value)}
                    role="tab"
                    aria-selected={value === option.value}
                    className={[
                        'relative px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg z-10 transition-colors tap-action cursor-pointer',
                        compact ? '' : 'flex-1 sm:flex-none',
                    ].join(' ')}
                    style={{ color: value === option.value ? 'var(--text-color)' : 'var(--secondary-text-color)' }}
                >
                    {value === option.value && (
                        <motion.span
                            layoutId={layoutId}
                            className="absolute inset-0 bg-claude-accent rounded-lg"
                            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                        />
                    )}
                    <span className="relative z-10">{option.label}</span>
                </button>
            ))}
        </div>
    );
}

function FilterPill({ label, color, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full border font-mono text-[10px] uppercase font-bold tracking-widest transition-all duration-200 tap-action cursor-pointer"
            style={
                active && color
                    ? {
                        backgroundColor: `${color}20`,
                        color,
                        borderColor: `${color}50`,
                    }
                    : active
                    ? {
                        backgroundColor: 'var(--accent-color)20',
                        color: 'var(--accent-color)',
                        borderColor: 'var(--accent-color)50',
                    }
                    : {
                        backgroundColor: 'transparent',
                        color: 'var(--secondary-text-color)',
                        borderColor: 'var(--border-color)',
                        opacity: 0.7,
                    }
            }
        >
            {color && (
                <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: active ? color : 'var(--secondary-text-color)', opacity: active ? 1 : 0.5 }}
                />
            )}
            {label}
        </button>
    );
}
