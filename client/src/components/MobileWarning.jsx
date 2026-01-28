import React, { useState } from 'react';
import { AlertTriangle, X, Smartphone } from 'lucide-react';

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
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={handleDismiss}
        >
            <div 
                className="w-full max-w-sm bg-claude-surface rounded-3xl border border-amber-500/30 p-6 animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Icon */}
                <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Smartphone className="w-8 h-8 text-amber-500" />
                    </div>
                </div>

                {/* Title */}
                <h3 className="text-xl font-display font-bold text-center mb-2">Alpha Stage Notice</h3>

                {/* Message */}
                <p className="text-claude-secondary text-center text-sm leading-relaxed mb-6">
                    Riven is currently in Alpha. You may encounter bugs on mobile. 
                    Many features are optimized for <span className="font-semibold text-amber-500">desktop use</span>.
                </p>

                {/* Action */}
                <button
                    onClick={handleDismiss}
                    className="w-full py-4 rounded-xl font-semibold bg-amber-500 text-white active:scale-[0.97] transition-transform"
                >
                    Got it!
                </button>
            </div>
        </div>
    );
}
