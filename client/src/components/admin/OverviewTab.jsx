import React from 'react';
import { motion } from 'motion/react';
import {
    Activity,
    ArrowUp,
    BookOpen,
    CheckCircle2,
    Feather,
    Layers,
    Megaphone,
    MessageSquare,
    ShieldAlert,
    TrendingUp,
    UserCircle,
    Users,
} from 'lucide-react';

const ACTIVITY_CHART_WIDTH = 640;
const ACTIVITY_CHART_HEIGHT = 192;
const ACTIVITY_CHART_PADDING_X = 12;
const ACTIVITY_CHART_PADDING_TOP = 14;
const ACTIVITY_CHART_PADDING_BOTTOM = 20;

const formatNumber = (value) => Number(value || 0).toLocaleString();

function SectionHeading({ icon: Icon, title, detail }) {
    return (
        <div className="mb-4 flex flex-col gap-1 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.26em] text-claude-secondary">
                    <Icon className="h-3.5 w-3.5 text-claude-accent" /> {title}
                </h2>
                {detail && (
                    <p className="mt-1 text-xs text-claude-secondary/75">
                        {detail}
                    </p>
                )}
            </div>
        </div>
    );
}

function StatTile({ label, value, icon: Icon, trend, detail, tone = 'neutral' }) {
    const toneClass = tone === 'accent'
        ? 'text-claude-accent'
        : tone === 'good'
            ? 'text-botanical-forest'
            : 'text-claude-text';

    return (
        <div className="glass-panel-premium overflow-hidden rounded-[1.45rem] p-4">
            <div className="relative z-10 flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-[9px] font-mono font-bold uppercase tracking-[0.23em] text-claude-secondary">
                        {label}
                    </p>
                    <p className={`mt-2 font-mono text-2xl font-bold tracking-tight sm:text-3xl ${toneClass}`}>
                        {formatNumber(value)}
                    </p>
                    {detail && (
                        <p className="mt-1 text-[11px] leading-relaxed text-claude-secondary/80">
                            {detail}
                        </p>
                    )}
                </div>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45">
                    <Icon className="h-4 w-4 text-claude-accent" />
                </div>
            </div>
            {trend > 0 && (
                <div className="relative z-10 mt-4 inline-flex items-center gap-1.5 rounded-full border border-botanical-forest/25 bg-botanical-forest/10 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-botanical-forest">
                    <ArrowUp className="h-3 w-3" />
                    {formatNumber(trend)} new
                </div>
            )}
        </div>
    );
}

function buildActivityChartModel(data = []) {
    const baselineY = ACTIVITY_CHART_HEIGHT - ACTIVITY_CHART_PADDING_BOTTOM;
    const usableHeight = baselineY - ACTIVITY_CHART_PADDING_TOP;
    const innerWidth = ACTIVITY_CHART_WIDTH - ACTIVITY_CHART_PADDING_X * 2;
    const peakCount = Math.max(...data.map((entry) => Number(entry.count) || 0), 0);
    const flatlineY = ACTIVITY_CHART_PADDING_TOP + usableHeight * 0.58;

    const points = data.map((entry, index) => {
        const count = Number(entry.count) || 0;
        const x = data.length <= 1
            ? ACTIVITY_CHART_WIDTH / 2
            : ACTIVITY_CHART_PADDING_X + (innerWidth / (data.length - 1)) * index;
        const y = peakCount > 0
            ? baselineY - (count / peakCount) * usableHeight
            : flatlineY;

        return {
            ...entry,
            count,
            x,
            y,
        };
    });

    const linePath = points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
        .join(' ');

    const areaPath = points.length > 0
        ? `${linePath} L ${points[points.length - 1].x} ${baselineY} L ${points[0].x} ${baselineY} Z`
        : '';

    return {
        baselineY,
        peakCount,
        points,
        linePath,
        areaPath,
    };
}

function ActivityChart({ data }) {
    if (!data || !data.length) return null;

    const areaGradientId = 'admin-activity-area-gradient';
    const strokeGradientId = 'admin-activity-stroke-gradient';
    const chartModel = buildActivityChartModel(data);

    const labelIndices = new Set([0, data.length - 1]);
    const seg = Math.floor((data.length - 1) / 4);
    for (let i = 1; i <= 3; i++) labelIndices.add(Math.min(i * seg, data.length - 1));
    const sortedLabels = [...labelIndices].sort((a, b) => a - b);

    return (
        <div className="flex h-full w-full select-none flex-col">
            <div className="relative flex-1 overflow-hidden">
                <svg
                    viewBox={`0 0 ${ACTIVITY_CHART_WIDTH} ${ACTIVITY_CHART_HEIGHT}`}
                    className="h-full w-full overflow-visible"
                    role="img"
                    aria-label="30-day signup activity line chart"
                    data-testid="admin-activity-line-chart"
                >
                    <defs>
                        <linearGradient id={areaGradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent-color)" stopOpacity="0.28" />
                            <stop offset="100%" stopColor="var(--accent-color)" stopOpacity="0.04" />
                        </linearGradient>
                        <linearGradient id={strokeGradientId} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="rgba(222,185,106,0.75)" />
                            <stop offset="45%" stopColor="var(--accent-color)" />
                            <stop offset="100%" stopColor="rgba(122,158,114,0.86)" />
                        </linearGradient>
                    </defs>

                    {[0, 1, 2, 3, 4].map((index) => {
                        const y = ACTIVITY_CHART_PADDING_TOP + (
                            ((ACTIVITY_CHART_HEIGHT - ACTIVITY_CHART_PADDING_BOTTOM - ACTIVITY_CHART_PADDING_TOP) / 4) * index
                        );
                        return (
                            <line
                                key={index}
                                x1={ACTIVITY_CHART_PADDING_X}
                                y1={y}
                                x2={ACTIVITY_CHART_WIDTH - ACTIVITY_CHART_PADDING_X}
                                y2={y}
                                stroke="rgba(255,255,255,0.06)"
                                strokeWidth="1"
                            />
                        );
                    })}

                    <line
                        x1={ACTIVITY_CHART_PADDING_X}
                        y1={chartModel.baselineY}
                        x2={ACTIVITY_CHART_WIDTH - ACTIVITY_CHART_PADDING_X}
                        y2={chartModel.baselineY}
                        stroke="rgba(255,255,255,0.1)"
                        strokeWidth="1"
                    />

                    {chartModel.areaPath ? (
                        <motion.path
                            d={chartModel.areaPath}
                            fill={`url(#${areaGradientId})`}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                        />
                    ) : null}

                    {chartModel.linePath ? (
                        <>
                            <motion.path
                                d={chartModel.linePath}
                                fill="none"
                                stroke={`url(#${strokeGradientId})`}
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0, opacity: 0.45 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                            />
                            <motion.path
                                d={chartModel.linePath}
                                fill="none"
                                stroke="rgba(222,185,106,0.22)"
                                strokeWidth="8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 1 }}
                                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                            />
                        </>
                    ) : null}

                    {chartModel.points.map((point, index) => (
                        <motion.circle
                            key={`${point.date}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={point.count > 0 ? 4.25 : 3.5}
                            fill="var(--accent-color)"
                            stroke="rgba(17, 17, 17, 0.78)"
                            strokeWidth="1.5"
                            data-testid="admin-activity-line-point"
                            initial={{ opacity: 0, scale: 0.75 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + index * 0.012, duration: 0.24 }}
                        />
                    ))}
                </svg>
            </div>

            <div className="relative mt-2 h-4 shrink-0">
                {sortedLabels.map((idx) => {
                    const d = data[idx];
                    if (!d) return null;
                    const date = new Date(`${d.date}T00:00:00`);
                    const label = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
                    const leftPct = data.length <= 1 ? 50 : (idx / (data.length - 1)) * 100;
                    const isFirst = idx === 0;
                    const isLast = idx === data.length - 1;
                    return (
                        <span
                            key={idx}
                            className="absolute whitespace-nowrap text-[9px] font-mono uppercase tracking-wider text-claude-secondary/70"
                            style={{
                                left: `${leftPct}%`,
                                transform: isFirst ? 'none' : isLast ? 'translateX(-100%)' : 'translateX(-50%)',
                            }}
                        >
                            {label}
                        </span>
                    );
                })}
            </div>
        </div>
    );
}

function AttentionRow({ icon: Icon, label, value, detail, tone = 'neutral' }) {
    const toneClass = tone === 'warning'
        ? 'text-amber-300 border-amber-500/25 bg-amber-500/10'
        : tone === 'danger'
            ? 'text-red-300 border-red-500/25 bg-red-500/10'
            : 'text-botanical-forest border-botanical-forest/25 bg-botanical-forest/10';

    return (
        <div className="flex items-center justify-between gap-4 rounded-[1.15rem] border border-white/10 bg-claude-bg/35 px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${toneClass}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-claude-text">{label}</p>
                    <p className="mt-0.5 truncate text-[11px] text-claude-secondary">{detail}</p>
                </div>
            </div>
            <p className="shrink-0 font-mono text-xl font-bold text-claude-text">{value}</p>
        </div>
    );
}

export default function OverviewTab({
    stats,
    reports = [],
    messages = [],
    feedback = [],
    feedbackLoadError = null,
    isOwner = false,
}) {
    if (!stats) return null;

    const pendingReports = reports.filter((report) => report.status === 'pending').length;
    const activeMessages = messages.filter((message) => message.isActive).length;
    const openFeedback = feedback.filter((entry) => !entry.consideringNotifiedAt).length;
    const recentSessions = Number(stats.recentSessions || 0);
    const topDecks = stats.topDecks || [];

    return (
        <div className="space-y-8">
            <section>
                <SectionHeading
                    icon={Activity}
                    title="Platform Health"
                    detail="Core system totals and the fastest signals to scan first."
                />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <StatTile label="Total Users" value={stats.users} icon={Users} trend={stats.recentSignups} tone="accent" />
                    <StatTile label="Decks" value={stats.decks} icon={Layers} detail={`${formatNumber(stats.sharedDecks)} shared`} />
                    <StatTile label="Cards" value={stats.cards} icon={BookOpen} />
                    <StatTile label="30-Day Sessions" value={recentSessions} icon={Feather} trend={Math.floor(recentSessions * 0.1)} tone="good" />
                </div>
            </section>

            <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                <div>
                    <SectionHeading icon={Activity} title="30-Day Activity" />
                    <div className="glass-panel-premium overflow-hidden rounded-[1.75rem] p-5">
                        <div className="relative z-10 mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-claude-text">New user signups over time</p>
                                <p className="mt-1 text-xs text-claude-secondary">
                                    Daily signup rhythm across the latest 30-day window.
                                </p>
                            </div>
                            <div className="inline-flex w-fit items-center rounded-xl border border-claude-accent/20 bg-claude-accent/10 px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                {formatNumber(stats.recentSignups)} total
                            </div>
                        </div>

                        <div className="relative z-10 h-48 w-full">
                            <ActivityChart data={stats.dailyUsers || []} />
                        </div>
                    </div>
                </div>

                <div>
                    <SectionHeading icon={ShieldAlert} title="Needs Attention" />
                    <div className="glass-panel-premium space-y-3 rounded-[1.75rem] p-4">
                        <AttentionRow
                            icon={ShieldAlert}
                            label="Pending reports"
                            value={pendingReports}
                            detail={pendingReports > 0 ? 'Moderation queue needs review' : 'Moderation queue is clear'}
                            tone={pendingReports > 0 ? 'warning' : 'good'}
                        />
                        <AttentionRow
                            icon={Megaphone}
                            label="Live broadcasts"
                            value={activeMessages}
                            detail={activeMessages > 0 ? 'Visible to users now' : 'No active system messages'}
                        />
                        <AttentionRow
                            icon={MessageSquare}
                            label={isOwner ? 'Open feedback' : 'Feedback'}
                            value={isOwner ? (feedbackLoadError ? '!' : openFeedback) : '-'}
                            detail={isOwner
                                ? (feedbackLoadError ? 'Owner inbox did not load' : 'Unacknowledged submissions')
                                : 'Owner-only inbox'}
                            tone={feedbackLoadError ? 'danger' : openFeedback > 0 ? 'warning' : 'good'}
                        />
                    </div>
                </div>
            </section>

            <section>
                <SectionHeading
                    icon={TrendingUp}
                    title="Trending Decks"
                    detail="Most studied decks in the current 30-day activity window."
                />
                <div className="grid gap-3 lg:grid-cols-2">
                    {topDecks.map((deck, index) => (
                        <div
                            key={deck.id ?? (deck.title || index)}
                            className="glass-panel-premium overflow-hidden rounded-[1.45rem] p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:-translate-y-0.5"
                        >
                            <div className="relative z-10 flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45 text-[10px] font-mono font-bold uppercase tracking-widest text-claude-secondary">
                                    {index + 1}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <h4 className="truncate text-sm font-serif italic text-claude-text">{deck.title}</h4>
                                    <p className="mt-1 flex items-center gap-1 truncate text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                        <UserCircle className="h-3 w-3" /> {deck.creator}
                                    </p>
                                </div>
                                <div className="shrink-0 text-right">
                                    <p className="font-mono text-xl font-bold tracking-tight text-claude-accent">{formatNumber(deck.sessions)}</p>
                                    <p className="text-[8px] font-mono uppercase tracking-widest text-claude-secondary">Plays</p>
                                </div>
                            </div>
                        </div>
                    ))}
                    {topDecks.length === 0 && (
                        <div className="glass-panel-premium rounded-[1.75rem] border-dashed border-white/10 px-6 py-12 text-center lg:col-span-2">
                            <div className="relative z-10">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45">
                                    <CheckCircle2 className="h-6 w-6 text-claude-secondary" />
                                </div>
                                <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-secondary">
                                    No deck activity in the last 30 days
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
