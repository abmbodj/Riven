import React, { useEffect, useRef } from 'react';
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle';
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

    if (!isOpen) return null;

    return (
        <div 
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel?.();
            }}
        >
            <div 
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="confirm-modal-title"
                className="bg-claude-surface w-full max-w-sm rounded-2xl animate-in zoom-in-95 duration-200 modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 text-center">
                    {destructive && (
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                    )}
                    <h3 id="confirm-modal-title" className="text-lg font-display font-bold mb-2">{title}</h3>
                    <p className="text-claude-secondary text-sm">{message}</p>
                </div>
                <div className="flex border-t border-claude-border">
                    <button
                        onClick={onCancel}
                        className="flex-1 py-4 font-semibold text-claude-secondary active:bg-claude-bg transition-colors border-r border-claude-border tap-action touch-target"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-4 font-semibold active:bg-claude-bg transition-colors tap-action touch-target ${
                            destructive ? 'text-red-500' : 'text-claude-accent'
                        }`}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );
}
