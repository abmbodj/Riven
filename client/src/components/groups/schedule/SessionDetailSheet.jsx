import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, X } from 'lucide-react';
import { formatMeetupRange } from '../../../utils/calendarDates';
import { getMeetupStateLabel, isMeetupCancelled, isMeetupEnded } from '../../../utils/calendarModel';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

export default function SessionDetailSheet({
    open,
    meetup,
    nowMs,
    isAdmin,
    onClose,
    onJoin,
    onLeave,
    onCancel,
}) {
    const [rsvpDone, setRsvpDone] = useState(false);
    const [cancelPending, setCancelPending] = useState(false);
    const [mountedNowMs] = useState(() => Date.now());
    const cancelTimerRef = useRef(null);
    const titleId = useId();

    useBodyScrollLock(open);

    // Escape to close.
    useEffect(() => {
        if (!open) return undefined;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    // Clear pending cancel timer on unmount.
    useEffect(() => {
        return () => {
            if (cancelTimerRef.current) clearTimeout(cancelTimerRef.current);
        };
    }, []);

    const handleRsvp = () => {
        if (meetup.is_joined) {
            onLeave?.();
        } else {
            onJoin?.();
        }
        setRsvpDone(true);
        setTimeout(() => onClose?.(), 1500);
    };

    const handleCancelTap = () => {
        if (cancelPending) {
            clearTimeout(cancelTimerRef.current);
            cancelTimerRef.current = null;
            onCancel?.(meetup.id);
            return;
        }
        setCancelPending(true);
        cancelTimerRef.current = setTimeout(() => {
            setCancelPending(false);
            cancelTimerRef.current = null;
        }, 3000);
    };

    const effectiveNowMs = nowMs ?? mountedNowMs;
    const cancelled = isMeetupCancelled(meetup);
    const ended = isMeetupEnded(meetup, effectiveNowMs);
    const stateLabel = getMeetupStateLabel(meetup, effectiveNowMs);
    const showCancel = !cancelled && !ended && (isAdmin || meetup?.is_creator);

    return (
        <AnimatePresence>
            {open && meetup && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        aria-hidden="true"
                        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        className="relative w-full max-w-lg rounded-t-[2.2rem] border border-white/10 bg-[linear-gradient(165deg,rgba(30,56,64,0.95),rgba(12,20,28,0.95))] p-6 shadow-[0_40px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:rounded-[2rem] md:p-7"
                    >
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                                {(cancelled || ended) && (
                                    <p className={`mb-1 font-mono text-[11px] font-bold uppercase tracking-[0.16em] ${cancelled ? 'text-red-400/80' : 'text-claude-secondary'}`}>
                                        {stateLabel}
                                    </p>
                                )}
                                <h3
                                    id={titleId}
                                    className="truncate font-display text-[1.6rem] font-bold italic tracking-tight text-claude-text"
                                >
                                    {meetup.topic || 'Study session'}
                                </h3>
                                <p className="mt-1 text-[13px] text-claude-secondary">
                                    {formatMeetupRange(meetup.start_at, meetup.end_at)}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] p-2 text-claude-text transition-colors hover:bg-white/[0.1]"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {/* Attendee count */}
                        {meetup.attendee_count > 0 && (
                            <p className="mt-2 text-[12px] text-claude-secondary">
                                {meetup.attendee_count} {meetup.attendee_count === 1 ? 'person' : 'people'} {ended ? 'went' : 'going'}
                            </p>
                        )}

                        {/* RSVP */}
                        {!cancelled && !ended && (
                            <div className="mt-5">
                                {rsvpDone ? (
                                    <div className="flex items-center justify-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/12 px-5 py-3 text-sm font-semibold text-emerald-100">
                                        <Check className="h-4 w-4" />
                                        Got it
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleRsvp}
                                        className="w-full rounded-full bg-claude-accent px-5 py-3 text-sm font-semibold text-[#182a31]"
                                    >
                                        {meetup.is_joined ? "Can't make it" : "I'm going"}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Cancel (creator / admin only) */}
                        {showCancel && (
                            <div className="mt-3 flex justify-center">
                                {cancelPending ? (
                                    <button
                                        type="button"
                                        onClick={handleCancelTap}
                                        className="rounded-full border border-red-400/30 bg-red-500/14 px-4 py-2 text-[12px] font-semibold text-red-300"
                                    >
                                        Confirm cancel
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleCancelTap}
                                        className="text-[12px] text-claude-secondary/60 underline-offset-4 hover:text-claude-secondary hover:underline"
                                    >
                                        Cancel session
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
