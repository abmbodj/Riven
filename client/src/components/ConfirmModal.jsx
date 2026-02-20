import React, { useEffect, useRef } from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel, destructive = true }) {
    // Lock body scroll when modal is open
    useBodyScrollLock(isOpen);

    const dialogRef = useRef(null);

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onCancel?.();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);

    // Focus trap: move focus into dialog on open and trap it
    useEffect(() => {
        if (!isOpen || !dialogRef.current) return;
        const dialog = dialogRef.current;
        const previouslyFocused = document.activeElement;
        const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
        const focusableEls = dialog.querySelectorAll(focusableSelector);
        if (focusableEls.length) focusableEls[0].focus();

        const handleTab = (e) => {
            if (e.key !== 'Tab') return;
            const focusable = dialog.querySelectorAll(focusableSelector);
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };
        dialog.addEventListener('keydown', handleTab);
        return () => {
            dialog.removeEventListener('keydown', handleTab);
            if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
        };
    }, [isOpen]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onCancel}
                    />

                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="confirm-modal-title"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative bg-claude-surface w-full sm:max-w-sm rounded-t-[2.5rem] sm:rounded-2xl shadow-2xl overflow-hidden touch-pan-y"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag Handle for mobile */}
                        <div className="sm:hidden w-12 h-1.5 bg-claude-border rounded-full mx-auto mt-3 mb-1" />

                        <div className="p-6 text-center">
                            {destructive && (
                                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertTriangle className="w-6 h-6 text-red-500" />
                                </div>
                            )}
                            <h3 id="confirm-modal-title" className="text-xl font-display font-bold mb-2">{title}</h3>
                            <p className="text-claude-secondary text-sm leading-relaxed">{message}</p>
                        </div>

                        <div className="flex flex-col sm:flex-row border-t border-claude-border bg-claude-bg/50">
                            <button
                                onClick={onCancel}
                                className="flex-1 py-4.5 sm:py-4 font-semibold text-claude-secondary active:bg-claude-bg transition-colors sm:border-r border-claude-border tap-action touch-target order-2 sm:order-1"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`flex-1 py-4.5 sm:py-4 font-semibold active:bg-claude-bg transition-colors tap-action touch-target order-1 sm:order-2 ${destructive ? 'text-red-500' : 'text-claude-accent'
                                    }`}
                            >
                                {confirmText}
                            </button>
                        </div>

                        {/* Safe area padding for mobile */}
                        <div className="h-safe-bottom sm:hidden" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
