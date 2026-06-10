import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle2 from 'lucide-react/dist/esm/icons/check-circle-2';
import Inbox from 'lucide-react/dist/esm/icons/inbox';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw';
import Send from 'lucide-react/dist/esm/icons/send';
import Star from 'lucide-react/dist/esm/icons/star';
import Trash2 from 'lucide-react/dist/esm/icons/trash-2';

const FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'open', label: 'Open' },
    { id: 'starred', label: 'Starred' },
    { id: 'acknowledged', label: 'Acknowledged' },
];

const formatSubmittedAt = (value) => {
    if (!value) return 'Unknown date';
    return new Date(value).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

function EmptyState({ title, detail, icon: Icon = Inbox, tone = 'neutral', action }) {
    const iconClass = tone === 'error' ? 'text-red-400' : 'text-claude-secondary/70';

    return (
        <div className={`glass-panel-premium relative overflow-hidden rounded-[1.75rem] px-6 py-16 text-center ${tone === 'error' ? 'border-red-500/25' : 'border-dashed border-white/10'}`}>
            <div className="relative z-10">
                <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border bg-claude-bg/45 ${tone === 'error' ? 'border-red-500/25' : 'border-white/10'}`}>
                    <Icon className={`h-6 w-6 ${iconClass}`} />
                </div>
                <p className={`text-[11px] font-mono uppercase tracking-[0.2em] ${tone === 'error' ? 'text-red-400' : 'text-claude-secondary/80'}`}>
                    {title}
                </p>
                {detail && (
                    <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-claude-secondary/80">
                        {detail}
                    </p>
                )}
                {action}
            </div>
        </div>
    );
}

export default function FeedbackTab({
    feedback = [],
    loadError = null,
    onRetry,
    onToggleFavorite,
    onDelete,
    onThank,
    haptics,
}) {
    const [filter, setFilter] = useState('all');

    const counts = useMemo(() => feedback.reduce((acc, entry) => {
        acc.all += 1;
        if (!entry.consideringNotifiedAt) acc.open += 1;
        if (entry.isFavorited) acc.starred += 1;
        if (entry.consideringNotifiedAt) acc.acknowledged += 1;
        return acc;
    }, { all: 0, open: 0, starred: 0, acknowledged: 0 }), [feedback]);

    const filteredFeedback = useMemo(() => {
        if (filter === 'open') {
            return feedback.filter((entry) => !entry.consideringNotifiedAt);
        }
        if (filter === 'starred') {
            return feedback.filter((entry) => entry.isFavorited);
        }
        if (filter === 'acknowledged') {
            return feedback.filter((entry) => entry.consideringNotifiedAt);
        }
        return feedback;
    }, [feedback, filter]);

    if (loadError) {
        return (
            <EmptyState
                title="Could not load feedback"
                detail={loadError}
                icon={AlertCircle}
                tone="error"
                action={onRetry && (
                    <button
                        type="button"
                        onClick={() => {
                            haptics?.light();
                            onRetry();
                        }}
                        className="tap-action mt-6 inline-flex items-center justify-center gap-2 rounded-[1rem] border border-claude-border/70 bg-claude-bg/55 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-text transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Retry
                    </button>
                )}
            />
        );
    }

    if (feedback.length === 0) {
        return (
            <EmptyState
                title="No feedback yet"
                detail="User suggestions will appear here for owner review."
                icon={Inbox}
            />
        );
    }

    return (
        <div className="space-y-5">
            <section className="glass-panel-premium rounded-[1.6rem] p-4">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary">
                            <MessageSquare className="h-3.5 w-3.5 text-claude-accent" />
                            Feedback inbox
                        </p>
                        <p className="mt-1 text-sm text-claude-secondary">
                            Star the signal, thank users, and keep owner review tidy.
                        </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {FILTERS.map((item) => {
                            const active = filter === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    aria-pressed={active}
                                    onClick={() => {
                                        haptics?.light();
                                        setFilter(item.id);
                                    }}
                                    className={`tap-action inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] ${
                                        active
                                            ? 'bg-claude-accent text-botanical-ink shadow-botanical-glow'
                                            : 'border border-white/10 bg-claude-bg/35 text-claude-secondary hover:text-claude-text'
                                    }`}
                                >
                                    {item.label}
                                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${active ? 'bg-botanical-ink/15' : 'bg-white/5'}`}>
                                        {counts[item.id] || 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            {filteredFeedback.length === 0 ? (
                <EmptyState
                    title="No feedback matches this view"
                    detail="Switch filters to see more submissions."
                    icon={CheckCircle2}
                />
            ) : (
                <div className="space-y-3">
                    {filteredFeedback.map((entry, index) => {
                        const isThanked = Boolean(entry.consideringNotifiedAt);

                        return (
                            <motion.article
                                key={entry.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.035, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                                className="glass-panel-premium relative overflow-hidden rounded-[1.75rem] p-5 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 sm:p-6"
                            >
                                <div className="relative z-10">
                                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-claude-bg/45 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary/85">
                                                    <MessageSquare className="h-3.5 w-3.5" />
                                                    {entry.username}
                                                </span>
                                                {entry.isFavorited && (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-amber-400">
                                                        <Star className="h-3 w-3" />
                                                        Favorited
                                                    </span>
                                                )}
                                                {isThanked && (
                                                    <span className="rounded-full border border-claude-accent/20 bg-claude-accent/10 px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">
                                                        Considering
                                                    </span>
                                                )}
                                            </div>

                                            <p className="mt-3 text-[11px] font-mono uppercase tracking-[0.16em] text-claude-secondary/70">
                                                Submitted {formatSubmittedAt(entry.createdAt)}
                                            </p>
                                            <p className="mt-4 text-sm leading-relaxed text-claude-text sm:text-[15px]">
                                                {entry.content}
                                            </p>

                                            {isThanked && (
                                                <p className="mt-4 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary/70">
                                                    Thank-you sent {formatSubmittedAt(entry.consideringNotifiedAt)}
                                                    {entry.consideringByName ? ` by ${entry.consideringByName}` : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-5 flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                haptics?.light();
                                                onToggleFavorite(entry.id, !entry.isFavorited);
                                            }}
                                            className={`tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[1rem] border px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] ${
                                                entry.isFavorited
                                                    ? 'border-amber-500/25 bg-amber-500/10 text-amber-400'
                                                    : 'border-white/10 bg-claude-bg/45 text-claude-secondary hover:text-claude-text'
                                            }`}
                                        >
                                            <Star className="h-4 w-4" />
                                            {entry.isFavorited ? 'Unfavorite' : 'Favorite'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                haptics?.light();
                                                onThank(entry.id);
                                            }}
                                            disabled={isThanked}
                                            className="tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[1rem] border border-claude-accent/20 bg-claude-accent/10 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-45"
                                        >
                                            <Send className="h-4 w-4" />
                                            {isThanked ? 'Thanked' : 'Thank user'}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                haptics?.medium();
                                                onDelete(entry.id);
                                            }}
                                            className="tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[1rem] border border-red-500/20 bg-red-500/10 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-red-400 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </motion.article>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
