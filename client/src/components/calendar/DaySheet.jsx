import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';

function isSameDay(a, b) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

function formatTime(timeStr) {
    if (!timeStr) return '';
    return new Date(`2000-01-01T${timeStr}`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function formatDueTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}

const prefersReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const springTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 320, damping: 30 };

const fadeTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.2 };

export default function DaySheet({ selectedDay, onClose, assignments, scheduleSlots, classes }) {
    const navigate = useNavigate();

    const classMap = useMemo(() => {
        const m = {};
        for (const c of classes) m[c.id] = c;
        return m;
    }, [classes]);

    const dayAssignments = useMemo(() => {
        if (!selectedDay) return [];
        return assignments
            .filter(a => {
                if (!a.due_date) return false;
                const d = new Date(a.due_date);
                return !Number.isNaN(d.getTime()) && isSameDay(d, selectedDay);
            })
            .sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    }, [selectedDay, assignments]);

    const daySlots = useMemo(() => {
        if (!selectedDay) return [];
        return scheduleSlots
            .filter(s => s.day_of_week === selectedDay.getDay())
            .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }, [selectedDay, scheduleSlots]);

    const now = new Date();

    const dateLabel = selectedDay
        ? selectedDay.toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })
        : '';

    return (
        <AnimatePresence>
            {selectedDay && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={fadeTransition}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/40"
                        aria-hidden="true"
                    />

                    {/* Sheet */}
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Events for ${dateLabel}`}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={springTransition}
                        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[2rem] bg-claude-surface border-t border-claude-border/30 max-h-[72vh] flex flex-col pb-safe"
                    >
                        {/* Drag handle */}
                        <div className="w-10 h-1 bg-claude-border/40 rounded-full mx-auto mt-3 mb-1 shrink-0" />

                        {/* Scrollable content */}
                        <div className="overflow-y-auto flex-1 px-5 pt-2 pb-6">
                            {/* Date title */}
                            <h2 className="font-serif italic font-bold text-xl text-claude-text mb-4">
                                {dateLabel}
                            </h2>

                            {/* Schedule slots */}
                            {daySlots.length > 0 && (
                                <section className="mb-5">
                                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-claude-secondary mb-2">
                                        Schedule
                                    </p>
                                    <div className="space-y-2">
                                        {daySlots.map(slot => {
                                            const cls = classMap[slot.class_id];
                                            if (!cls) return null;
                                            return (
                                                <button
                                                    key={slot.id}
                                                    onClick={() => { onClose(); navigate(`/class/${cls.id}`); }}
                                                    className="w-full flex items-center gap-3 p-3 rounded-2xl text-left cursor-pointer transition-colors duration-150 active:scale-[0.99] tap-action"
                                                    style={{
                                                        backgroundColor: (cls.color || 'var(--accent-color)') + '12',
                                                        borderLeft: `3px solid ${cls.color || 'var(--accent-color)'}`,
                                                    }}
                                                >
                                                    <div className="shrink-0 text-center min-w-[52px]">
                                                        <div className="font-mono text-[11px] font-bold text-claude-text">
                                                            {formatTime(slot.start_time)}
                                                        </div>
                                                        <div className="w-px h-2 bg-claude-border/60 mx-auto my-0.5" />
                                                        <div className="font-mono text-[9px] text-claude-secondary">
                                                            {formatTime(slot.end_time)}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="font-serif italic font-bold text-claude-text text-sm leading-tight">
                                                            {cls.name}
                                                        </p>
                                                        {cls.room && (
                                                            <p className="font-mono text-[9px] uppercase tracking-wide opacity-60 mt-0.5"
                                                               style={{ color: cls.color || 'var(--accent-color)' }}>
                                                                {cls.room}
                                                            </p>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Assignments */}
                            <section>
                                <p className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold text-claude-secondary mb-2">
                                    Assignments
                                </p>

                                {dayAssignments.length === 0 ? (
                                    <p className="font-serif italic text-claude-secondary opacity-60 text-sm py-4 text-center">
                                        Nothing due — enjoy your day.
                                    </p>
                                ) : (
                                    <div className="space-y-2">
                                        {dayAssignments.map(a => {
                                            const cls = classMap[a.class_id];
                                            const dueDate = new Date(a.due_date);
                                            const isOverdue = dueDate < now;
                                            const color = cls?.color || 'var(--accent-color)';

                                            return (
                                                <div
                                                    key={a.id}
                                                    className="flex items-start gap-3 p-3 rounded-2xl transition-colors duration-150"
                                                    style={{ backgroundColor: color + '10' }}
                                                >
                                                    <span
                                                        className="w-2 h-2 rounded-full shrink-0 mt-1"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                    <div className="flex-1 min-w-0">
                                                        <p className={`font-mono text-[11px] font-bold uppercase tracking-wide leading-snug ${isOverdue ? 'text-red-400' : 'text-claude-text'}`}>
                                                            {a.title}
                                                        </p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <span className="font-mono text-[9px] text-claude-secondary">
                                                                Due {formatDueTime(a.due_date)}
                                                            </span>
                                                            {isOverdue && (
                                                                <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 font-mono text-[8px] uppercase tracking-widest font-bold rounded-full">
                                                                    Overdue
                                                                </span>
                                                            )}
                                                            {a.assignment_type && a.assignment_type !== 'assignment' && (
                                                                <span className="px-1.5 py-0.5 bg-claude-accent/15 text-claude-accent font-mono text-[8px] uppercase tracking-widest font-bold rounded-full">
                                                                    {a.assignment_type}
                                                                </span>
                                                            )}
                                                        </div>
                                                        {cls && (
                                                            <p className="font-mono text-[9px] uppercase tracking-wide mt-0.5 opacity-70"
                                                               style={{ color }}>
                                                                {cls.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </section>

                            {dayAssignments.length === 0 && daySlots.length === 0 && (
                                <p className="font-serif italic text-claude-secondary opacity-40 text-sm text-center py-8">
                                    Free day — nothing scheduled.
                                </p>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
