import React, { useMemo } from 'react';

function formatDueTime(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
    });
}

function getDayLabel(date) {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    if (
        date.getFullYear() === today.getFullYear() &&
        date.getMonth() === today.getMonth() &&
        date.getDate() === today.getDate()
    ) return 'Today';

    if (
        date.getFullYear() === tomorrow.getFullYear() &&
        date.getMonth() === tomorrow.getMonth() &&
        date.getDate() === tomorrow.getDate()
    ) return 'Tomorrow';

    return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
    });
}

export default function CalendarAgenda({ assignments, classes }) {
    const classMap = useMemo(() => {
        const m = {};
        for (const c of classes) m[c.id] = c;
        return m;
    }, [classes]);

    // Build 30-day window (past 2 + next 28) grouped by date
    const groups = useMemo(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        // Past 2 days + next 28 days
        const windowStart = new Date(now);
        windowStart.setDate(now.getDate() - 2);
        const windowEnd = new Date(now);
        windowEnd.setDate(now.getDate() + 28);

        // Group assignments by date key
        const map = {};
        for (const a of assignments) {
            if (!a.due_date) continue;
            const d = new Date(a.due_date);
            if (Number.isNaN(d.getTime())) continue;
            const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            if (dayStart < windowStart || dayStart > windowEnd) continue;

            const key = dayStart.getTime();
            if (!map[key]) map[key] = { date: dayStart, items: [] };
            map[key].items.push(a);
        }

        // Sort items within each day by due time
        for (const key in map) {
            map[key].items.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
        }

        // Build 30-day list, including empty days
        const result = [];
        for (let i = -2; i <= 28; i++) {
            const d = new Date(now);
            d.setDate(now.getDate() + i);
            d.setHours(0, 0, 0, 0);
            const key = d.getTime();
            result.push({
                date: d,
                items: map[key]?.items || [],
            });
        }

        return result;
    }, [assignments]);

    const nowMs = Date.now();

    return (
        <div className="space-y-1 mt-2">
            {groups.map(({ date, items }, idx) => {
                const label = getDayLabel(date);
                const isPast = date < new Date(new Date().setHours(0, 0, 0, 0));

                return (
                    <div key={idx} className={isPast && items.length === 0 ? 'opacity-40' : ''}>
                        {/* Day separator */}
                        <div className="flex items-center gap-3 py-2">
                            <span className={`font-mono text-[10px] uppercase tracking-[0.2em] font-bold shrink-0 ${
                                label === 'Today' ? 'text-claude-accent' : 'text-claude-secondary'
                            }`}>
                                {label}
                            </span>
                            <div className="flex-1 h-px bg-claude-border/30" />
                            {items.length > 0 && (
                                <span className="font-mono text-[9px] text-claude-secondary shrink-0">
                                    {items.length}
                                </span>
                            )}
                        </div>

                        {/* Items */}
                        {items.length === 0 ? (
                            <p className="font-serif italic text-[12px] text-claude-secondary opacity-50 pb-1 pl-1">
                                —
                            </p>
                        ) : (
                            <div className="space-y-2 pb-2">
                                {items.map(a => {
                                    const cls = classMap[a.class_id];
                                    const color = cls?.color || 'var(--accent-color)';
                                    const isOverdue = new Date(a.due_date) < nowMs;

                                    return (
                                        <div
                                            key={a.id}
                                            className="flex items-center gap-3 p-3 rounded-2xl transition-colors duration-150"
                                            style={{ backgroundColor: color + '10' }}
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full shrink-0"
                                                style={{ backgroundColor: color }}
                                            />
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-mono text-[11px] font-bold uppercase tracking-wide truncate ${isOverdue ? 'text-red-400' : 'text-claude-text'}`}>
                                                    {a.title}
                                                </p>
                                                {cls && (
                                                    <p className="font-mono text-[9px] uppercase tracking-wide opacity-70 mt-0.5 truncate"
                                                       style={{ color }}>
                                                        {cls.name}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="shrink-0 text-right">
                                                <p className={`font-mono text-[10px] font-bold ${isOverdue ? 'text-red-400' : 'text-claude-secondary'}`}>
                                                    {formatDueTime(a.due_date)}
                                                </p>
                                                {isOverdue && (
                                                    <span className="font-mono text-[8px] text-red-400 uppercase tracking-widest">
                                                        Overdue
                                                    </span>
                                                )}
                                                {a.assignment_type && a.assignment_type !== 'assignment' && !isOverdue && (
                                                    <span className="font-mono text-[8px] text-claude-accent uppercase tracking-widest">
                                                        {a.assignment_type}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
