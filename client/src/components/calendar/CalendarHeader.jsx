import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function CalendarHeader({
    viewMonth,
    onPrevMonth,
    onNextMonth,
    onToday,
    view,
    onViewChange,
    classes,
    activeFilters,
    onFilterToggle,
    showSchedule,
    onScheduleToggle,
}) {
    const monthLabel = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const isCurrentMonth =
        viewMonth.getMonth() === new Date().getMonth() &&
        viewMonth.getFullYear() === new Date().getFullYear();

    return (
        <div className="space-y-3 mb-4">
            {/* Month navigation + view toggle */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <button
                        onClick={onPrevMonth}
                        aria-label="Previous month"
                        className="w-9 h-9 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div className="px-3 min-w-[160px] text-center">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={monthLabel}
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 6 }}
                                transition={{ duration: 0.15 }}
                                className="font-serif italic font-bold text-lg text-claude-text"
                            >
                                {monthLabel}
                            </motion.span>
                        </AnimatePresence>
                    </div>

                    <button
                        onClick={onNextMonth}
                        aria-label="Next month"
                        className="w-9 h-9 flex items-center justify-center rounded-xl glass-panel text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-2">
                    {!isCurrentMonth && (
                        <button
                            onClick={onToday}
                            className="px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-widest glass-panel rounded-lg text-claude-secondary hover:text-claude-accent transition-colors tap-action cursor-pointer"
                        >
                            Today
                        </button>
                    )}

                    {/* View toggle — shared element pill */}
                    <div className="relative flex glass-panel rounded-xl p-1">
                        {['Month', 'Agenda'].map((v) => (
                            <button
                                key={v}
                                onClick={() => onViewChange(v.toLowerCase())}
                                className="relative px-3 py-1.5 font-mono text-[10px] uppercase font-bold tracking-widest rounded-lg z-10 transition-colors tap-action cursor-pointer"
                                style={{ color: view === v.toLowerCase() ? 'var(--text-color)' : 'var(--secondary-text-color)' }}
                            >
                                {view === v.toLowerCase() && (
                                    <motion.span
                                        layoutId="calendar-view-pill"
                                        className="absolute inset-0 bg-claude-accent rounded-lg"
                                        transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                                    />
                                )}
                                <span className="relative z-10">{v}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 -mx-4 px-4">
                {/* All */}
                <FilterPill
                    label="All"
                    active={activeFilters.length === 0}
                    onClick={() => onFilterToggle('all')}
                />

                {/* Per-class pills */}
                {classes.map((cls) => (
                    <FilterPill
                        key={cls.id}
                        label={cls.name}
                        color={cls.color}
                        active={activeFilters.includes(cls.id)}
                        onClick={() => onFilterToggle(cls.id)}
                    />
                ))}

                {/* Schedule toggle */}
                <FilterPill
                    label="Schedule"
                    icon="line"
                    active={showSchedule}
                    onClick={onScheduleToggle}
                />
            </div>
        </div>
    );
}

function FilterPill({ label, color, active, onClick, icon }) {
    return (
        <button
            onClick={onClick}
            className="flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-full border font-mono text-[10px] uppercase font-bold tracking-widest transition-all duration-200 tap-action cursor-pointer"
            style={
                active && color
                    ? {
                        backgroundColor: color + '20',
                        color: color,
                        borderColor: color + '50',
                    }
                    : active
                    ? {
                        backgroundColor: 'var(--accent-color)' + '20',
                        color: 'var(--accent-color)',
                        borderColor: 'var(--accent-color)' + '50',
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
            {icon === 'line' && (
                <span
                    className="w-3 h-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: active ? 'var(--accent-color)' : 'var(--secondary-text-color)', opacity: active ? 1 : 0.5 }}
                />
            )}
            {label}
        </button>
    );
}
