import React, { useId, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BarChart3,
    Clock3,
    Flame,
    Loader2,
    Medal,
    Sparkles,
    Target,
    TrendingUp,
} from 'lucide-react';

function formatPercent(value) {
    if (value == null) return '--';
    return `${Math.round(value)}%`;
}

function formatPace(seconds) {
    if (seconds == null) return '--';
    const rounded = Math.round(seconds);
    if (rounded < 60) return `${rounded}s/q`;
    const minutes = Math.floor(rounded / 60);
    const remainingSeconds = rounded % 60;
    return `${minutes}m ${remainingSeconds.toString().padStart(2, '0')}s/q`;
}

function formatMinutes(minutes) {
    if (minutes == null) return '--';
    if (minutes >= 60) return `${(minutes / 60).toFixed(1)}h`;
    return `${Math.round(minutes)}m`;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTopicPercent(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
}

function buildTrendModel(attempts) {
    const chartWidth = 320;
    const chartHeight = 90;
    const paddingX = 10;
    const paddingTop = 10;
    const baselineY = 76;
    const usableHeight = baselineY - paddingTop;
    const innerWidth = chartWidth - paddingX * 2;

    const points = attempts
        .slice()
        .reverse()
        .map((attempt, index, list) => {
            const x = list.length <= 1
                ? chartWidth / 2
                : paddingX + (innerWidth / (list.length - 1)) * index;
            const score = Number(attempt.percentage || 0);
            const y = baselineY - (score / 100) * usableHeight;
            return { ...attempt, x, y };
        });

    return {
        points,
        linePath: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
        areaPath: points.length > 0
            ? `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} L ${points.at(-1).x} ${baselineY} L ${points[0].x} ${baselineY} Z`
            : '',
    };
}

function ExamInsightsSkeleton() {
    return (
        <section
            aria-label="Loading exam insights"
            className="glass-panel rounded-[28px] p-5 sm:p-6"
        >
            <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                    <div className="h-3 w-20 animate-pulse rounded bg-claude-border/60" />
                    <div className="mt-3 h-8 w-40 animate-pulse rounded bg-claude-border/50" />
                </div>
                <div className="h-10 w-10 animate-pulse rounded-2xl bg-claude-border/50" />
            </div>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="min-h-[110px] rounded-2xl border border-claude-border/40 bg-claude-bg/20 p-4">
                        <div className="h-3 w-16 animate-pulse rounded bg-claude-border/50" />
                        <div className="mt-4 h-8 w-20 animate-pulse rounded bg-claude-border/60" />
                        <div className="mt-3 h-2.5 w-24 animate-pulse rounded bg-claude-border/40" />
                    </div>
                ))}
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="min-h-[220px] rounded-[24px] border border-claude-border/40 bg-claude-bg/20 p-5">
                        <div className="h-3 w-20 animate-pulse rounded bg-claude-border/50" />
                        <div className="mt-4 h-6 w-40 animate-pulse rounded bg-claude-border/60" />
                        <div className="mt-3 space-y-2">
                            <div className="h-3 w-full animate-pulse rounded bg-claude-border/40" />
                            <div className="h-3 w-4/5 animate-pulse rounded bg-claude-border/40" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

function ActionButton({ action, onAction }) {
    return (
        <button
            type="button"
            onClick={() => onAction?.(action)}
            className="tap-action inline-flex min-h-[44px] items-center gap-2 rounded-full border border-claude-accent/25 bg-claude-accent/10 px-4 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
        >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{action.label}</span>
        </button>
    );
}

export default function ExamAnalytics({ insights, loading, onAction }) {
    const gradientBaseId = useId().replace(/:/g, '');
    const areaGradientId = `${gradientBaseId}-area`;
    const lineGradientId = `${gradientBaseId}-line`;

    const trendModel = useMemo(
        () => buildTrendModel(insights?.recentAttempts || []),
        [insights?.recentAttempts],
    );

    if (loading || !insights) {
        return <ExamInsightsSkeleton />;
    }

    const { summary, persona, habits, weakTopics, recentAttempts, recommendedActions } = insights;

    if ((summary?.totalAttempts || 0) === 0) {
        return (
            <section
                className="glass-panel rounded-[28px] p-6 sm:p-7"
                data-testid="exam-insights-hub"
            >
                <div className="mx-auto max-w-2xl text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.5rem] border border-claude-accent/20 bg-claude-accent/10 text-claude-accent">
                        <BarChart3 className="h-7 w-7" />
                    </div>
                    <p className="mt-5 text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-claude-secondary">
                        Insights Hub
                    </p>
                    <h2 className="mt-3 font-display text-[2rem] font-bold italic leading-none text-claude-text">
                        Learn your exam pattern
                    </h2>
                    <p className="mt-4 text-sm leading-6 text-claude-secondary">
                        Your mock exam hub will show pacing, weak topics, and exam-taker habits once you have a couple of attempts to compare.
                    </p>
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                        {recommendedActions.map((action) => (
                            <ActionButton key={action.id} action={action} onAction={onAction} />
                        ))}
                    </div>
                </div>
            </section>
        );
    }

    const statCards = [
        {
            label: 'Attempts',
            value: summary.totalAttempts,
            detail: 'Completed mock exams',
            icon: Target,
        },
        {
            label: 'Avg Score',
            value: formatPercent(summary.averageScore),
            detail: 'Across all attempts',
            icon: TrendingUp,
        },
        {
            label: 'Best Score',
            value: formatPercent(summary.bestScore),
            detail: 'Your strongest run',
            icon: Medal,
        },
        {
            label: 'Avg Pace',
            value: formatPace(summary.averagePaceSeconds),
            detail: 'Only timed attempts',
            icon: Clock3,
        },
    ];

    return (
        <section className="space-y-5" data-testid="exam-insights-hub">
            <div className="glass-panel rounded-[28px] p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-claude-secondary">
                            Insights Hub
                        </p>
                        <h2 className="mt-2 font-display text-[1.9rem] font-bold italic leading-none text-claude-text">
                            What kind of exam taker are you?
                        </h2>
                    </div>
                    <div className="hidden h-11 w-11 items-center justify-center rounded-[1.2rem] border border-claude-accent/20 bg-claude-accent/10 text-claude-accent sm:flex">
                        <Sparkles className="h-4.5 w-4.5" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {statCards.map((card) => {
                        const Icon = card.icon;
                        return (
                            <article key={card.label} className="min-h-[118px] rounded-2xl border border-claude-border/40 bg-claude-bg/20 p-4">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                        {card.label}
                                    </p>
                                    <Icon className="h-3.5 w-3.5 text-claude-accent" />
                                </div>
                                <p className="mt-4 font-display text-[1.75rem] font-bold leading-none text-claude-text">
                                    {card.value}
                                </p>
                                <p className="mt-3 text-xs text-claude-secondary/80">
                                    {card.detail}
                                </p>
                            </article>
                        );
                    })}
                </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.08fr_0.92fr]">
                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-claude-secondary">
                                Persona
                            </p>
                            <h3 className="mt-2 font-display text-[1.75rem] font-bold italic leading-none text-claude-text">
                                {persona.label}
                            </h3>
                        </div>
                        <div className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-3 py-1.5 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                            {summary.trendDelta == null ? 'Trend forming' : `${summary.trendDelta >= 0 ? '+' : ''}${Math.round(summary.trendDelta)} pt trend`}
                        </div>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-claude-secondary">
                        {persona.description}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {(persona.evidence || []).map((evidence) => (
                            <span
                                key={evidence}
                                className="rounded-full border border-claude-border/50 bg-claude-bg/20 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary"
                            >
                                {evidence}
                            </span>
                        ))}
                    </div>

                    <div className="mt-5 space-y-2.5">
                        {(persona.improvements || []).map((improvement) => (
                            <div key={improvement} className="rounded-2xl border border-claude-border/40 bg-claude-bg/20 px-4 py-3">
                                <p className="text-sm leading-6 text-claude-text">
                                    {improvement}
                                </p>
                            </div>
                        ))}
                    </div>

                    {recommendedActions.length > 0 ? (
                        <div className="mt-5 flex flex-wrap gap-2">
                            {recommendedActions.map((action) => (
                                <ActionButton key={action.id} action={action} onAction={onAction} />
                            ))}
                        </div>
                    ) : null}
                </article>

                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-claude-secondary">
                                Habits
                            </p>
                            <h3 className="mt-2 font-display text-[1.65rem] font-bold italic leading-none text-claude-text">
                                Your exam rhythm
                            </h3>
                        </div>
                        <div className="hidden h-10 w-10 items-center justify-center rounded-[1.1rem] border border-claude-border/40 bg-claude-bg/20 text-claude-accent sm:flex">
                            <Flame className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-2xl border border-claude-border/40 bg-claude-bg/20 p-4">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                Retry Rate
                            </p>
                            <p className="mt-3 font-display text-2xl font-bold leading-none text-claude-text">
                                {formatPercent((habits.retryRate || 0) * 100)}
                            </p>
                            <p className="mt-2 text-xs text-claude-secondary/80">
                                Attempts that repeat an exam
                            </p>
                        </div>
                        <div className="rounded-2xl border border-claude-border/40 bg-claude-bg/20 p-4">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                Strongest Day
                            </p>
                            <p className="mt-3 font-display text-2xl font-bold leading-none text-claude-text">
                                {habits.strongestStudyDay?.day || '--'}
                            </p>
                            <p className="mt-2 text-xs text-claude-secondary/80">
                                {habits.strongestStudyDay?.averageScore != null
                                    ? `${formatPercent(habits.strongestStudyDay.averageScore)} average`
                                    : 'Need more attempts'}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-claude-border/40 bg-claude-bg/20 p-4">
                            <p className="text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                Avg Duration
                            </p>
                            <p className="mt-3 font-display text-2xl font-bold leading-none text-claude-text">
                                {formatMinutes(habits.averageDurationMinutes)}
                            </p>
                            <p className="mt-2 text-xs text-claude-secondary/80">
                                Timed attempts only
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 rounded-[24px] border border-claude-border/40 bg-claude-bg/20 p-4">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-claude-accent" />
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                Score Trend
                            </p>
                        </div>

                        {recentAttempts.length < 2 ? (
                            <p className="mt-4 text-sm leading-6 text-claude-secondary">
                                Complete one more exam to see how your scores are moving.
                            </p>
                        ) : (
                            <>
                                <div className="mt-4 h-[92px] w-full">
                                    <svg viewBox="0 0 320 90" className="h-full w-full" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id={areaGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
                                                <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.28" />
                                                <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.02" />
                                            </linearGradient>
                                            <linearGradient id={lineGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
                                                <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.55" />
                                                <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="1" />
                                            </linearGradient>
                                        </defs>
                                        <line x1="0" y1="24" x2="320" y2="24" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.25" />
                                        <line x1="0" y1="50" x2="320" y2="50" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.25" />
                                        <line x1="0" y1="76" x2="320" y2="76" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.25" />
                                        <path d={trendModel.areaPath} fill={`url(#${areaGradientId})`} />
                                        <path d={trendModel.linePath} fill="none" stroke={`url(#${lineGradientId})`} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                                        {trendModel.points.map((point) => (
                                            <circle key={point.id} cx={point.x} cy={point.y} r="3.5" fill="var(--accent-color)" />
                                        ))}
                                    </svg>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary/80">
                                    <span>{formatDate(recentAttempts.at(-1)?.completedAt)}</span>
                                    <span>Most recent {formatDate(recentAttempts[0]?.completedAt)}</span>
                                </div>
                            </>
                        )}
                    </div>
                </article>
            </div>

            <div className="grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-claude-secondary">
                                Weak Topics
                            </p>
                            <h3 className="mt-2 font-display text-[1.65rem] font-bold italic leading-none text-claude-text">
                                Where to tighten up
                            </h3>
                        </div>
                        <div className="hidden h-10 w-10 items-center justify-center rounded-[1.1rem] border border-red-500/20 bg-red-500/10 text-red-400 sm:flex">
                            <Target className="h-4 w-4" />
                        </div>
                    </div>

                    {weakTopics.length > 0 ? (
                        <div className="mt-5 space-y-3">
                            {weakTopics.map((topic) => {
                                const width = `${Math.max(6, Math.round(topic.masteryScore * 100))}%`;

                                return (
                                    <div key={topic.id} className="rounded-2xl border border-red-500/10 bg-red-500/[0.05] p-4">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-claude-text">{topic.topic}</p>
                                            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-red-400">
                                                {formatTopicPercent(topic.masteryScore)}
                                            </span>
                                        </div>
                                        <div className="mt-3 h-2 overflow-hidden rounded-full bg-claude-bg/40">
                                            <div className="h-full rounded-full bg-red-500" style={{ width }} />
                                        </div>
                                        <p className="mt-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                            {topic.totalCorrect}/{topic.totalSeen} correct
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-dashed border-claude-border/50 bg-claude-bg/10 px-5 py-8 text-center">
                            <p className="font-display text-lg italic text-claude-text">No weak topics surfaced yet.</p>
                            <p className="mt-2 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                Linked-class attempts will start filling this in.
                            </p>
                        </div>
                    )}
                </article>

                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.24em] text-claude-secondary">
                                Recent Attempts
                            </p>
                            <h3 className="mt-2 font-display text-[1.65rem] font-bold italic leading-none text-claude-text">
                                Latest exam runs
                            </h3>
                        </div>
                        <div className="hidden h-10 w-10 items-center justify-center rounded-[1.1rem] border border-claude-border/40 bg-claude-bg/20 text-claude-accent sm:flex">
                            <Loader2 className="h-0 w-0" />
                            <BarChart3 className="h-4 w-4" />
                        </div>
                    </div>

                    <div className="mt-5 space-y-2.5">
                        {recentAttempts.map((attempt) => (
                            <Link
                                key={attempt.id}
                                to={`/exam/${attempt.examId}`}
                                className="tap-action group flex min-h-[78px] items-center gap-3 rounded-2xl border border-claude-border/40 bg-claude-bg/20 px-4 py-3 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                            >
                                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border border-claude-accent/15 bg-claude-accent/10">
                                    <span className="font-display text-lg font-bold text-claude-accent">
                                        {attempt.percentage != null ? `${attempt.percentage}%` : '--'}
                                    </span>
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-claude-text transition-colors group-hover:text-claude-accent">
                                        {attempt.title}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                            {attempt.score}/{attempt.total} correct
                                        </span>
                                        {attempt.durationSeconds ? (
                                            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                                {formatPace(attempt.durationSeconds / Math.max(attempt.total || 1, 1))}
                                            </span>
                                        ) : null}
                                        {attempt.examMode && attempt.examMode !== 'standard' ? (
                                            <span className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                                {attempt.examMode}
                                            </span>
                                        ) : null}
                                    </div>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-secondary">
                                        {formatDate(attempt.completedAt)}
                                    </p>
                                    <ArrowRight className="ml-auto mt-2 h-4 w-4 text-claude-secondary/60 transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-claude-accent" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </article>
            </div>
        </section>
    );
}
