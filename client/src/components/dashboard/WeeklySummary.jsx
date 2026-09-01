import React, { useId, useMemo } from 'react';
import { CalendarDays, Clock3, Target, TrendingUp } from 'lucide-react';

const CHART_WIDTH = 320;
const CHART_HEIGHT = 92;
const CHART_PADDING_X = 10;
const CHART_PADDING_TOP = 10;
const CHART_PADDING_BOTTOM = 14;

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

function getMetricAriaLabel(metric, summary, dueThisWeekCount) {
    if (metric.id === 'dueThisWeek') {
        return `${dueThisWeekCount} assignments due this week`;
    }
    if (metric.id === 'accuracy') {
        return summary.accuracy == null
            ? 'No study accuracy yet this week'
            : `${Math.round(summary.accuracy * 100)} percent accuracy this week`;
    }
    return `${formatMinutes(summary.total_minutes)} study time this week`;
}

function getMetricDisplayValue(metricId, summary, dueThisWeekCount) {
    if (metricId === 'dueThisWeek') {
        return dueThisWeekCount;
    }
    if (metricId === 'accuracy') {
        return formatAccuracy(summary.accuracy);
    }
    return formatMinutes(summary.total_minutes);
}

function buildChartModel(dailyBreakdown = []) {
    const baselineY = CHART_HEIGHT - CHART_PADDING_BOTTOM;
    const usableHeight = baselineY - CHART_PADDING_TOP;
    const innerWidth = CHART_WIDTH - CHART_PADDING_X * 2;
    const peakCards = Math.max(...dailyBreakdown.map((day) => day.cards || 0), 0);
    const flatlineY = CHART_PADDING_TOP + usableHeight * 0.62;

    const points = dailyBreakdown.map((day, index) => {
        const x = dailyBreakdown.length <= 1
            ? CHART_WIDTH / 2
            : CHART_PADDING_X + (innerWidth / (dailyBreakdown.length - 1)) * index;
        const y = peakCards > 0
            ? baselineY - ((day.cards || 0) / peakCards) * usableHeight
            : flatlineY;

        return {
            ...day,
            x,
            y,
        };
    });

    const linePath = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

    const lastPoint = points[points.length - 1];
    const firstPoint = points[0];

    const areaPath = points.length > 0
        ? `${linePath} L ${lastPoint.x} ${baselineY} L ${firstPoint.x} ${baselineY} Z`
        : '';

    return {
        points,
        linePath,
        areaPath,
        baselineY,
        peakCards,
    };
}

function WeeklySummarySkeleton() {
    return (
        <section
            aria-label="Loading weekly summary"
            className="glass-panel-premium min-h-[208px] rounded-[28px] p-5 sm:p-6"
        >
            <div className="mb-5 flex items-center justify-between gap-4" data-section-reveal-target="true">
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

export default function WeeklySummary({
    summary,
    loading,
    dueThisWeekCount = 0,
}) {
    const gradientBaseId = useId().replace(/:/g, '');
    const areaGradientId = `${gradientBaseId}-area`;

    const metrics = useMemo(() => {
        if (!summary) return [];

        return [
            {
                id: 'dueThisWeek',
                label: 'Due This Week',
                icon: CalendarDays,
                value: dueThisWeekCount,
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
                label: 'Study Time',
                icon: Clock3,
                value: summary.total_minutes,
                accent: 'text-claude-text',
                formatter: (value) => formatMinutes(value),
            },
        ];
    }, [summary, dueThisWeekCount]);

    const chartModel = useMemo(
        () => buildChartModel(summary?.daily_breakdown || []),
        [summary],
    );

    if (loading || !summary) {
        return <WeeklySummarySkeleton />;
    }

    return (
        <section
            aria-labelledby="weekly-summary-heading"
            className="glass-panel-premium rounded-[28px] p-5 sm:p-6"
            data-testid="weekly-summary"
        >
            <div className="mb-5 flex items-start justify-between gap-4" data-section-reveal-target="true">
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
                                className={`mt-3 font-display text-2xl font-bold leading-none ${metric.accent}`}
                                aria-hidden="true"
                            >
                                {getMetricDisplayValue(metric.id, summary, dueThisWeekCount)}
                            </p>
                            <span className="sr-only">{getMetricAriaLabel(metric, summary, dueThisWeekCount)}</span>
                        </article>
                    );
                })}
            </div>

            <div className="mt-5 rounded-2xl border border-claude-border/40 bg-claude-bg/20 px-4 py-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">
                        Study Activity
                    </p>
                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary/75">
                        {chartModel.peakCards > 0
                            ? `${summary.cards_studied} cards reviewed`
                            : 'Ready for your next session'}
                    </p>
                </div>

                <svg
                    viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                    className="h-[92px] w-full overflow-visible"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label="Study activity this week"
                    data-testid="weekly-summary-line-chart"
                >
                    <defs>
                        <linearGradient id={areaGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0" />
                        </linearGradient>
                    </defs>

                    <line x1="0" y1="24" x2={CHART_WIDTH} y2="24" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.2" />
                    <line x1="0" y1="50" x2={CHART_WIDTH} y2="50" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.2" />
                    <line x1="0" y1="76" x2={CHART_WIDTH} y2="76" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.2" />

                    {chartModel.areaPath ? (
                        <path d={chartModel.areaPath} fill={`url(#${areaGradientId})`} />
                    ) : null}

                    {chartModel.linePath ? (
                        <path
                            d={chartModel.linePath}
                            fill="none"
                            stroke="var(--accent-color)"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2.5"
                        />
                    ) : null}

                    {chartModel.points.map((point) => (
                        <g key={point.date}>
                            <circle
                                cx={point.x}
                                cy={point.y}
                                r="4"
                                fill="var(--accent-color)"
                                data-testid="weekly-summary-line-point"
                            />
                            <text
                                x={point.x}
                                y={Math.max(8, point.y - 8)}
                                textAnchor="middle"
                                fill="var(--secondary-text-color)"
                                fontSize="8"
                                fontFamily="ui-monospace, monospace"
                                data-testid="weekly-summary-line-label"
                            >
                                {Math.round(point.cards || 0)}
                            </text>
                        </g>
                    ))}
                </svg>

                <div className="mt-2 grid grid-cols-7 gap-2" aria-hidden="true">
                    {chartModel.points.map((point) => (
                        <span
                            key={point.date}
                            className={`text-center text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${point.is_today ? 'text-claude-accent' : 'text-claude-secondary/70'}`}
                        >
                            {point.day.slice(0, 1)}
                        </span>
                    ))}
                </div>

                <div className="sr-only" role="list" aria-label="Daily study activity this week">
                    {chartModel.points.map((point) => (
                        <span key={point.date} role="listitem">
                            {point.day}: {point.cards} cards studied
                        </span>
                    ))}
                </div>
            </div>
        </section>
    );
}
