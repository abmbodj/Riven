import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel, destructive = true }) {
    // Lock body scroll when modal is open
    useBodyScrollLock(isOpen);

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onCancel?.();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div 
            className="modal-overlay"
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel?.();
            }}
        >
            <div 
                className="bg-claude-surface w-full max-w-sm rounded-2xl animate-in zoom-in-95 duration-200 modal-content"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-6 text-center">
                    {destructive && (
                        <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-6 h-6 text-red-500" />
                        </div>
                    )}
                    <h3 className="text-lg font-display font-bold mb-2">{title}</h3>
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
