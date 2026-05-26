import React, { useId, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    BarChart3,
    Flame,
    Sparkles,
    Target,
    TrendingUp,
} from 'lucide-react';

const WARN_TEXT = 'color-mix(in srgb, var(--accent-color) 75%, var(--text-color))';
const WARN_BAR = 'color-mix(in srgb, var(--botanical-forest) 55%, var(--accent-color))';

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
            return { ...attempt, x, y, score };
        });

    return {
        points,
        linePath: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
        areaPath: points.length > 0
            ? `${points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ')} L ${points.at(-1).x} ${baselineY} L ${points[0].x} ${baselineY} Z`
            : '',
    };
}

function buildTrendAriaLabel(attempts, trendDelta) {
    if (attempts.length < 2) return 'Score trend unavailable';
    const oldest = attempts.at(-1);
    const latest = attempts[0];
    const trendPhrase = trendDelta == null
        ? 'trend still forming'
        : trendDelta >= 0
            ? `up ${Math.round(trendDelta)} points recently`
            : `down ${Math.abs(Math.round(trendDelta))} points recently`;
    return `Score trend from ${formatPercent(oldest?.percentage)} on ${formatDate(oldest?.completedAt)} to ${formatPercent(latest?.percentage)} on ${formatDate(latest?.completedAt)}, ${trendPhrase}`;
}

function HubSectionHeader({ label, title, icon: Icon, badge }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-xs font-medium text-claude-secondary">{label}</p>
                {title ? (
                    <h3 className="mt-1.5 font-display text-xl font-bold italic leading-tight text-claude-text sm:text-2xl">
                        {title}
                    </h3>
                ) : null}
            </div>
            {badge || (Icon ? (
                <div
                    className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-claude-border/50 bg-claude-bg/30 text-claude-accent sm:flex"
                    aria-hidden
                >
                    <Icon className="h-4 w-4" />
                </div>
            ) : null)}
        </div>
    );
}

function MetricStrip({ summary }) {
    const metrics = [
        {
            key: 'avg',
            label: 'Avg score',
            value: formatPercent(summary.averageScore),
            detail: 'Across attempts',
            emphasized: true,
        },
        {
            key: 'attempts',
            label: 'Attempts',
            value: summary.totalAttempts,
            detail: 'Completed',
        },
        {
            key: 'best',
            label: 'Best',
            value: formatPercent(summary.bestScore),
            detail: 'Strongest run',
        },
        {
            key: 'pace',
            label: 'Avg pace',
            value: formatPace(summary.averagePaceSeconds),
            detail: 'Timed only',
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-claude-border/40 bg-claude-border/30 sm:grid-cols-4">
            {metrics.map((metric, index) => (
                <div
                    key={metric.key}
                    className={`bg-claude-bg/25 px-4 py-3.5 ${metric.emphasized ? 'col-span-2 sm:col-span-1' : ''} ${index > 0 ? 'border-t border-claude-border/30 sm:border-t-0 sm:border-l' : ''}`}
                >
                    <p className="text-[10px] font-mono uppercase tracking-wider text-claude-secondary">
                        {metric.label}
                    </p>
                    <p
                        className={`mt-1.5 font-display font-bold leading-none text-claude-text ${metric.emphasized ? 'text-[2rem] text-claude-accent' : 'text-2xl'}`}
                    >
                        {metric.value}
                    </p>
                    <p className="mt-1.5 text-xs text-claude-secondary/80">{metric.detail}</p>
                </div>
            ))}
        </div>
    );
}

function TrendBadge({ trendDelta }) {
    const label = trendDelta == null
        ? 'Trend forming'
        : `${trendDelta >= 0 ? '+' : ''}${Math.round(trendDelta)} pt trend`;

    return (
        <span className="shrink-0 rounded-full border border-claude-accent/25 bg-claude-accent/10 px-3 py-1 text-[10px] font-mono font-bold uppercase tracking-wide text-claude-accent">
            {label}
        </span>
    );
}

function ActionButton({ action, onAction, primary = false }) {
    return (
        <button
            type="button"
            onClick={() => onAction?.(action)}
            className={`tap-action inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60 ${primary ? 'border-claude-accent/40 bg-claude-accent text-botanical-ink hover:brightness-110' : 'border-claude-accent/25 bg-claude-accent/10 text-claude-accent hover:border-claude-accent/40 hover:bg-claude-accent/15'}`}
        >
            <Sparkles className="h-3.5 w-3.5 shrink-0" />
            <span>{action.label}</span>
        </button>
    );
}

function ScoreTrendChart({ recentAttempts, trendDelta, areaFillId }) {
    const trendModel = useMemo(
        () => buildTrendModel(recentAttempts),
        [recentAttempts],
    );
    const ariaLabel = buildTrendAriaLabel(recentAttempts, trendDelta);
    const oldestDate = formatDate(recentAttempts.at(-1)?.completedAt);
    const latestDate = formatDate(recentAttempts[0]?.completedAt);

    if (recentAttempts.length < 2) {
        return (
            <p className="text-sm leading-6 text-claude-secondary">
                Complete one more exam to see how your scores are moving.
            </p>
        );
    }

    return (
        <>
            <div className="mt-4 h-[100px] w-full">
                <svg
                    viewBox="0 0 320 90"
                    className="h-full w-full"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={ariaLabel}
                >
                    <line x1="0" y1="24" x2="320" y2="24" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.2" />
                    <line x1="0" y1="50" x2="320" y2="50" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.2" />
                    <line x1="0" y1="76" x2="320" y2="76" stroke="var(--border-color)" strokeWidth="0.5" opacity="0.2" />
                    <path d={trendModel.areaPath} fill={`url(#${areaFillId})`} />
                    <path
                        d={trendModel.linePath}
                        fill="none"
                        stroke="var(--accent-color)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    {trendModel.points.map((point) => (
                        <g key={point.id}>
                            <circle cx={point.x} cy={point.y} r="4" fill="var(--accent-color)" />
                            <text
                                x={point.x}
                                y={Math.max(8, point.y - 8)}
                                textAnchor="middle"
                                fill="var(--secondary-text-color)"
                                fontSize="8"
                                fontFamily="ui-monospace, monospace"
                            >
                                {Math.round(point.score)}%
                            </text>
                        </g>
                    ))}
                    <defs>
                        <linearGradient id={areaFillId} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.18" />
                            <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[10px] font-mono text-claude-secondary/80">
                <span>{oldestDate ? `Oldest · ${oldestDate}` : 'Oldest'}</span>
                <span>{latestDate ? `Latest · ${latestDate}` : 'Latest'}</span>
            </div>
        </>
    );
}

function ExamInsightsSkeleton() {
    return (
        <section
            aria-label="Loading exam insights"
            className="glass-panel rounded-[28px] p-5 sm:p-6"
            data-testid="exam-insights-hub"
        >
            <div className="mb-6 flex items-center justify-between gap-4">
                <div className="space-y-2">
                    <div className="h-3 w-24 animate-pulse rounded bg-claude-border/60" />
                    <div className="h-8 w-56 animate-pulse rounded bg-claude-border/50" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-claude-border/40 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                    <div
                        key={index}
                        className={`bg-claude-bg/20 p-4 ${index === 0 ? 'col-span-2 sm:col-span-1' : ''}`}
                    >
                        <div className="h-2.5 w-14 animate-pulse rounded bg-claude-border/50" />
                        <div className="mt-3 h-7 w-16 animate-pulse rounded bg-claude-border/60" />
                    </div>
                ))}
            </div>
            <div className="mt-6 space-y-6">
                {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="border-t border-claude-border/30 pt-6 first:border-t-0 first:pt-0">
                        <div className="h-3 w-16 animate-pulse rounded bg-claude-border/50" />
                        <div className="mt-3 h-6 w-40 animate-pulse rounded bg-claude-border/60" />
                        <div className="mt-4 space-y-2">
                            <div className="h-3 w-full animate-pulse rounded bg-claude-border/40" />
                            <div className="h-3 w-4/5 animate-pulse rounded bg-claude-border/40" />
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default function ExamAnalytics({ insights, loading, onAction }) {
    const areaFillId = useId().replace(/:/g, '');

    if (loading || !insights) {
        return <ExamInsightsSkeleton />;
    }

    const {
        summary,
        persona,
        paceTemperament,
        habits,
        weakTopics,
        recentAttempts,
        recommendedActions,
    } = insights;
    const displayTemperament = paceTemperament || persona?.paceTemperament;

    if ((summary?.totalAttempts || 0) === 0) {
        const primaryAction = recommendedActions[0];
        const secondaryActions = recommendedActions.slice(1);

        return (
            <section
                className="glass-panel rounded-[28px] p-6 sm:p-8"
                data-testid="exam-insights-hub"
            >
                <div className="mx-auto max-w-xl text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-claude-accent/20 bg-claude-accent/10 text-claude-accent">
                        <BarChart3 className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-xs font-medium text-claude-secondary">Insights Hub</p>
                    <h2 className="mt-2 font-display text-[1.75rem] font-bold italic leading-tight text-claude-text sm:text-[2rem]">
                        Learn your exam pattern
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-claude-secondary">
                        After a couple of mock exams, this hub shows your pacing, weak topics, and the habits that shape your scores.
                    </p>
                    {primaryAction ? (
                        <div className="mt-6 flex justify-center">
                            <ActionButton action={primaryAction} onAction={onAction} primary />
                        </div>
                    ) : null}
                    {secondaryActions.length > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                            {secondaryActions.map((action) => (
                                <ActionButton key={action.id} action={action} onAction={onAction} />
                            ))}
                        </div>
                    ) : null}
                </div>
            </section>
        );
    }

    return (
        <section className="space-y-6" data-testid="exam-insights-hub">
            <div className="glass-panel rounded-[28px] p-5 sm:p-6">
                <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                    <div>
                        <p className="text-xs font-medium text-claude-secondary">Insights Hub</p>
                        <h2 className="mt-1.5 font-display text-[1.65rem] font-bold italic leading-tight text-claude-text sm:text-[1.9rem]">
                            What kind of exam taker are you?
                        </h2>
                    </div>
                    <div
                        className="hidden h-10 w-10 items-center justify-center rounded-xl border border-claude-accent/20 bg-claude-accent/10 text-claude-accent sm:flex"
                        aria-hidden
                    >
                        <Sparkles className="h-4 w-4" />
                    </div>
                </div>

                <MetricStrip summary={summary} />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-claude-secondary">Persona</p>
                            <h3 className="mt-1.5 font-display text-xl font-bold italic leading-tight text-claude-text sm:text-2xl">
                                {persona.label}
                            </h3>
                        </div>
                        <TrendBadge trendDelta={summary.trendDelta} />
                    </div>

                    <p className="mt-4 max-w-prose text-sm leading-6 text-claude-secondary">
                        {persona.description}
                    </p>

                    {displayTemperament?.label ? (
                        <div
                            className="mt-4 rounded-2xl border border-claude-border/40 bg-claude-surface/40 px-4 py-3"
                            data-testid="pace-temperament-chip"
                        >
                            <p className="text-xs font-medium text-claude-secondary">
                                Pace pattern
                                {displayTemperament.confidence === 'low' ? ' (forming)' : ''}
                            </p>
                            <p className="mt-1 text-sm font-medium text-claude-text">
                                {displayTemperament.label}
                            </p>
                            {displayTemperament.description ? (
                                <p className="mt-1.5 text-xs leading-5 text-claude-secondary">
                                    {displayTemperament.description}
                                </p>
                            ) : null}
                            {displayTemperament.confidence === 'low' ? (
                                <p className="mt-2 text-xs leading-5 text-claude-secondary/90">
                                    Complete another timed attempt for a more reliable pace read.
                                </p>
                            ) : null}
                            {(displayTemperament.evidence || []).length > 0 ? (
                                <ul className="mt-2 flex flex-col gap-1 text-xs text-claude-secondary">
                                    {displayTemperament.evidence.slice(0, 2).map((item) => (
                                        <li key={item} className="flex items-center gap-2">
                                            <span className="h-1 w-1 shrink-0 rounded-full bg-claude-accent/60" aria-hidden />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </div>
                    ) : null}

                    {(persona.evidence || []).length > 0 ? (
                        <ul className="mt-4 flex flex-col gap-1.5 text-xs text-claude-secondary sm:flex-row sm:flex-wrap sm:gap-x-4">
                            {(persona.evidence || []).map((evidence) => (
                                <li key={evidence} className="flex items-center gap-2">
                                    <span className="h-1 w-1 shrink-0 rounded-full bg-claude-accent/70" aria-hidden />
                                    {evidence}
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {(persona.improvements || []).length > 0 ? (
                        <ul className="mt-5 divide-y divide-claude-border/30 border-t border-claude-border/30">
                            {(persona.improvements || []).map((improvement) => (
                                <li
                                    key={improvement}
                                    className="border-l-2 py-3 pl-3 text-sm leading-6 text-claude-text first:pt-4"
                                    style={{ borderColor: 'color-mix(in srgb, var(--accent-color) 45%, transparent)' }}
                                >
                                    {improvement}
                                </li>
                            ))}
                        </ul>
                    ) : null}

                    {recommendedActions.length > 0 ? (
                        <div className="mt-5 flex flex-wrap gap-2 border-t border-claude-border/30 pt-5">
                            {recommendedActions.map((action, index) => (
                                <ActionButton
                                    key={action.id}
                                    action={action}
                                    onAction={onAction}
                                    primary={index === 0}
                                />
                            ))}
                        </div>
                    ) : null}
                </article>

                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <HubSectionHeader label="Habits" title="Your exam rhythm" icon={Flame} />

                    <dl className="mt-5 grid grid-cols-1 gap-4 border-y border-claude-border/30 py-4 sm:grid-cols-3 sm:gap-3 sm:py-5">
                        <div>
                            <dt className="text-[10px] font-mono uppercase tracking-wider text-claude-secondary">Retry rate</dt>
                            <dd className="mt-1 font-display text-2xl font-bold leading-none text-claude-text">
                                {formatPercent((habits.retryRate || 0) * 100)}
                            </dd>
                            <dd className="mt-1 text-xs text-claude-secondary/80">Repeat attempts</dd>
                        </div>
                        <div className="sm:border-l sm:border-claude-border/30 sm:pl-4">
                            <dt className="text-[10px] font-mono uppercase tracking-wider text-claude-secondary">Strongest day</dt>
                            <dd className="mt-1 font-display text-2xl font-bold leading-none text-claude-text">
                                {habits.strongestStudyDay?.day || '--'}
                            </dd>
                            <dd className="mt-1 text-xs text-claude-secondary/80">
                                {habits.strongestStudyDay?.averageScore != null
                                    ? `${formatPercent(habits.strongestStudyDay.averageScore)} average`
                                    : 'Need more attempts'}
                            </dd>
                        </div>
                        <div className="sm:border-l sm:border-claude-border/30 sm:pl-4">
                            <dt className="text-[10px] font-mono uppercase tracking-wider text-claude-secondary">Avg duration</dt>
                            <dd className="mt-1 font-display text-2xl font-bold leading-none text-claude-text">
                                {formatMinutes(habits.averageDurationMinutes)}
                            </dd>
                            <dd className="mt-1 text-xs text-claude-secondary/80">Timed attempts</dd>
                        </div>
                    </dl>

                    <div className="pt-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-claude-accent" aria-hidden />
                            <p className="text-xs font-medium text-claude-secondary">Score trend</p>
                        </div>
                        <ScoreTrendChart
                            recentAttempts={recentAttempts}
                            trendDelta={summary.trendDelta}
                            areaFillId={areaFillId}
                        />
                    </div>
                </article>
            </div>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <HubSectionHeader label="Weak topics" title="Where to tighten up" icon={Target} />

                    {weakTopics.length > 0 ? (
                        <ul className="mt-5 divide-y divide-claude-border/30">
                            {weakTopics.map((topic) => {
                                const width = `${Math.max(6, Math.round(topic.masteryScore * 100))}%`;

                                return (
                                    <li key={topic.id} className="py-4 first:pt-0 last:pb-0">
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="text-sm font-medium text-claude-text">{topic.topic}</p>
                                            <span
                                                className="text-[10px] font-mono font-bold uppercase tracking-wide"
                                                style={{ color: WARN_TEXT }}
                                            >
                                                {formatTopicPercent(topic.masteryScore)}
                                            </span>
                                        </div>
                                        <div
                                            className="mt-3 h-2 overflow-hidden rounded-full"
                                            style={{ backgroundColor: 'color-mix(in srgb, var(--bg-color) 70%, var(--border-color))' }}
                                        >
                                            <div
                                                className="h-full rounded-full transition-[width] duration-300"
                                                style={{ width, backgroundColor: WARN_BAR }}
                                            />
                                        </div>
                                        <p className="mt-2 text-[10px] font-mono text-claude-secondary">
                                            {topic.totalCorrect}/{topic.totalSeen} correct
                                        </p>
                                    </li>
                                );
                            })}
                        </ul>
                    ) : (
                        <div className="mt-5 rounded-xl border border-dashed border-claude-border/50 bg-claude-bg/10 px-5 py-8 text-center">
                            <p className="font-display text-lg italic text-claude-text">No weak topics surfaced yet.</p>
                            <p className="mt-2 text-xs text-claude-secondary">
                                Linked-class attempts will start filling this in.
                            </p>
                        </div>
                    )}
                </article>

                <article className="glass-panel rounded-[28px] p-5 sm:p-6">
                    <HubSectionHeader label="Recent attempts" title="Latest exam runs" icon={BarChart3} />

                    <ul className="mt-5 divide-y divide-claude-border/30">
                        {recentAttempts.map((attempt) => (
                            <li key={attempt.id}>
                                <Link
                                    to={`/exam/${attempt.examId}`}
                                    className="tap-action group -mx-1 flex min-h-[72px] items-center gap-3 rounded-xl px-1 py-3 transition-[color,background-color,border-color] duration-200 hover:bg-claude-bg/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                >
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-claude-accent/20 bg-claude-accent/10">
                                        <span className="font-display text-base font-bold text-claude-accent">
                                            {attempt.percentage != null ? `${attempt.percentage}%` : '--'}
                                        </span>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate font-serif text-sm font-bold italic text-claude-text transition-colors group-hover:text-claude-accent">
                                            {attempt.title}
                                        </p>
                                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                            <span className="text-[10px] font-mono uppercase tracking-wide text-claude-secondary">
                                                {attempt.score}/{attempt.total} correct
                                            </span>
                                            {attempt.durationSeconds ? (
                                                <span className="text-[10px] font-mono uppercase tracking-wide text-claude-secondary">
                                                    {formatPace(attempt.durationSeconds / Math.max(attempt.total || 1, 1))}
                                                </span>
                                            ) : null}
                                            {attempt.examMode && attempt.examMode !== 'standard' ? (
                                                <span className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-2 py-0.5 text-[9px] font-mono uppercase tracking-wide text-claude-accent">
                                                    {attempt.examMode}
                                                </span>
                                            ) : null}
                                        </div>
                                    </div>
                                    <div className="shrink-0 text-right">
                                        <p className="text-[10px] font-mono text-claude-secondary">
                                            {formatDate(attempt.completedAt)}
                                        </p>
                                        <ArrowRight
                                            className="ml-auto mt-1.5 h-4 w-4 text-claude-secondary/50 transition-[color,transform] duration-200 group-hover:translate-x-0.5 group-hover:text-claude-accent"
                                            aria-hidden
                                        />
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </article>
            </div>
        </section>
    );
}
