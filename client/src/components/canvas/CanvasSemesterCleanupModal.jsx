import React, { useEffect, useMemo, useState } from 'react';
import { Archive, CheckCircle2, Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { api } from '../../api';
import { useToast } from '../../hooks/useToast';
import { scheduleAssignmentNotifications } from '../../utils/notifications';

export default function CanvasSemesterCleanupModal({ isOpen, onClose, onArchived }) {
    const toast = useToast();
    const [loading, setLoading] = useState(false);
    const [archiving, setArchiving] = useState(false);
    const [classes, setClasses] = useState([]);
    const [selectedIds, setSelectedIds] = useState(() => new Set());
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;

        let active = true;
        const loadPreview = async () => {
            setLoading(true);
            setError('');
            try {
                const preview = await api.previewCanvasSemesterCleanup();
                if (!active) return;

                const cleanupClasses = preview?.classes || [];
                setClasses(cleanupClasses);
                setSelectedIds(new Set(preview?.suggestedClassIds || cleanupClasses.map((item) => item.id)));
            } catch (err) {
                if (!active) return;
                setError(err.message || 'Could not load Canvas classes.');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadPreview();
        return () => {
            active = false;
        };
    }, [isOpen]);

    const selectedClasses = useMemo(
        () => classes.filter((item) => selectedIds.has(item.id)),
        [classes, selectedIds]
    );
    const activeAssignmentCount = selectedClasses.reduce((total, item) => total + Number(item.activeAssignmentCount || 0), 0);

    const toggleClass = (classId) => {
        setSelectedIds((current) => {
            const next = new Set(current);
            if (next.has(classId)) {
                next.delete(classId);
            } else {
                next.add(classId);
            }
            return next;
        });
    };

    const handleArchive = async () => {
        if (selectedIds.size === 0 || archiving) return;

        setArchiving(true);
        setError('');
        try {
            const result = await api.archiveCanvasSemesterClasses(Array.from(selectedIds));
            toast.success(`Archived ${result.classesArchived} classes and ${result.assignmentsArchived} assignments.`);

            try {
                const assignments = await api.getAssignments();
                const saved = localStorage.getItem('notifications_enabled');
                const notificationsEnabled = saved === null ? true : saved === 'true';
                await scheduleAssignmentNotifications(assignments, notificationsEnabled);
            } catch (notificationError) {
                console.error('Failed to reschedule notifications after semester cleanup', notificationError);
            }

            onArchived?.(result);
            onClose?.();
        } catch (err) {
            setError(err.message || 'Semester cleanup failed.');
            toast.error(err.message || 'Semester cleanup failed.');
        } finally {
            setArchiving(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-claude-bg/85 backdrop-blur-sm"
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="semester-cleanup-title"
                        initial={{ y: 28, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: 28, opacity: 0 }}
                        className="relative m-0 max-h-[88vh] w-full overflow-y-auto rounded-t-[2rem] border border-claude-border bg-claude-bg p-5 shadow-2xl sm:m-6 sm:max-w-xl sm:rounded-[1.5rem] sm:p-6"
                    >
                        <div className="mb-5 flex items-start justify-between gap-4">
                            <div className="min-w-0">
                                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.22em] text-claude-accent">Canvas Cleanup</p>
                                <h2 id="semester-cleanup-title" className="mt-2 font-serif text-2xl font-bold italic text-claude-text">End Semester</h2>
                                <p className="mt-2 text-sm leading-6 text-claude-secondary">Archive past Canvas classes now. You can restore them from Past Courses later.</p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="tap-action flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-claude-border text-claude-secondary transition-colors hover:text-claude-text"
                                aria-label="Close semester cleanup"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center gap-3 rounded-2xl border border-claude-border bg-claude-surface/30 px-4 py-10 text-sm text-claude-secondary">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading Canvas classes
                            </div>
                        ) : classes.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-claude-border px-4 py-10 text-center">
                                <Archive className="mx-auto mb-3 h-8 w-8 text-claude-secondary/60" />
                                <p className="font-serif text-lg font-bold italic text-claude-text">No active Canvas classes</p>
                                <p className="mt-2 text-sm text-claude-secondary">There are no current Canvas-linked classes to archive.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {classes.map((item) => {
                                    const selected = selectedIds.has(item.id);
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => toggleClass(item.id)}
                                            className={`tap-action flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${selected ? 'border-claude-accent/40 bg-claude-accent/10' : 'border-claude-border bg-claude-surface/25'}`}
                                        >
                                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-claude-accent bg-claude-accent text-claude-bg' : 'border-claude-secondary/40 text-transparent'}`}>
                                                <CheckCircle2 className="h-4 w-4" />
                                            </span>
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-serif text-lg font-bold italic text-claude-text">{item.name}</span>
                                                <span className="mt-1 block text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                                    {item.activeAssignmentCount} active / {item.totalAssignmentCount} total assignments
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                                {error}
                            </div>
                        )}

                        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                            <button
                                type="button"
                                onClick={onClose}
                                className="tap-action rounded-[1rem] border border-claude-border px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary transition-colors hover:text-claude-text sm:flex-1"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleArchive}
                                disabled={loading || archiving || selectedIds.size === 0}
                                className="tap-action flex items-center justify-center gap-2 rounded-[1rem] bg-claude-accent px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-bg transition-opacity disabled:opacity-50 sm:flex-1"
                            >
                                {archiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                                Archive {selectedIds.size} {selectedIds.size === 1 ? 'Class' : 'Classes'}
                            </button>
                        </div>

                        {selectedIds.size > 0 && (
                            <p className="mt-3 text-center text-[11px] font-mono text-claude-secondary/80">
                                {activeAssignmentCount} unfinished assignments will move to Archived.
                            </p>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
