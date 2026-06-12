import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

const DEFAULT_HEADER_COPY = {
    compactEyebrow: 'Schedule view',
    defaultEyebrow: 'Calendar view',
    allFilterLabel: 'All',
};

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
    contentOptions,
    classes,
    activeFilters,
    onFilterToggle,
    eyebrow,
    density = 'comfortable',
    copy,
}) {
    const calendarCopy = { ...DEFAULT_HEADER_COPY, ...copy };
    const rangeLabel = formatRangeLabel(anchorDate, view);
    const inCurrentRange = isCurrentRange(anchorDate, view);
    const compactMode = view === 'week' || view === 'day';
    const compactDensity = density === 'compact';
    const denseDensity = density === 'dense';
    const tightDensity = compactDensity || denseDensity;
    const modeOptions = contentOptions || [
        { value: 'assignments', label: 'Assignments' },
        { value: 'classes', label: 'Classes' },
        { value: 'both', label: 'Both' },
    ];

    return (
        <div className={`${tightDensity ? 'mb-2 space-y-1' : `mb-4 ${compactMode ? 'space-y-2.5' : 'space-y-3'}`}`}>
            <div className={`flex flex-col ${tightDensity ? 'gap-1.5' : 'gap-3'} ${compactMode ? 'lg:flex-row lg:items-center lg:justify-between' : 'lg:flex-row lg:items-center lg:justify-between'}`}>
                <div className="flex items-center gap-2 min-w-0">
                    <div className="flex items-center gap-1 shrink-0">
                        <NavButton onClick={onPrev} label={`Previous ${view}`} compact={compactDensity}>
                            <ChevronLeft className={tightDensity ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                        </NavButton>
                        <NavButton onClick={onNext} label={`Next ${view}`} compact={compactDensity}>
                            <ChevronRight className={tightDensity ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
                        </NavButton>
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className={`font-mono uppercase text-claude-secondary ${tightDensity ? (denseDensity ? 'text-[7px] tracking-[0.16em]' : 'text-[7px] tracking-[0.18em]') : 'text-[9px] tracking-[0.22em]'}`}>
                            {eyebrow || (compactMode ? calendarCopy.compactEyebrow : calendarCopy.defaultEyebrow)}
                        </div>
                        <motion.div
                            key={`${view}-${rangeLabel}`}
                            initial={{ opacity: 0, y: -6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15 }}
                            className={`font-serif italic font-bold text-claude-text truncate ${tightDensity ? (denseDensity ? 'text-[0.95rem] sm:text-[1rem]' : 'text-[1.05rem] sm:text-[1.15rem]') : compactMode ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'}`}
                        >
                            {rangeLabel}
                        </motion.div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    {!inCurrentRange && (
                        <button
                            onClick={onToday}
                            className={`rounded-xl border border-claude-border/30 bg-claude-surface/65 font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary transition-colors hover:text-claude-accent tap-action cursor-pointer touch-manipulation ${tightDensity ? (denseDensity ? 'px-2 py-1.5 text-[8px] min-h-[38px]' : 'px-2.5 py-2 text-[9px] min-h-[44px]') : 'px-3 py-2.5 text-[10px] min-h-[44px]'}`}
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
                        compactSize={tightDensity}
                    />
                </div>
            </div>

            <div className={`border border-claude-border/20 bg-claude-surface/55 ${tightDensity ? (denseDensity ? 'rounded-lg px-2 py-1 space-y-0.5' : 'rounded-lg px-2 py-1 space-y-1') : `rounded-2xl px-2.5 py-2 ${compactMode ? 'space-y-2' : 'space-y-3'}`}`}>
                <div className={`flex flex-col ${tightDensity ? 'gap-1' : 'gap-2'} xl:flex-row xl:items-center xl:justify-between`}>
                    <SegmentedControl
                        value={contentMode}
                        onChange={onContentModeChange}
                        options={modeOptions}
                        layoutId="calendar-content-pill"
                        compact={false}
                        compactSize={tightDensity}
                    />

                    <div className="min-w-0 flex-1">
                        <div
                            data-testid="calendar-filter-list"
                            className={`flex overflow-x-auto hide-scrollbar sm:flex-wrap sm:overflow-visible ${tightDensity ? 'gap-1' : 'gap-1.5'}`}
                        >
                            <FilterPill
                                label={calendarCopy.allFilterLabel}
                                active={activeFilters.length === 0}
                                onClick={() => onFilterToggle('all')}
                                compact={tightDensity}
                            />

                            {classes.map((cls) => (
                                <FilterPill
                                    key={cls.id}
                                    label={cls.name}
                                    color={cls.color}
                                    active={activeFilters.includes(cls.id)}
                                    onClick={() => onFilterToggle(cls.id)}
                                    compact={tightDensity}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function NavButton({ onClick, label, children, compact = false }) {
    return (
        <button
            onClick={onClick}
            aria-label={label}
            className={`flex items-center justify-center rounded-xl border border-claude-border/25 bg-claude-surface/70 text-claude-secondary transition-colors hover:text-claude-accent tap-action cursor-pointer touch-manipulation ${compact ? 'h-10 w-10' : 'h-11 w-11'}`}
        >
            {children}
        </button>
    );
}

function SegmentedControl({ value, onChange, options, layoutId, compact = true, compactSize = false }) {
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
                        `relative z-10 rounded-lg font-mono font-bold uppercase transition-colors tap-action cursor-pointer ${compactSize ? 'px-2 py-[3px] text-[8px] tracking-[0.16em]' : 'px-3 py-1.5 text-[10px] tracking-[0.2em]'}`,
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

function FilterPill({ label, color, active, onClick, compact = false }) {
    return (
        <button
            onClick={onClick}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border font-mono font-bold uppercase tracking-[0.18em] transition-all duration-200 tap-action cursor-pointer ${compact ? 'px-2 py-[3px] text-[8px]' : 'px-3 py-1.5 text-[10px]'}`}
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
