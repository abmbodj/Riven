import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HeartCrack, HeartPulse, X, Sparkles, Play } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

export default function OutOfHeartsModal({ isOpen, onClose, onPractice, onUpgrade }) {
    useBodyScrollLock(isOpen);

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[998] flex items-end sm:items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        role="dialog"
                        aria-modal="true"
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative glass-panel w-full sm:max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle for mobile */}
                        <div className="sm:hidden w-12 h-1.5 bg-claude-border rounded-full mx-auto mt-3 mb-1" />

                        <div className="p-6 text-center pt-8">
                            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 relative group">
                                <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                                    <HeartCrack className="w-10 h-10 text-red-500" />
                                </motion.div>
                            </div>

                            <h3 className="text-2xl font-display font-bold mb-2">You're Out of Hearts!</h3>
                            <p className="text-claude-secondary mb-8">
                                You need hearts to keep answering. Wait for them to refill over time, practice weak cards, or upgrade to Supporter for infinite hearts!
                            </p>

                            <div className="flex flex-col gap-3">
                                {/* Option 1: Practice */}
                                <button
                                    onClick={onPractice}
                                    className="w-full py-4 rounded-xl border border-claude-border bg-white/5 font-semibold text-claude-text hover:bg-white/10 transition-colors flex items-center justify-center gap-2 tap-action"
                                >
                                    <HeartPulse className="w-5 h-5 text-green-500" />
                                    Practice to Earn Hearts
                                </button>


                                {/* Option 3: Upgrade */}
                                <button
                                    onClick={onUpgrade}
                                    className="w-full py-4 rounded-xl bg-gradient-to-r from-claude-accent to-indigo-500 text-white font-bold transition-opacity hover:opacity-90 active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <Sparkles className="w-5 h-5" />
                                    Get Unlimited Hearts
                                </button>
                            </div>

                            <button onClick={onClose} className="mt-6 text-sm text-claude-secondary hover:text-white transition-colors">
                                End Session
                            </button>
                        </div>

                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
