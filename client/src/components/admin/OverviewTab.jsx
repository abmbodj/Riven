import React from 'react';
import { motion } from 'motion/react';
import {
    Users, Layers, BookOpen, Feather, Activity,
    TrendingUp, UserCircle, ArrowUp
} from 'lucide-react';

function SectionHeading({ icon: Icon, title }) {
    return (
        <div className="mb-4 flex items-center justify-between px-1">
            <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.3em] text-[color-mix(in_srgb,var(--secondary-text-color)_60%,transparent)]">
                <Icon className="h-3.5 w-3.5" /> {title}
            </h2>
        </div>
    );
}

function StatTile({ label, value, icon: Icon, trend }) {
    return (
        <div className="glass-panel rounded-2xl border border-claude-border p-3 sm:p-4 relative overflow-hidden group">
            <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full bg-claude-accent/5 blur-2xl pointer-events-none group-hover:bg-claude-accent/10 transition-colors duration-500" />
            <div className="relative z-10 flex items-start justify-between mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-claude-bg/50 border border-claude-border">
                    <Icon className="w-3.5 h-3.5 text-claude-accent" />
                </div>
                {trend > 0 && (
                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-botanical-forest/15 text-botanical-forest font-mono">
                        <ArrowUp className="w-2.5 h-2.5" />
                        {trend}
                    </div>
                )}
            </div>
            <p className="font-mono text-xl font-bold tracking-tight sm:text-2xl text-claude-text">
                {value?.toLocaleString() || 0}
            </p>
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.25em] text-claude-secondary">{label}</p>
        </div>
    );
}

function ActivityChart({ data }) {
    if (!data || !data.length) return null;

    const rawMax = Math.max(...data.map(d => d.count), 1);

    const labelIndices = new Set([0, data.length - 1]);
    const seg = Math.floor((data.length - 1) / 4);
    for (let i = 1; i <= 3; i++) labelIndices.add(Math.min(i * seg, data.length - 1));
    const sortedLabels = [...labelIndices].sort((a, b) => a - b);

    return (
        <div className="w-full h-full flex flex-col select-none">
            <div className="relative flex-1 flex items-end gap-[2px] overflow-hidden">
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none">
                    {[0, 1, 2, 3, 4].map(i => (
                        <div key={i} className="w-full h-px bg-white/[0.06]" />
                    ))}
                </div>

                {data.map((d, i) => {
                    const pct = d.count > 0 ? (d.count / rawMax) * 100 : 0;
                    return (
                        <div key={i} className="relative flex-1 h-full flex items-end">
                            <motion.div
                                className="w-full rounded-t-[3px]"
                                style={{
                                    background: d.count > 0
                                        ? 'linear-gradient(to bottom, var(--accent-color) 0%, rgba(222,185,106,0.25) 100%)'
                                        : 'rgba(255,255,255,0.04)',
                                    minHeight: '1px',
                                }}
                                initial={{ height: 0 }}
                                animate={{ height: d.count > 0 ? `${pct}%` : '1px' }}
                                transition={{ delay: i * 0.018, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
                            />
                        </div>
                    );
                })}
            </div>

            <div className="relative h-4 mt-2 shrink-0">
                {sortedLabels.map((idx) => {
                    const d = data[idx];
                    if (!d) return null;
                    const date = new Date(d.date + 'T00:00:00');
                    const label = `${date.toLocaleString('default', { month: 'short' })} ${date.getDate()}`;
                    const leftPct = (idx / (data.length - 1)) * 100;
                    const isFirst = idx === 0;
                    const isLast = idx === data.length - 1;
                    return (
                        <span
                            key={idx}
                            className="absolute text-[9px] font-mono text-claude-secondary/70 tracking-wider uppercase whitespace-nowrap"
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

export default function OverviewTab({ stats }) {
    if (!stats) return null;

    return (
        <div className="space-y-8">
            {/* Stats Grid */}
            <div>
                <SectionHeading icon={Activity} title="Platform Metrics" />
                <div className="grid grid-cols-2 gap-3">
                    <StatTile label="Total Users" value={stats.users} icon={Users} trend={stats.recentSignups} />
                    <StatTile label="Total Decks" value={stats.decks} icon={Layers} />
                    <StatTile label="Total Cards" value={stats.cards} icon={BookOpen} />
                    <StatTile label="30-Day Sessions" value={stats.recentSessions} icon={Feather} trend={Math.floor(stats.recentSessions * 0.1)} />
                </div>
            </div>

            {/* Activity Chart */}
            <div>
                <SectionHeading icon={Activity} title="30-Day Activity" />
                <div className="p-5 rounded-2xl glass-panel border border-claude-border relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 rounded-full pointer-events-none"
                        style={{ background: 'radial-gradient(circle, rgba(222,185,106,0.06) 0%, transparent 70%)' }} />
                    <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />

                    <div className="flex items-center justify-between mb-6 relative z-10">
                        <p className="text-xs text-claude-secondary">New user signups over time</p>
                        <div className="px-2.5 py-1 rounded-lg bg-claude-accent/10 border border-claude-accent/20 text-claude-accent text-[9px] font-bold font-mono tracking-widest uppercase">
                            {stats.recentSignups?.toLocaleString() || 0} Total
                        </div>
                    </div>

                    <div className="h-48 w-full relative z-10">
                        <ActivityChart data={stats.dailyUsers || []} />
                    </div>
                </div>
            </div>

            {/* Trending Decks */}
            <div>
                <SectionHeading icon={TrendingUp} title="Trending Decks" />
                <div className="space-y-2">
                    {stats.topDecks?.map((deck, i) => (
                        <div
                            key={deck.id ?? (deck.title || i)}
                            className="flex items-center gap-3 p-3.5 rounded-2xl glass-panel border border-claude-border transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-claude-accent/30"
                        >
                            <div className="w-9 h-9 rounded-xl bg-claude-bg/60 border border-claude-border flex items-center justify-center text-[10px] font-mono font-bold text-claude-secondary uppercase tracking-widest">
                                {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="text-sm font-serif italic text-claude-text truncate">{deck.title}</h4>
                                <p className="text-[10px] text-claude-secondary truncate flex items-center gap-1 mt-0.5 font-mono uppercase tracking-wider">
                                    <UserCircle className="w-3 h-3" /> {deck.creator}
                                </p>
                            </div>
                            <div className="text-right pl-3 border-l border-claude-border/50">
                                <p className="font-mono text-lg font-bold tracking-tight text-claude-accent">{deck.sessions}</p>
                                <p className="text-[8px] font-mono text-claude-secondary uppercase tracking-widest">Plays</p>
                            </div>
                        </div>
                    ))}
                    {(!stats.topDecks || stats.topDecks.length === 0) && (
                        <div className="relative overflow-hidden text-center py-12 px-6 glass-panel border-dashed border-claude-border/60 rounded-2xl">
                            <div className="absolute inset-0 bg-gradient-to-b from-claude-bg/20 to-claude-bg/60 pointer-events-none" />
                            <div className="relative z-10">
                                <TrendingUp className="w-8 h-8 text-claude-border mx-auto mb-3" />
                                <p className="text-claude-secondary text-[11px] font-mono uppercase tracking-widest">
                                    No deck activity in the last 30 days
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
