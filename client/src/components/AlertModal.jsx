import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';
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

    // Close on escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e) => {
            if (e.key === 'Escape') onClose?.();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

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
        <div 
            className="modal-overlay animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div 
                className={`relative w-full max-w-sm rounded-3xl border ${colors[type]} p-6 animate-in zoom-in-95 duration-200 modal-content`}
                style={{ backgroundColor: 'var(--surface-color)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Close button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 touch-target text-claude-secondary hover:text-claude-text transition-colors tap-action"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className={`w-16 h-16 rounded-full ${colors[type]} flex items-center justify-center`}>
                        {icons[type]}
                    </div>
                </div>

                {/* Title */}
                {title && (
                    <h3 className="text-xl font-display font-bold text-center mb-2">{title}</h3>
                )}

                {/* Message */}
                <p className="text-claude-secondary text-center text-sm leading-relaxed mb-6">
                    {message}
                </p>

                {/* Actions */}
                <div className="flex flex-col gap-3">
                    {actionLabel && onAction && (
                        <button
                            onClick={onAction}
                            className={`w-full py-4 rounded-xl font-semibold ${buttonColors[type]} active:scale-[0.97] transition-transform tap-action touch-target`}
                        >
                            {actionLabel}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-xl font-semibold bg-claude-surface border border-claude-border active:scale-[0.97] transition-transform tap-action touch-target"
                    >
                        {actionLabel ? 'Cancel' : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
}
