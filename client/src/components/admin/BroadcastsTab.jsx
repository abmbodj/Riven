import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    CalendarClock,
    CheckCircle2,
    Megaphone,
    Plus,
    Power,
    Send,
    UserRound,
    X,
} from 'lucide-react';

const MSG_TYPE_COLORS = {
    info: { bg: 'bg-botanical-sepia/15', text: 'text-botanical-sepia', dot: 'bg-botanical-sepia', border: 'border-botanical-sepia/25' },
    success: { bg: 'bg-botanical-forest/15', text: 'text-botanical-forest', dot: 'bg-botanical-forest', border: 'border-botanical-forest/25' },
    warning: { bg: 'bg-claude-accent/15', text: 'text-claude-accent', dot: 'bg-claude-accent', border: 'border-claude-accent/25' },
    error: { bg: 'bg-red-500/15', text: 'text-red-400', dot: 'bg-red-400', border: 'border-red-500/25' },
};

const STATUS_FILTERS = [
    { id: 'all', label: 'All' },
    { id: 'live', label: 'Live' },
    { id: 'paused', label: 'Paused' },
    { id: 'expired', label: 'Expired' },
];

const isExpiredMessage = (message) => (
    message.expiresAt && new Date(message.expiresAt).getTime() < Date.now()
);

const getMessageStatus = (message) => {
    if (isExpiredMessage(message)) return 'expired';
    return message.isActive ? 'live' : 'paused';
};

const formatDate = (value) => {
    if (!value) return 'No date';
    return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

function StatusPill({ status }) {
    const className = status === 'live'
        ? 'border-botanical-forest/25 bg-botanical-forest/10 text-botanical-forest'
        : status === 'expired'
            ? 'border-amber-500/25 bg-amber-500/10 text-amber-300'
            : 'border-white/10 bg-claude-bg/35 text-claude-secondary';

    return (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${className}`}>
            {status}
        </span>
    );
}

export default function BroadcastsTab({
    messages,
    form,
    setForm,
    showForm,
    setShowForm,
    onSubmit,
    onToggle,
    onDelete,
    loading,
    haptics,
}) {
    const [filter, setFilter] = useState('all');

    const counts = useMemo(() => messages.reduce((acc, message) => {
        const status = getMessageStatus(message);
        acc.all += 1;
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, { all: 0, live: 0, paused: 0, expired: 0 }), [messages]);

    const filteredMessages = useMemo(() => (
        filter === 'all'
            ? messages
            : messages.filter((message) => getMessageStatus(message) === filter)
    ), [filter, messages]);

    return (
        <div className="space-y-5">
            <section className="glass-panel-premium rounded-[1.6rem] p-4">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary">
                            <Megaphone className="h-3.5 w-3.5 text-claude-accent" />
                            Broadcast center
                        </p>
                        <p className="mt-1 text-sm text-claude-secondary">
                            Compose and control system-wide messages from one queue.
                        </p>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar">
                            {STATUS_FILTERS.map((status) => {
                                const active = filter === status.id;
                                return (
                                    <button
                                        key={status.id}
                                        type="button"
                                        aria-pressed={active}
                                        onClick={() => {
                                            haptics?.light();
                                            setFilter(status.id);
                                        }}
                                        className={`tap-action inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] ${
                                            active
                                                ? 'bg-claude-accent text-botanical-ink shadow-botanical-glow'
                                                : 'border border-white/10 bg-claude-bg/35 text-claude-secondary hover:text-claude-text'
                                        }`}
                                    >
                                        {status.label}
                                        <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${active ? 'bg-botanical-ink/15' : 'bg-white/5'}`}>
                                            {counts[status.id] || 0}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        {!showForm && (
                            <button
                                type="button"
                                onClick={() => {
                                    haptics?.light();
                                    setShowForm(true);
                                }}
                                className="tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-claude-accent/20 bg-claude-accent/12 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:bg-claude-accent/18 active:scale-[0.97]"
                            >
                                <Plus className="h-4 w-4" />
                                New Broadcast
                            </button>
                        )}
                    </div>
                </div>
            </section>

            <AnimatePresence>
                {showForm && (
                    <motion.form
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className="glass-panel-premium overflow-hidden rounded-[1.75rem]"
                        onSubmit={onSubmit}
                    >
                        <div className="relative z-10 border-b border-white/10 p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <h3 className="text-lg font-serif italic text-claude-text">Compose Broadcast</h3>
                                    <p className="mt-1 text-xs text-claude-secondary">
                                        Keep messages short, clear, and tied to the user-facing moment.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="tap-action rounded-xl border border-white/10 bg-claude-bg/35 p-2 text-claude-secondary transition-colors hover:text-claude-text"
                                    aria-label="Close form"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div className="relative z-10 space-y-4 p-4 sm:p-5">
                            <div>
                                <label className="mb-2.5 block text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-claude-secondary">
                                    Type
                                </label>
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                    {['info', 'success', 'warning', 'error'].map(type => {
                                        const isSelected = form.type === type;
                                        const colors = MSG_TYPE_COLORS[type];
                                        return (
                                            <button
                                                key={type}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setForm({ ...form, type })}
                                                className={`tap-action min-h-[42px] rounded-xl border px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-[0.16em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] ${isSelected
                                                    ? `${colors.bg} ${colors.text} ${colors.border}`
                                                    : 'border-white/10 bg-claude-bg/35 text-claude-secondary hover:text-claude-text'
                                                }`}
                                            >
                                                {type}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                                <div>
                                    <label htmlFor="broadcast-title" className="mb-2 block text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-claude-secondary">
                                        Title
                                    </label>
                                    <input
                                        id="broadcast-title"
                                        type="text"
                                        placeholder="Short user-facing title"
                                        value={form.title}
                                        onChange={e => setForm({ ...form, title: e.target.value })}
                                        className="min-h-[48px] w-full rounded-xl border border-white/10 bg-claude-bg/45 px-4 py-3 text-sm text-claude-text placeholder-claude-secondary/40 transition-colors focus:outline-none focus:border-claude-accent/50 focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="broadcast-content" className="mb-2 block text-[9px] font-mono font-bold uppercase tracking-[0.25em] text-claude-secondary">
                                        Content
                                    </label>
                                    <textarea
                                        id="broadcast-content"
                                        placeholder="Message content..."
                                        rows={4}
                                        value={form.content}
                                        onChange={e => setForm({ ...form, content: e.target.value })}
                                        className="w-full resize-none rounded-xl border border-white/10 bg-claude-bg/45 px-4 py-3 text-sm text-claude-text placeholder-claude-secondary/40 transition-colors focus:outline-none focus:border-claude-accent/50 focus-visible:ring-2 focus-visible:ring-claude-accent/60"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="tap-action inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-claude-accent px-4 py-3 text-sm font-bold text-botanical-ink shadow-botanical-glow transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.98] disabled:opacity-50"
                            >
                                {loading ? (
                                    <span className="h-4 w-4 rounded-full border-2 border-botanical-ink/30 border-t-botanical-ink animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                                Send Broadcast
                            </button>
                        </div>
                    </motion.form>
                )}
            </AnimatePresence>

            <section className="space-y-3">
                {filteredMessages.length === 0 ? (
                    <div className="glass-panel-premium rounded-[1.75rem] border-dashed border-white/10 px-6 py-16 text-center">
                        <div className="relative z-10">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45">
                                <CheckCircle2 className="h-6 w-6 text-claude-secondary" />
                            </div>
                            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-secondary">
                                No broadcasts found
                            </p>
                            <p className="mx-auto mt-2 max-w-sm text-sm text-claude-secondary/75">
                                Create a broadcast when Riven needs to speak to everyone at once.
                            </p>
                        </div>
                    </div>
                ) : (
                    filteredMessages.map((message, index) => {
                        const colors = MSG_TYPE_COLORS[message.type] || MSG_TYPE_COLORS.info;
                        const status = getMessageStatus(message);

                        return (
                            <motion.article
                                key={message.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.035, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                                className={`glass-panel-premium overflow-hidden rounded-[1.75rem] p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 ${status !== 'live' ? 'opacity-75' : ''}`}
                            >
                                <div className="relative z-10 space-y-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${colors.bg} ${colors.text} ${colors.border}`}>
                                                    <span className={`h-2 w-2 rounded-full ${colors.dot}`} />
                                                    {message.type}
                                                </span>
                                                <StatusPill status={status} />
                                            </div>
                                            <h3 className="truncate text-lg font-serif italic text-claude-text">{message.title}</h3>
                                            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-claude-secondary">{message.content}</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2 lg:justify-end">
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-claude-bg/35 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                <CalendarClock className="h-3 w-3" />
                                                {formatDate(message.createdAt)}
                                            </span>
                                            {message.createdBy && (
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-claude-bg/35 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                    <UserRound className="h-3 w-3" />
                                                    {message.createdBy}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {message.expiresAt && (
                                        <p className="rounded-xl border border-white/10 bg-claude-bg/35 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                                            Expires {formatDate(message.expiresAt)}
                                        </p>
                                    )}

                                    <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:justify-end">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                haptics?.light();
                                                onToggle(message.id, message.isActive);
                                            }}
                                            className="tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-claude-bg/45 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                                        >
                                            <Power className="h-4 w-4" />
                                            {message.isActive ? 'Deactivate' : 'Activate'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                haptics?.medium();
                                                onDelete(message.id);
                                            }}
                                            className="tap-action inline-flex min-h-[42px] items-center justify-center rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-red-400 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            </motion.article>
                        );
                    })
                )}
            </section>
        </div>
    );
}
