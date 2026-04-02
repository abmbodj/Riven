import React, { useMemo, useState } from 'react';
import { ArrowRight, CalendarClock, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';

const COLLAPSED_COUNT = 5;

const TONE_CLASSES = {
    overdue: 'text-red-400',
    today: 'text-claude-accent',
    tomorrow: 'text-claude-secondary',
};

export default function PriorityItems({ items = [] }) {
    const [expanded, setExpanded] = useState(false);

    const visibleItems = useMemo(
        () => (expanded ? items : items.slice(0, COLLAPSED_COUNT)),
        [expanded, items],
    );

    return (
        <section
            aria-labelledby="priority-items-heading"
            className="glass-panel-premium gsap-section rounded-[28px] p-5 sm:p-6 lg:sticky lg:top-6"
            data-testid="priority-items"
        >
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.26em] text-claude-secondary">
                        Priority
                    </p>
                    <h2 id="priority-items-heading" className="mt-2 font-display text-[1.55rem] font-bold italic leading-none text-claude-text">
                        What Needs You
                    </h2>
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-claude-border/40 bg-claude-bg/20 text-claude-accent sm:flex">
                    <CalendarClock className="h-4 w-4" />
                </div>
            </div>

            {items.length > 0 ? (
                <>
                    <div className="space-y-2.5">
                        {visibleItems.map((item) => (
                            <Link
                                key={item.id}
                                to={item.to}
                                className="tap-action group flex min-h-[72px] items-start gap-3 rounded-2xl border border-claude-border/40 bg-claude-bg/20 px-4 py-3 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                            >
                                <span
                                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                                    style={{ backgroundColor: item.classColor || 'var(--border-color)' }}
                                    aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="line-clamp-2 text-sm font-medium leading-snug text-claude-text">
                                        {item.title}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {item.className ? (
                                            <span className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary/70">
                                                {item.className}
                                            </span>
                                        ) : null}
                                        <span className={`text-[10px] font-mono font-bold uppercase tracking-[0.18em] ${TONE_CLASSES[item.tone] || TONE_CLASSES.tomorrow}`}>
                                            {item.urgencyLabel}
                                        </span>
                                    </div>
                                </div>
                                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-claude-secondary/50 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-claude-accent" />
                            </Link>
                        ))}
                    </div>

                    {items.length > COLLAPSED_COUNT ? (
                        <button
                            type="button"
                            onClick={() => setExpanded((current) => !current)}
                            className="tap-action mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-claude-border/50 bg-claude-bg/10 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-claude-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                        >
                            {expanded ? 'Show fewer' : `Show all (${items.length})`}
                        </button>
                    ) : null}
                </>
            ) : (
                <div className="rounded-2xl border border-dashed border-claude-border/50 bg-claude-bg/10 px-5 py-8 text-center">
                    <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-claude-accent/70" />
                    <p className="font-display text-lg italic text-claude-text">Nothing urgent right now.</p>
                    <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                        Overdue, today, and tomorrow all clear.
                    </p>
                </div>
            )}
        </section>
    );
}
