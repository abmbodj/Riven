import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function MobileWarning() {
    const [isVisible, setIsVisible] = useState(() => {
        // Initialize state synchronously to avoid effect setState issues
        if (typeof window === 'undefined') return false;
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        const isDismissed = sessionStorage.getItem('mobile-warning-dismissed');
        return isMobile && !isDismissed;
    });

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('mobile-warning-dismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="bg-amber-500 text-white px-4 py-3 relative z-[100] animate-in slide-in-from-top duration-500">
            <div className="max-w-5xl mx-auto flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="flex-1 pr-8">
                    <p className="text-sm font-bold mb-0.5">Alpha Stage Notice</p>
                    <p className="text-xs text-white/90 leading-relaxed">
                        Riven is currently in Alpha. You may encounter bugs on mobile.
                        Many features are currently optimized for <span className="font-bold underline">desktop use</span>.
                    </p>
                </div>
                <button
                    onClick={handleDismiss}
                    className="absolute right-2 top-2 p-2 hover:bg-white/20 rounded-full transition-colors"
                    aria-label="Dismiss warning"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
