import React from 'react';

export default function LoadingSpinner({ size = 'md', className = '' }) {
    const sizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-8 h-8',
        lg: 'w-12 h-12',
        xl: 'w-16 h-16'
    };

    return (
        <div role="status" aria-label="Loading" className={`flex items-center justify-center ${className}`}>
            <div className={`${sizeClasses[size]} animate-spin`}>
                <svg
                    className="w-full h-full text-claude-accent"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                >
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                </svg>
            </div>
        </div>
    );
}

// Full page loading overlay
export function LoadingOverlay({ message = 'Loading...' }) {
    return (
        <div role="status" aria-label={message} className="fixed inset-0 bg-claude-bg/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center gap-4">
            <LoadingSpinner size="xl" />
            <p className="text-claude-secondary text-sm">{message}</p>
        </div>
    );
}
