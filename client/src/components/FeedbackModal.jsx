import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import MessageSquare from 'lucide-react/dist/esm/icons/message-square';
import Send from 'lucide-react/dist/esm/icons/send';
import X from 'lucide-react/dist/esm/icons/x';
import { api } from '../api';
import { feedbackContentSchema } from '../schemas/forms';
import { useToast } from '../hooks/useToast';
import useHaptics from '../hooks/useHaptics';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

const MAX_FEEDBACK_LENGTH = 1000;

export default function FeedbackModal({ isOpen, onClose }) {
    const toast = useToast();
    const haptics = useHaptics();
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    useBodyScrollLock(isOpen);

    useEffect(() => {
        if (!isOpen) {
            setContent('');
            setLoading(false);
        }
    }, [isOpen]);

    const trimmedContent = content.trim();
    const charactersLeft = useMemo(
        () => MAX_FEEDBACK_LENGTH - content.length,
        [content.length],
    );

    if (!isOpen) return null;

    const handleClose = () => {
        if (loading) return;
        haptics.light();
        onClose();
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        const result = feedbackContentSchema.safeParse(trimmedContent);
        if (!result.success) {
            haptics.error();
            toast.error(result.error.errors[0]?.message || 'Please add your feedback first.');
            return;
        }

        setLoading(true);
        try {
            await api.submitFeedback(result.data);
            haptics.success();
            toast.success('Thanks for the suggestion. It is now in the owner inbox.');
            onClose();
            setContent('');
        } catch (error) {
            console.error('[FeedbackModal] submit failed:', error);
            haptics.error();
            toast.error(error.message || 'Could not send feedback right now.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-black/60 md:backdrop-blur-sm"
            >
                <button
                    type="button"
                    aria-label="Close feedback dialog"
                    className="absolute inset-0 h-full w-full cursor-default"
                    onClick={handleClose}
                />

                <div className="relative flex min-h-full items-end justify-center p-0 md:items-center md:p-4">
                    <motion.div
                        initial={{ opacity: 0, y: 28 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 18 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        className="modal-scroll-content relative w-full overflow-hidden rounded-t-[2rem] border border-claude-border/70 bg-claude-surface/95 shadow-[0_24px_80px_rgba(0,0,0,0.38)] md:max-w-xl md:rounded-[2rem]"
                    >
                        <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.08)_1px,transparent_0)] [background-size:10px_10px]" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/10" />

                        <div className="relative z-10">
                            <div className="flex items-start justify-between gap-4 border-b border-claude-border/60 px-5 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
                                <div className="min-w-0">
                                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-claude-accent/20 bg-claude-accent/10 px-3 py-1 text-[9px] font-mono font-bold uppercase tracking-[0.18em] text-claude-accent">
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        Send feedback
                                    </div>
                                    <h2 className="font-serif text-[1.8rem] font-semibold italic leading-none tracking-[-0.03em] text-claude-text sm:text-[2rem]">
                                        Shape what comes next
                                    </h2>
                                    <p className="mt-3 max-w-md text-[10px] font-mono uppercase leading-relaxed tracking-[0.14em] text-claude-secondary/80 sm:text-[11px]">
                                        Share one suggestion for Riven. The owner can favorite, review, and thank you when it is being considered.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={handleClose}
                                    className="tap-action mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-claude-border/70 bg-claude-bg/60 text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-accent active:scale-95"
                                >
                                    <X className="h-4.5 w-4.5" />
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
                                <div className="rounded-[1.5rem] border border-claude-border/70 bg-claude-bg/45 p-4 sm:p-5">
                                    <label
                                        htmlFor="feedback-content"
                                        className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary/80"
                                    >
                                        Your suggestion
                                    </label>
                                    <textarea
                                        id="feedback-content"
                                        autoFocus
                                        rows={6}
                                        maxLength={MAX_FEEDBACK_LENGTH}
                                        value={content}
                                        onChange={(event) => setContent(event.target.value)}
                                        placeholder="What would make Riven better for you?"
                                        className="mt-3 min-h-[180px] w-full resize-none rounded-[1.2rem] border border-claude-border/70 bg-claude-bg/75 px-4 py-3.5 text-sm leading-relaxed text-claude-text placeholder:text-claude-secondary/45 focus:border-claude-accent/35 focus:outline-none"
                                    />
                                    <div className="mt-3 flex items-center justify-between gap-3">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary/70">
                                            Simple notes are perfect. One idea is enough.
                                        </p>
                                        <span className={`shrink-0 text-[10px] font-mono uppercase tracking-[0.16em] ${charactersLeft < 100 ? 'text-amber-400' : 'text-claude-secondary/70'}`}>
                                            {charactersLeft} left
                                        </span>
                                    </div>
                                </div>

                                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                                    <button
                                        type="button"
                                        onClick={handleClose}
                                        disabled={loading}
                                        className="tap-action rounded-[1.1rem] border border-claude-border/70 bg-claude-bg/55 px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-secondary transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:border-claude-accent/35 hover:text-claude-text active:scale-[0.98] disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading || trimmedContent.length === 0}
                                        className="tap-action inline-flex items-center justify-center gap-2 rounded-[1.1rem] bg-claude-text px-4 py-3 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-claude-bg transition-[transform,opacity,color,background-color,border-color,box-shadow] hover:-translate-y-0.5 hover:bg-claude-accent active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <Send className="h-4 w-4" />
                                        {loading ? 'Sending...' : 'Send feedback'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </motion.div>
                </div>
            </motion.div>
        </AnimatePresence>
    );
}
