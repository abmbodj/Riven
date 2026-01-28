import React from 'react';
import { AlertCircle, CheckCircle, Info, X, AlertTriangle } from 'lucide-react';

export default function AlertModal({ 
    isOpen, 
    onClose, 
    title, 
    message, 
    type = 'info', // 'success', 'error', 'warning', 'info'
    actionLabel,
    onAction
}) {
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
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200"
            style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
            onClick={onClose}
        >
            <div 
                className={`w-full max-w-sm max-h-[80vh] overflow-y-auto overscroll-contain rounded-3xl border ${colors[type]} p-6 animate-in zoom-in-95 duration-200`}
                style={{ backgroundColor: 'var(--surface-color)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Close button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-claude-secondary hover:text-claude-text transition-colors"
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
                            className={`w-full py-4 rounded-xl font-semibold ${buttonColors[type]} active:scale-[0.97] transition-transform`}
                        >
                            {actionLabel}
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-xl font-semibold bg-claude-surface border border-claude-border active:scale-[0.97] transition-transform"
                    >
                        {actionLabel ? 'Cancel' : 'OK'}
                    </button>
                </div>
            </div>
        </div>
    );
}
