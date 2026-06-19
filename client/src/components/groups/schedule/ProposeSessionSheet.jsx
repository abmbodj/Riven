import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Sparkles, X } from 'lucide-react';
import {
    fromLocalDateTimeValue,
    toLocalDateTimeValue,
} from '../../../utils/calendarDates';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

const DURATION_OPTIONS = [45, 60, 90, 120];
const FOCUSABLE_SELECTOR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Single bottom-sheet composer for proposing a session. Time is prefilled from
 * the tapped heatmap cell (editable). Shows the free/busy roster for that slot so
 * the proposer knows who they're inviting.
 */
export default function ProposeSessionSheet({
    open,
    initialStart,
    initialDurationMinutes = 60,
    rosterFreeNames = [],
    rosterDenominator = 0,
    submitting = false,
    onClose,
    onSubmit,
}) {
    // The parent remounts this sheet (via `key`) for each new slot, so lazy
    // initializers seed the form from the tapped cell with no reset effect.
    const [startAtLocal, setStartAtLocal] = useState(() => toLocalDateTimeValue(initialStart || new Date()));
    const [durationMinutes, setDurationMinutes] = useState(initialDurationMinutes);
    const [topic, setTopic] = useState('');
    const [locationLabel, setLocationLabel] = useState('');
    const [locationUrl, setLocationUrl] = useState('');
    const [error, setError] = useState('');
    const dialogRef = useRef(null);
    const titleId = useId();

    useBodyScrollLock(open);

    // Focus management + trap + Escape.
    useEffect(() => {
        if (!open || !dialogRef.current) return undefined;
        const dialog = dialogRef.current;
        dialog.querySelector('input[name="session-topic"]')?.focus();

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !submitting) {
                onClose?.();
                return;
            }
            if (event.key !== 'Tab') return;
            const focusable = [...dialog.querySelectorAll(FOCUSABLE_SELECTOR)].filter((el) => !el.hasAttribute('disabled'));
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        dialog.addEventListener('keydown', handleKeyDown);
        return () => dialog.removeEventListener('keydown', handleKeyDown);
    }, [open, submitting, onClose]);

    const handleSubmit = (event) => {
        event.preventDefault();
        const startAt = fromLocalDateTimeValue(startAtLocal);
        if (!startAt) {
            setError('Choose a valid start time.');
            return;
        }
        if (startAt.getTime() < Date.now()) {
            setError("Can't propose a session in the past.");
            return;
        }
        if (!topic.trim()) {
            setError("Add a topic so everyone knows what they're joining.");
            return;
        }

        const endAt = new Date(startAt.getTime() + Number(durationMinutes) * 60 * 1000);
        onSubmit?.({
            topic: topic.trim(),
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            location_label: locationLabel.trim() || null,
            location_url: locationUrl.trim() || null,
        });
    };

    return (
        <AnimatePresence>
            {open && (
                <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        aria-hidden="true"
                        className="absolute inset-0 bg-black/65 backdrop-blur-sm"
                        onClick={submitting ? undefined : onClose}
                    />

                    <motion.form
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        initial={{ opacity: 0, y: 24, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 24, scale: 0.98 }}
                        onSubmit={handleSubmit}
                        className="relative w-full max-w-lg rounded-t-[2.2rem] border border-white/10 bg-[linear-gradient(165deg,rgba(30,56,64,0.95),rgba(12,20,28,0.95))] p-6 shadow-[0_40px_90px_rgba(0,0,0,0.34)] backdrop-blur-2xl md:rounded-[2rem] md:p-7"
                    >
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-accent">
                                    Propose session
                                </p>
                                <h3 id={titleId} className="mt-2 font-display text-[2rem] font-bold italic tracking-tight text-claude-text">
                                    New study session
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={submitting}
                                className="rounded-full border border-white/10 bg-white/[0.05] p-2 text-claude-text transition-colors hover:bg-white/[0.1]"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {rosterDenominator > 0 && (
                            <div className="mt-4 flex items-start gap-2 rounded-[1.1rem] border border-[#7a9e72]/25 bg-[rgba(122,158,114,0.12)] px-3 py-2.5">
                                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9ec59a]" />
                                <p className="text-[12px] leading-5 text-[#d9e8dd]">
                                    <span className="font-semibold">{rosterFreeNames.length} of {rosterDenominator} free</span>
                                    {rosterFreeNames.length > 0 && (
                                        <span className="text-[#d9e8dd]/80"> · {rosterFreeNames.slice(0, 5).join(', ')}{rosterFreeNames.length > 5 ? '…' : ''}</span>
                                    )}
                                </p>
                            </div>
                        )}

                        <div className="mt-5 space-y-5">
                            <label className="block">
                                <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">Topic</span>
                                <input
                                    type="text"
                                    name="session-topic"
                                    value={topic}
                                    onChange={(event) => setTopic(event.target.value)}
                                    placeholder="e.g. Organic chemistry problem set"
                                    className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">When</span>
                                <input
                                    type="datetime-local"
                                    name="session-start-at"
                                    value={startAtLocal}
                                    min={toLocalDateTimeValue(new Date())}
                                    onChange={(event) => setStartAtLocal(event.target.value)}
                                    className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                />
                            </label>

                            <div>
                                <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">Duration</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {DURATION_OPTIONS.map((option) => (
                                        <button
                                            key={option}
                                            type="button"
                                            onClick={() => setDurationMinutes(option)}
                                            className={`rounded-[1rem] border px-3 py-3 text-sm font-semibold transition-colors ${
                                                Number(durationMinutes) === option
                                                    ? 'border-claude-accent/35 bg-claude-accent/12 text-claude-text'
                                                    : 'border-white/10 bg-white/[0.05] text-claude-secondary'
                                            }`}
                                        >
                                            {option}m
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <label className="block">
                                <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">Place or label</span>
                                <input
                                    type="text"
                                    value={locationLabel}
                                    onChange={(event) => setLocationLabel(event.target.value)}
                                    placeholder="Library East, Room 202"
                                    className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                />
                            </label>

                            <label className="block">
                                <span className="mb-2 block text-[11px] font-mono font-bold uppercase tracking-[0.16em] text-claude-secondary">Optional link</span>
                                <input
                                    type="url"
                                    value={locationUrl}
                                    onChange={(event) => setLocationUrl(event.target.value)}
                                    placeholder="https://..."
                                    className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-base text-claude-text outline-none transition-colors focus:border-claude-accent/40"
                                />
                            </label>
                        </div>

                        {error && (
                            <p className="mt-4 rounded-[1rem] border border-red-400/16 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-200">
                                {error}
                            </p>
                        )}

                        <div className="mt-6">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="w-full rounded-full bg-claude-accent px-5 py-3 text-sm font-semibold text-[#182a31] disabled:opacity-60"
                            >
                                {submitting ? 'Proposing…' : 'Propose session'}
                            </button>
                        </div>
                    </motion.form>
                </div>
            )}
        </AnimatePresence>
    );
}
