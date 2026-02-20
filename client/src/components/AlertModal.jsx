import React, { useEffect, useRef } from 'react';
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle';
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle';
import Info from 'lucide-react/dist/esm/icons/info';
import XIcon from 'lucide-react/dist/esm/icons/x';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'motion/react';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

export default function AlertModal({
    isOpen,
    onClose,
    title,
    message,
    type = 'info', // 'success', 'error', 'warning', 'info'
    actionLabel,
    onAction
}) {
    // Lock body scroll when modal is open
    useBodyScrollLock(isOpen);

    const dialogRef = useRef(null);

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

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

    const icons = {
        success: <CheckCircle className="w-10 h-10 text-green-500" />,
        error: <AlertCircle className="w-10 h-10 text-red-500" />,
        warning: <AlertTriangle className="w-10 h-10 text-yellow-500" />,
        info: <Info className="w-10 h-10 text-blue-500" />
    };

    const colors = {
        success: 'bg-green-500/10 border-green-500/30',
        error: 'bg-red-500/10 border-red-500/30',
        warning: 'bg-yellow-500/10 border-yellow-500/30',
        info: 'bg-blue-500/10 border-blue-500/30'
    };

    const buttonColors = {
        success: 'bg-green-500 text-white',
        error: 'bg-red-500 text-white',
        warning: 'bg-yellow-500 text-black',
        info: 'bg-blue-500 text-white'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />

                    <motion.div
                        ref={dialogRef}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="alert-modal-title"
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="relative w-full sm:max-w-sm rounded-t-[2.5rem] sm:rounded-3xl border border-claude-border shadow-2xl p-6 overflow-hidden touch-pan-y"
                        style={{ backgroundColor: 'var(--surface-color, #162a31)' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Drag Handle for mobile */}
                        <div className="sm:hidden w-12 h-1.5 bg-claude-border rounded-full mx-auto -mt-2 mb-4" />

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className="absolute top-6 right-6 touch-target text-claude-secondary hover:text-claude-text transition-colors tap-action"
                        >
                            <XIcon className="w-6 h-6" />
                        </button>

                        {/* Icon */}
                        <div className="flex justify-center mb-6">
                            <div className={`w-20 h-20 rounded-full ${colors[type]} flex items-center justify-center`}>
                                {icons[type]}
                            </div>
                        </div>

                        {/* Title */}
                        {title && (
                            <h3 id="alert-modal-title" className="text-2xl font-display font-bold text-center mb-3 text-claude-text">{title}</h3>
                        )}

                        {/* Message */}
                        <p className="text-claude-secondary text-center text-sm leading-relaxed mb-8 px-2">
                            {message}
                        </p>

                        {/* Actions */}
                        <div className="flex flex-col gap-3">
                            {actionLabel && onAction && (
                                <button
                                    onClick={onAction}
                                    className={`w-full py-4.5 rounded-2xl font-bold ${buttonColors[type]} active:scale-[0.97] transition-transform tap-action touch-target shadow-lg`}
                                >
                                    {actionLabel}
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="w-full py-4.5 rounded-2xl font-bold bg-[#1e3840]/60 border border-[#233e46] text-claude-text active:scale-[0.97] transition-transform tap-action touch-target"
                            >
                                {actionLabel ? 'Cancel' : 'OK'}
                            </button>
                        </div>

                        {/* Safe area padding for mobile */}
                        <div className="h-safe-bottom sm:hidden mt-2" />
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
