import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldAlert, X, AlertTriangle, Loader2 } from 'lucide-react';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';

const REPORT_REASONS = [
    { id: 'harassment', label: 'Harassment or Bullying', description: 'Targeted abuse or mean behavior' },
    { id: 'spam', label: 'Spam or Scam', description: 'Unwanted promotional content or phishing' },
    { id: 'inappropriate', label: 'Inappropriate Content', description: 'NSFW, gore, or offensive material' },
    { id: 'fake_account', label: 'Fake Account', description: 'Impersonation or bot account' },
    { id: 'other', label: 'Other', description: 'Something else' },
];

export default function ReportModal({ isOpen, onClose, onSubmit, isSubmitting = false }) {
    useBodyScrollLock(isOpen);
    const [selectedReason, setSelectedReason] = useState('');
    const [details, setDetails] = useState('');

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Reset state when opened
    useEffect(() => {
        if (isOpen) {
            setSelectedReason('');
            setDetails('');
        }
    }, [isOpen]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedReason) return;
        onSubmit(selectedReason, details);
    };

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
                        className="relative glass-panel w-full sm:max-w-md bg-claude-bg rounded-3xl shadow-2xl overflow-hidden flex flex-col z-[999]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-claude-border">
                            <div className="flex items-center gap-2 text-red-400">
                                <ShieldAlert className="w-5 h-5" />
                                <h3 className="font-display font-semibold text-lg">Report Content</h3>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 text-claude-secondary hover:text-claude-text rounded-full hover:bg-white/5 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-4 overflow-y-auto max-h-[70vh]">
                            <div className="mb-4">
                                <p className="text-sm text-claude-secondary mb-4">
                                    Please select a reason for reporting. This helps us take the appropriate action.
                                </p>

                                <div className="space-y-2">
                                    {REPORT_REASONS.map(reason => (
                                        <label
                                            key={reason.id}
                                            className={`
                                                flex flex-col p-3 rounded-xl border cursor-pointer transition-colors
                                                ${selectedReason === reason.id
                                                    ? 'border-red-500/50 bg-red-500/10'
                                                    : 'border-claude-border bg-white/5 hover:bg-white/10'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`
                                                    w-4 h-4 rounded-full border-2 flex items-center justify-center
                                                    ${selectedReason === reason.id ? 'border-red-400' : 'border-claude-secondary'}
                                                `}>
                                                    {selectedReason === reason.id && (
                                                        <div className="w-2 h-2 rounded-full bg-red-400" />
                                                    )}
                                                </div>
                                                <span className="font-medium text-claude-text">{reason.label}</span>
                                            </div>
                                            <span className="text-xs text-claude-secondary ml-7 mt-1">{reason.description}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block text-sm font-medium text-claude-secondary mb-2">
                                    Additional details (optional)
                                </label>
                                <textarea
                                    value={details}
                                    onChange={(e) => setDetails(e.target.value)}
                                    placeholder="Provide more context to help us investigate..."
                                    className="w-full bg-white/5 border border-claude-border rounded-xl p-3 text-sm text-claude-text placeholder:text-claude-tertiary focus:outline-none focus:border-red-400/50 resize-none h-24"
                                />
                            </div>

                            <div className="flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={!selectedReason || isSubmitting}
                                    className={`
                                        w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all
                                        ${!selectedReason
                                            ? 'bg-claude-border text-claude-secondary cursor-not-allowed'
                                            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                        }
                                    `}
                                >
                                    {isSubmitting ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <AlertTriangle className="w-5 h-5" />
                                            Submit Report
                                        </>
                                    )}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="w-full py-3 rounded-xl font-medium text-claude-secondary hover:text-white hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
