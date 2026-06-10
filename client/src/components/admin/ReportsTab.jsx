import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
    AlertTriangle,
    CheckCircle2,
    Clock3,
    FileText,
    ShieldAlert,
    UserRound,
    X,
} from 'lucide-react';

const STATUS_STYLES = {
    pending: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
    resolved: 'border-botanical-forest/25 bg-botanical-forest/10 text-botanical-forest',
    closed: 'border-white/10 bg-claude-bg/35 text-claude-secondary',
};

const STATUS_FILTERS = [
    { id: 'pending', label: 'Pending' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'closed', label: 'Closed' },
    { id: 'all', label: 'All' },
];

const formatDate = (value) => {
    if (!value) return 'Unknown';
    return new Date(value).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const getReporter = (report) => report.reporter_username || report.reporter_name || 'Unknown';
const getReported = (report) => report.reported_username || report.reported_name || 'Unknown';

function StatusBadge({ status }) {
    return (
        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
            {status || 'pending'}
        </span>
    );
}

export default function ReportsTab({ reports, onResolve, onClose, onBan, haptics }) {
    const [filter, setFilter] = useState('pending');

    const counts = useMemo(() => reports.reduce((acc, report) => {
        acc.all += 1;
        acc[report.status] = (acc[report.status] || 0) + 1;
        return acc;
    }, { all: 0, pending: 0, resolved: 0, closed: 0 }), [reports]);

    const filteredReports = useMemo(() => {
        if (filter === 'all') return reports;
        return reports.filter(report => report.status === filter);
    }, [reports, filter]);

    return (
        <div className="space-y-5">
            <section className="glass-panel-premium rounded-[1.6rem] p-4">
                <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="flex items-center gap-2 text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-secondary">
                            <ShieldAlert className="h-3.5 w-3.5 text-claude-accent" />
                            Moderation queue
                        </p>
                        <p className="mt-1 text-sm text-claude-secondary">
                            Review reports by status, then resolve, dismiss, or escalate.
                        </p>
                    </div>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar">
                        {STATUS_FILTERS.map((status) => {
                            const isActive = filter === status.id;
                            return (
                                <button
                                    key={status.id}
                                    type="button"
                                    aria-pressed={isActive}
                                    onClick={() => {
                                        haptics?.light();
                                        setFilter(status.id);
                                    }}
                                    className={`tap-action inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 py-2 text-[9px] font-mono font-bold uppercase tracking-[0.16em] transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97] ${
                                        isActive
                                            ? 'bg-claude-accent text-botanical-ink shadow-botanical-glow'
                                            : 'border border-white/10 bg-claude-bg/35 text-claude-secondary hover:text-claude-text'
                                    }`}
                                >
                                    {status.label}
                                    <span className={`rounded-full px-1.5 py-0.5 text-[8px] ${isActive ? 'bg-botanical-ink/15' : 'bg-white/5'}`}>
                                        {counts[status.id] || 0}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </section>

            <section className="space-y-3">
                {filteredReports.length === 0 ? (
                    <div className="glass-panel-premium rounded-[1.75rem] border-dashed border-white/10 px-6 py-16 text-center">
                        <div className="relative z-10">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-claude-bg/45">
                                <CheckCircle2 className="h-6 w-6 text-botanical-forest" />
                            </div>
                            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-claude-secondary">
                                No {filter !== 'all' ? filter : ''} reports found
                            </p>
                            <p className="mx-auto mt-2 max-w-sm text-sm text-claude-secondary/75">
                                This queue is clear for the selected status.
                            </p>
                        </div>
                    </div>
                ) : (
                    filteredReports.map((report, index) => {
                        const isPending = report.status === 'pending';
                        const reporter = getReporter(report);
                        const reported = getReported(report);

                        return (
                            <motion.article
                                key={report.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.035, duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
                                className="glass-panel-premium overflow-hidden rounded-[1.75rem] p-4 transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5"
                            >
                                <div className="relative z-10 space-y-4">
                                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="min-w-0">
                                            <div className="mb-2 flex flex-wrap items-center gap-2">
                                                <StatusBadge status={report.status} />
                                                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-claude-bg/35 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">
                                                    <FileText className="h-3 w-3" />
                                                    {report.content_type || report.contentType || 'content'}
                                                </span>
                                                {isPending && (
                                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.16em] text-amber-300">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Needs review
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-lg font-serif italic leading-tight text-claude-text">
                                                Reported <span className="text-claude-accent not-italic">{reported}</span>
                                            </h3>
                                            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                                                <span className="inline-flex items-center gap-1">
                                                    <UserRound className="h-3 w-3" />
                                                    By {reporter}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock3 className="h-3 w-3" />
                                                    {formatDate(report.created_at || report.createdAt)}
                                                </span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="rounded-[1.15rem] border border-white/10 bg-claude-bg/35 p-4">
                                        <p className="text-[9px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary">
                                            Reason
                                        </p>
                                        <p className="mt-2 text-sm font-medium text-claude-text">{report.reason || 'No reason provided'}</p>
                                        {report.details && (
                                            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-claude-secondary">
                                                {report.details}
                                            </p>
                                        )}
                                    </div>

                                    {isPending && (
                                        <div className="flex flex-col gap-2 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-end">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptics?.medium();
                                                    onResolve(report.id);
                                                }}
                                                className="tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-botanical-forest/25 bg-botanical-forest/10 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-botanical-forest transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                                            >
                                                <CheckCircle2 className="h-4 w-4" />
                                                Resolve
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptics?.light();
                                                    onClose(report.id);
                                                }}
                                                className="tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-white/10 bg-claude-bg/45 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                                            >
                                                <X className="h-4 w-4" />
                                                Dismiss
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    haptics?.heavy();
                                                    onBan(report.reported_user_id || report.reportedUserId, report.id);
                                                }}
                                                className="tap-action inline-flex min-h-[42px] items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-red-400 transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.97]"
                                            >
                                                <ShieldAlert className="h-4 w-4" />
                                                Ban User
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.article>
                        );
                    })
                )}
            </section>
        </div>
    );
}
