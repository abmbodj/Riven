import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, CheckCircle2, X, AlertTriangle } from 'lucide-react';

const STATUS_COLORS = {
    pending: 'bg-claude-accent/15 text-claude-accent border-claude-accent/25',
    resolved: 'bg-botanical-forest/15 text-botanical-forest border-botanical-forest/25',
    closed: 'bg-claude-secondary/15 text-claude-secondary border-claude-border'
};

export default function ReportsTab({ reports, onResolve, onClose, onBan, haptics }) {
    const [filter, setFilter] = useState('pending');

    const filteredReports = useMemo(() => {
        if (filter === 'all') return reports;
        return reports.filter(r => r.status === filter);
    }, [reports, filter]);

    const pendingCount = useMemo(() => reports.filter(r => r.status === 'pending').length, [reports]);

    return (
        <div className="space-y-5">
            {/* Filter Pills */}
            <div className="flex items-center gap-2 p-1.5 glass-panel rounded-2xl border border-claude-border overflow-x-auto no-scrollbar scroll-smooth">
                {[
                    { id: 'pending', label: 'Pending', count: pendingCount },
                    { id: 'resolved', label: 'Resolved' },
                    { id: 'closed', label: 'Closed' },
                    { id: 'all', label: 'All' }
                ].map(status => (
                    <button
                        key={status.id}
                        onClick={() => {
                            haptics.light();
                            setFilter(status.id);
                        }}
                        className={`relative px-4 py-2 rounded-xl text-[10px] font-bold tracking-widest font-mono uppercase transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 whitespace-nowrap touch-target tap-action active:scale-[0.97] ${filter === status.id
                            ? 'bg-claude-accent text-botanical-ink shadow-botanical-glow'
                            : 'text-claude-secondary hover:text-claude-text'
                        }`}
                    >
                        {status.label}
                        {status.count > 0 && (
                            <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] ${filter === status.id
                                ? 'bg-botanical-ink/20 text-botanical-ink'
                                : 'bg-claude-accent/15 text-claude-accent'
                            }`}>
                                {status.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Reports List */}
            <div className="space-y-3">
                {filteredReports.length === 0 ? (
                    <div className="relative overflow-hidden text-center py-16 px-6 glass-panel border-dashed border-claude-border/60 rounded-2xl">
                        <div className="absolute inset-0 bg-gradient-to-b from-claude-bg/20 to-claude-bg/60 pointer-events-none" />
                        <div className="relative z-10">
                            <ShieldAlert className="w-8 h-8 text-claude-border mx-auto mb-3" />
                            <p className="text-claude-secondary text-[11px] font-mono uppercase tracking-widest">
                                No {filter !== 'all' ? filter : ''} reports found
                            </p>
                        </div>
                    </div>
                ) : (
                    filteredReports.map((report, i) => (
                        <motion.div
                            key={report.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                            className="p-4 rounded-2xl glass-panel border border-claude-border flex flex-col gap-3 relative overflow-hidden transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-300 hover:border-claude-accent/20"
                        >
                            <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('/textures/paper-fibers.png')]" />

                            {/* Header */}
                            <div className="flex justify-between items-start gap-3 relative z-10">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                        <span className={`px-2 py-0.5 rounded-md text-[8px] font-bold uppercase tracking-widest border ${STATUS_COLORS[report.status] || STATUS_COLORS.pending}`}>
                                            {report.status}
                                        </span>
                                        <span className="text-[9px] font-mono text-claude-secondary uppercase tracking-widest">
                                            {report.content_type}
                                        </span>
                                    </div>
                                    <h4 className="text-base font-serif italic text-claude-text truncate">
                                        Reported: <span className="text-claude-accent not-italic">{report.reported_username}</span>
                                    </h4>
                                    <p className="text-[10px] text-claude-secondary truncate font-mono uppercase tracking-wider mt-0.5">
                                        By {report.reporter_username} &middot; {new Date(report.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>

                            {/* Details */}
                            <div className="bg-claude-bg/40 rounded-xl p-3 border border-claude-border/40 relative z-10">
                                <p className="text-xs font-medium text-claude-text mb-1">
                                    <span className="text-[9px] font-mono text-claude-secondary uppercase tracking-widest mr-2">Reason</span>
                                    {report.reason}
                                </p>
                                {report.details && (
                                    <p className="text-[11px] text-claude-secondary whitespace-pre-wrap mt-2 leading-relaxed">
                                        {report.details}
                                    </p>
                                )}
                            </div>

                            {/* Actions */}
                            {report.status === 'pending' && (
                                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-claude-border/30 relative z-10">
                                    <button
                                        onClick={() => {
                                            haptics.medium();
                                            onResolve(report.id);
                                        }}
                                        className="flex-1 min-w-[100px] py-2.5 rounded-xl text-[10px] font-bold font-mono uppercase tracking-widest bg-botanical-forest/10 hover:bg-botanical-forest/20 text-botanical-forest border border-botanical-forest/25 transition-[transform,opacity,color,background-color,border-color,box-shadow] flex items-center justify-center gap-1.5 touch-target tap-action active:scale-[0.97]"
                                    >
                                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolve
                                    </button>
                                    <button
                                        onClick={() => {
                                            haptics.light();
                                            onClose(report.id);
                                        }}
                                        className="flex-1 min-w-[100px] py-2.5 rounded-xl text-[10px] font-bold font-mono uppercase tracking-widest bg-claude-surface/50 hover:bg-claude-surface/70 text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] flex items-center justify-center gap-1.5 touch-target tap-action active:scale-[0.97]"
                                    >
                                        <X className="w-3.5 h-3.5" /> Dismiss
                                    </button>
                                    <button
                                        onClick={() => {
                                            haptics.heavy();
                                            onBan(report.reported_user_id, report.id);
                                        }}
                                        className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-[10px] font-bold font-mono uppercase tracking-widest bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/25 transition-[transform,opacity,color,background-color,border-color,box-shadow] flex items-center justify-center gap-1.5 touch-target tap-action active:scale-[0.97]"
                                    >
                                        <ShieldAlert className="w-3.5 h-3.5" /> Ban User
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    ))
                )}
            </div>
        </div>
    );
}
