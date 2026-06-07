import React from 'react';
import { CalendarPlus2, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
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

function SegmentedControl({ value, onChange, options }) {
    return (
        <div className="relative flex rounded-[1.1rem] border border-white/10 bg-[#0f1623]/70 p-1" role="tablist">
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    role="tab"
                    aria-selected={value === option.value}
                    className={`relative z-10 rounded-[0.85rem] px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] transition-colors ${
                        value === option.value ? 'text-[#182a31]' : 'text-claude-secondary'
                    }`}
                >
                    {value === option.value && (
                        <motion.span
                            layoutId={option.layoutId}
                            className="absolute inset-0 rounded-[0.85rem] bg-claude-accent"
                            transition={{ type: 'spring', stiffness: 420, damping: 35 }}
                        />
                    )}
                    <span className="relative z-10">{option.label}</span>
                </button>
            ))}
        </div>
    );
}

function MetricCard({ label, value, tone = 'default' }) {
    const toneClass = tone === 'accent'
        ? 'border-claude-accent/25 bg-[linear-gradient(145deg,rgba(222,185,106,0.18),rgba(42,30,12,0.6))]'
        : 'border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]';

    return (
        <div className={`rounded-[1.05rem] border px-3 py-2 ${toneClass}`}>
            <div className="text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                {label}
            </div>
            <div className="mt-1 text-[1rem] font-semibold text-claude-text">
                {value}
            </div>
        </div>
    );
}

function SourcePill({ label, color, active, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] transition-all ${
                active
                    ? 'border-white/15 bg-white/10 text-claude-text'
                    : 'border-white/10 bg-white/[0.03] text-claude-secondary hover:border-white/20 hover:text-claude-text'
            }`}
            style={active && color ? {
                borderColor: `${color}40`,
                backgroundColor: `${color}18`,
                color,
            } : undefined}
        >
            {color && (
                <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: color }}
                />
            )}
            <span>{label}</span>
        </button>
    );
}

function NavButton({ onClick, label, children }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="flex h-9 w-9 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-claude-secondary transition-colors hover:border-white/20 hover:text-claude-text"
        >
            {children}
        </button>
    );
}

export default function GroupPlannerHeader({
    groupName,
    anchorDate,
    onPrev,
    onNext,
    onToday,
    onPropose,
    view,
    onViewChange,
    contentMode,
    onContentModeChange,
    sources,
    activeFilters,
    onFilterToggle,
    metrics,
    shareModeControl,
}) {
    const rangeLabel = formatRangeLabel(anchorDate, view);
    const inCurrentRange = isCurrentRange(anchorDate, view);

    return (
        <section className="overflow-hidden rounded-[1.7rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(222,185,106,0.16),transparent_32%),linear-gradient(155deg,rgba(20,28,41,0.98),rgba(9,13,21,0.96))] p-3 shadow-[0_28px_64px_rgba(2,6,12,0.34)] md:p-4">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-3.5 w-3.5 text-claude-accent" />
                            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                Overlap planner
                            </span>
                        </div>
                        <h2 className="mt-2 font-display text-[1.35rem] font-bold italic leading-tight tracking-tight text-claude-text md:text-[1.65rem]">
                            Find the next study window for {groupName || 'this group'}.
                        </h2>
                        <p className="mt-2 max-w-2xl text-[12px] leading-5 text-claude-secondary">
                            Shared availability, live sessions, and best-fit meetup windows all in one planning surface.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2 lg:min-w-[18rem] lg:max-w-[22rem]">
                        <button
                            type="button"
                            onClick={onPropose}
                            className="inline-flex items-center justify-center gap-2 rounded-[1.1rem] border border-claude-accent/30 bg-claude-accent px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#182a31] shadow-[0_18px_34px_rgba(41,28,7,0.22)] transition-transform hover:-translate-y-0.5"
                        >
                            <CalendarPlus2 className="h-4 w-4" />
                            Propose Session
                        </button>
                        {shareModeControl}
                    </div>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                    {metrics.map((metric) => (
                        <MetricCard
                            key={metric.label}
                            label={metric.label}
                            value={metric.value}
                            tone={metric.tone}
                        />
                    ))}
                </div>

                <div className="grid gap-3 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
                    <div className="rounded-[1.2rem] border border-white/10 bg-[#0e1520]/72 p-2.5">
                        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex items-center gap-1 shrink-0">
                                    <NavButton onClick={onPrev} label={`Previous ${view}`}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </NavButton>
                                    <NavButton onClick={onNext} label={`Next ${view}`}>
                                        <ChevronRight className="h-4 w-4" />
                                    </NavButton>
                                </div>

                                <div className="min-w-0">
                                    <div className="text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                        Planner range
                                    </div>
                                    <motion.div
                                        key={`${view}-${rangeLabel}`}
                                        initial={{ opacity: 0, y: -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.16 }}
                                        className="truncate font-display text-[1.05rem] font-bold italic tracking-tight text-claude-text sm:text-[1.2rem]"
                                    >
                                        {rangeLabel}
                                    </motion.div>
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                                {!inCurrentRange && (
                                    <button
                                        type="button"
                                        onClick={onToday}
                                        className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:border-white/20 hover:text-claude-text"
                                    >
                                        Today
                                    </button>
                                )}

                                <SegmentedControl
                                    value={view}
                                    onChange={onViewChange}
                                    options={[
                                        { value: 'month', label: 'Month', layoutId: 'group-planner-view-pill' },
                                        { value: 'week', label: 'Week', layoutId: 'group-planner-view-pill' },
                                        { value: 'day', label: 'Day', layoutId: 'group-planner-view-pill' },
                                    ]}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-[1.2rem] border border-white/10 bg-[#0e1520]/72 p-2.5">
                        <SegmentedControl
                            value={contentMode}
                            onChange={onContentModeChange}
                            options={[
                                { value: 'assignments', label: 'Sessions', layoutId: 'group-planner-content-pill' },
                                { value: 'classes', label: 'Availability', layoutId: 'group-planner-content-pill' },
                                { value: 'both', label: 'Both', layoutId: 'group-planner-content-pill' },
                            ]}
                        />
                    </div>
                </div>

                <div className="rounded-[1.2rem] border border-white/10 bg-[#0e1520]/72 p-2.5">
                    <div className="flex items-center gap-2">
                        <span className="text-[8px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                            Focus lanes
                        </span>
                    </div>
                    <div
                        data-testid="calendar-filter-list"
                        className="mt-2 flex gap-1.5 overflow-x-auto hide-scrollbar sm:flex-wrap sm:overflow-visible"
                    >
                        <SourcePill
                            label="Everyone"
                            active={activeFilters.length === 0}
                            onClick={() => onFilterToggle('all')}
                        />

                        {sources.map((source) => (
                            <SourcePill
                                key={source.id}
                                label={source.name}
                                color={source.color}
                                active={activeFilters.includes(source.id)}
                                onClick={() => onFilterToggle(source.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
