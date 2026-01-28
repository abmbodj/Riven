import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmModal({ isOpen, title, message, confirmText = 'Delete', cancelText = 'Cancel', onConfirm, onCancel, destructive = true }) {
    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-6"
            style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px) + 16px)' }}
            onClick={(e) => {
                if (e.target === e.currentTarget) onCancel?.();
            }}
        >
            <div 
                className="bg-claude-surface w-full max-w-sm max-h-[80vh] overflow-y-auto overscroll-contain rounded-2xl animate-in zoom-in-95 duration-200"
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
                        className="flex-1 py-4 font-semibold text-claude-secondary active:bg-claude-bg transition-colors border-r border-claude-border"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`flex-1 py-4 font-semibold active:bg-claude-bg transition-colors ${
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
