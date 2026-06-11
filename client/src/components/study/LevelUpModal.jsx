import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';

/**
 * Celebration shown when an XP-granting action pushes the user to a new level.
 * Fired from any XP source (tutor sessions, exams, deck reviews) when the server
 * reports newLevel > previousLevel.
 */
export default function LevelUpModal({ open, level, xpTotal, onClose }) {
    return (
        <AnimatePresence>
            {open ? (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />
                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Level ${level} reached`}
                        initial={{ opacity: 0, scale: 0.86, y: 18 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.92, y: 12 }}
                        transition={{ type: 'spring', damping: 18, stiffness: 240 }}
                        className="relative w-full max-w-sm overflow-hidden rounded-[2rem] border border-claude-accent/30 bg-claude-bg p-7 text-center shadow-[0_30px_90px_rgba(0,0,0,0.5)]"
                    >
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(222,185,106,0.22),transparent_60%)]" />
                        <motion.div
                            initial={{ rotate: -12, scale: 0.7 }}
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.05 }}
                            className="relative z-10 mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border-2 border-claude-accent/40 bg-claude-accent/15"
                        >
                            <span className="font-display text-3xl font-bold text-claude-accent">{level}</span>
                        </motion.div>
                        <p className="relative z-10 inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.22em] text-claude-accent">
                            <Sparkles className="h-3.5 w-3.5" /> Level up
                        </p>
                        <h2 className="relative z-10 mt-2 font-serif text-2xl italic font-bold text-claude-text">
                            You reached Level {level}
                        </h2>
                        {typeof xpTotal === 'number' ? (
                            <p className="relative z-10 mt-1 text-sm text-claude-secondary">{xpTotal} XP and climbing.</p>
                        ) : null}
                        <button
                            type="button"
                            onClick={onClose}
                            className="relative z-10 mt-6 inline-flex min-h-[44px] w-full items-center justify-center rounded-2xl bg-claude-accent px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        >
                            Keep going
                        </button>
                    </motion.div>
                </div>
            ) : null}
        </AnimatePresence>
    );
}
