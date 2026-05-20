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
    const compactMode = view === 'week' || view === 'day';

    return (
        <div className={`mb-4 ${compactMode ? 'space-y-2.5' : 'space-y-3'}`}>
            <div className={`flex flex-col gap-3 ${compactMode ? 'lg:flex-row lg:items-center lg:justify-between' : 'lg:flex-row lg:items-center lg:justify-between'}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                        <NavButton onClick={onPrev} label={`Previous ${view}`}>
                            <ChevronLeft className="h-4 w-4" />
                        </NavButton>
                        <NavButton onClick={onNext} label={`Next ${view}`}>
                            <ChevronRight className="h-4 w-4" />
                        </NavButton>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-claude-secondary">
                            {compactMode ? 'Schedule view' : 'Calendar view'}
                        </div>
                        <motion.div
                            key={`${view}-${rangeLabel}`}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`font-serif italic font-bold text-claude-text truncate ${compactMode ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'}`}
                        >
                            {rangeLabel}
                        </motion.div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {!inCurrentRange && (
                        <button
                            onClick={onToday}
                            className="rounded-xl border border-claude-border/30 bg-claude-surface/65 px-3 py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-claude-secondary transition-colors hover:text-claude-accent tap-action cursor-pointer"
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

            <div className={`rounded-2xl border border-claude-border/20 bg-claude-surface/55 px-2.5 py-2 ${compactMode ? 'space-y-2' : 'space-y-3'}`}>
                <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
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

                    <div className="min-w-0 flex-1">
                        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar">
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
            </div>
        </div>
    );
}

function NavButton({ onClick, label, children }) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-claude-border/25 bg-claude-surface/70 text-claude-secondary transition-colors hover:text-claude-accent tap-action cursor-pointer"
        >
            {children}
        </button>
    );
}

function SegmentedControl({ value, onChange, options, layoutId, compact = true }) {
    return (
        <div
            className={[
                'relative flex rounded-xl border border-claude-border/20 bg-claude-surface/60 p-1',
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
                        'relative z-10 rounded-lg px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-colors tap-action cursor-pointer',
                        compact ? '' : 'flex-1 sm:flex-none',
                    ].join(' ')}
                    style={{ color: value === option.value ? 'var(--text-color)' : 'var(--secondary-text-color)' }}
                >
                    {value === option.value && (
                        <motion.span
                            layoutId={layoutId}
                            className="absolute inset-0 rounded-lg bg-claude-accent"
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
            className="flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-all duration-200 tap-action cursor-pointer"
            style={
                active && color
                    ? {
                        backgroundColor: `${color}18`,
                        color,
                        borderColor: `${color}45`,
                    }
                    : active
                    ? {
                        backgroundColor: 'var(--accent-color)18',
                        color: 'var(--accent-color)',
                        borderColor: 'var(--accent-color)45',
                    }
                    : {
                        backgroundColor: 'transparent',
                        color: 'var(--secondary-text-color)',
                        borderColor: 'var(--border-color)',
                        opacity: 0.82,
                    }
            }
        >
            {color && (
                <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: active ? color : 'var(--secondary-text-color)', opacity: active ? 1 : 0.55 }}
                />
            )}
            <span className="truncate">{label}</span>
        </button>
    );
}
