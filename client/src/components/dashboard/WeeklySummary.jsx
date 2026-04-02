import React, { useEffect, useMemo, useRef } from 'react';
import { Clock3, Target, TrendingUp } from 'lucide-react';
import { animateCounter, EASE } from '../../utils/animations';

function formatMinutes(totalMinutes) {
    if (totalMinutes >= 60) {
        return `${(totalMinutes / 60).toFixed(1)}h`;
    }
    return `${Math.round(totalMinutes)}m`;
}

function formatAccuracy(accuracy) {
    if (accuracy == null) return '--';
    return `${Math.round(accuracy * 100)}%`;
}

function getMetricAriaLabel(metric, summary) {
    if (metric.id === 'cards') {
        return `${summary.cards_studied} cards studied this week`;
    }
    if (metric.id === 'accuracy') {
        return summary.accuracy == null
            ? 'No study accuracy yet this week'
            : `${Math.round(summary.accuracy * 100)} percent accuracy this week`;
    }
    return `${formatMinutes(summary.total_minutes)} studied this week`;
}

function WeeklySummarySkeleton() {
    return (
        <section
            aria-label="Loading weekly summary"
            className="glass-panel-premium gsap-section min-h-[208px] rounded-[28px] p-5 sm:p-6"
        >
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <div className="h-3 w-16 animate-pulse rounded bg-claude-border/60" />
                    <div className="mt-3 h-6 w-28 animate-pulse rounded bg-claude-border/50" />
                </div>
                <div className="h-8 w-8 animate-pulse rounded-full bg-claude-border/50" />
            </div>
            <div className="grid grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div key={index} className="min-h-[92px] rounded-2xl border border-claude-border/40 bg-claude-bg/20 p-4">
                        <div className="h-3 w-8 animate-pulse rounded bg-claude-border/50" />
                        <div className="mt-4 h-8 w-12 animate-pulse rounded bg-claude-border/60" />
                        <div className="mt-3 h-2.5 w-16 animate-pulse rounded bg-claude-border/40" />
                    </div>
                ))}
            </div>
            <div className="mt-5 h-[64px] rounded-2xl border border-claude-border/40 bg-claude-bg/20 px-3 py-3">
                <div className="flex h-full items-end gap-2">
                    {Array.from({ length: 7 }).map((_, index) => (
                        <div key={index} className="flex flex-1 flex-col items-center gap-2">
                            <div
                                className="w-full animate-pulse rounded-t-sm bg-claude-border/50"
                                style={{ height: `${20 + (index % 4) * 10}px` }}
                            />
                            <div className="h-2 w-4 animate-pulse rounded bg-claude-border/40" />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default function WeeklySummary({ summary, loading, reducedMotion = false, lowVisualBudget = false }) {
    const metricRefs = useRef({});
    const barsRef = useRef(null);

    const metrics = useMemo(() => {
        if (!summary) return [];

        return [
            {
                id: 'cards',
                label: 'Cards',
                icon: TrendingUp,
                value: summary.cards_studied,
                accent: 'text-claude-accent',
                formatter: (value) => Math.round(value),
            },
            {
                id: 'accuracy',
                label: 'Accuracy',
                icon: Target,
                value: summary.accuracy == null ? null : summary.accuracy * 100,
                accent: 'text-claude-text',
                formatter: (value) => `${Math.round(value)}%`,
            },
            {
                id: 'time',
                label: 'Studied',
                icon: Clock3,
                value: summary.total_minutes,
                accent: 'text-claude-text',
                formatter: (value) => formatMinutes(value),
            },
        ];
    }, [summary]);

    useEffect(() => {
        if (!summary || loading || reducedMotion || lowVisualBudget) return undefined;

        const bars = Array.from(barsRef.current?.querySelectorAll('[data-bar-fill]') || []);
        if (!bars.length) return undefined;

        bars.forEach((bar) => {
            bar.style.transform = 'scaleY(0)';
        });

        const frame = window.requestAnimationFrame(() => {
            bars.forEach((bar) => {
                bar.style.transform = 'scaleY(1)';
            });
        });

        return () => {
            window.cancelAnimationFrame(frame);
            bars.forEach((bar) => {
                bar.style.transform = '';
            });
        };
    }, [summary, loading, reducedMotion, lowVisualBudget]);

    useEffect(() => {
        if (!summary || loading) return undefined;

        const animations = [];

        metrics.forEach((metric) => {
            const el = metricRefs.current[metric.id];
            if (!el) return;

            if (metric.id === 'accuracy' && summary.accuracy == null) {
                el.textContent = '--';
                return;
            }

            const finalText = metric.formatter(metric.value);
            if (reducedMotion || lowVisualBudget) {
                el.textContent = String(finalText);
                return;
            }

            el.textContent = metric.formatter(0);
            animations.push(animateCounter(el, metric.value, {
                duration: 0.6,
                ease: EASE.reveal,
                formatter: metric.formatter,
            }));
        });

        return () => {
            animations.forEach((animation) => animation?.kill?.());
        };
    }, [summary, loading, reducedMotion, lowVisualBudget, metrics]);

    if (loading || !summary) {
        return <WeeklySummarySkeleton />;
    }

    const maxCards = Math.max(...summary.daily_breakdown.map((day) => day.cards), 0);

    return (
        <section
            aria-labelledby="weekly-summary-heading"
            className="glass-panel-premium gsap-section rounded-[28px] p-5 sm:p-6"
            data-testid="weekly-summary"
        >
            <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.26em] text-claude-secondary">
                        This Week
                    </p>
                    <h2 id="weekly-summary-heading" className="mt-2 font-display text-[1.55rem] font-bold italic leading-none text-claude-text">
                        How It&apos;s Going
                    </h2>
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-2xl border border-claude-accent/20 bg-claude-accent/10 text-claude-accent sm:flex">
                    <TrendingUp className="h-4 w-4" />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
                {metrics.map((metric) => {
                    const Icon = metric.icon;
                    return (
                        <article
                            key={metric.id}
                            className="min-h-[96px] rounded-2xl border border-claude-border/40 bg-claude-bg/20 p-4"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">
                                    {metric.label}
                                </p>
                                <Icon className={`h-3.5 w-3.5 ${metric.accent}`} />
                            </div>
                            <p
                                ref={(node) => {
                                    metricRefs.current[metric.id] = node;
                                }}
                                className={`mt-3 font-display text-2xl font-bold leading-none ${metric.accent}`}
                                aria-hidden="true"
                            >
                                {metric.id === 'cards'
                                    ? summary.cards_studied
                                    : metric.id === 'accuracy'
                                        ? formatAccuracy(summary.accuracy)
                                        : formatMinutes(summary.total_minutes)}
                            </p>
                            <span className="sr-only">{getMetricAriaLabel(metric, summary)}</span>
                        </article>
                    );
                })}
            </div>

            <div
                className="mt-5 rounded-2xl border border-claude-border/40 bg-claude-bg/20 px-3 py-3"
                role="list"
                aria-label="Daily study volume this week"
                ref={barsRef}
            >
                <div className="flex h-[64px] items-end gap-2">
                    {summary.daily_breakdown.map((day, index) => {
                        const targetHeight = maxCards > 0 ? `${Math.max((day.cards / maxCards) * 100, day.cards > 0 ? 16 : 8)}%` : '8%';
                        return (
                            <div key={day.date} className="flex flex-1 flex-col items-center gap-2" role="listitem">
                                <div
                                    data-bar-fill="true"
                                    className={`w-full rounded-t-sm ${day.is_today ? 'bg-claude-accent' : 'bg-claude-accent/60'}`}
                                    style={{
                                        height: targetHeight,
                                        transformOrigin: 'bottom',
                                        transform: reducedMotion || lowVisualBudget ? 'none' : 'scaleY(1)',
                                        transition: reducedMotion || lowVisualBudget
                                            ? 'none'
                                            : `transform 400ms ${index * 50}ms cubic-bezier(0.22,1,0.36,1)`,
                                    }}
                                    aria-label={`${day.day}: ${day.cards} cards studied`}
                                />
                                <span className={`text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${day.is_today ? 'text-claude-accent' : 'text-claude-secondary/70'}`}>
                                    {day.day.slice(0, 1)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
