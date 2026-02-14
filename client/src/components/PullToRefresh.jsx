import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children, disabled = false }) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const startY = useRef(0);
    const containerRef = useRef(null);
    const THRESHOLD = 80;
    const MAX_PULL = 120;

    const handleTouchStart = useCallback((e) => {
        if (disabled || isRefreshing) return;
        // Only trigger if at top of scroll
        if (containerRef.current?.scrollTop === 0) {
            startY.current = e.touches[0].clientY;
        }
    }, [disabled, isRefreshing]);

    const handleTouchMove = useCallback((e) => {
        if (disabled || isRefreshing || startY.current === 0) return;
        
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY.current;
        
        if (diff > 0 && containerRef.current?.scrollTop === 0) {
            e.preventDefault();
            // Apply resistance
            const resistance = Math.min(diff * 0.5, MAX_PULL);
            setPullDistance(resistance);
        }
    }, [disabled, isRefreshing]);

    const handleTouchEnd = useCallback(async () => {
        if (pullDistance >= THRESHOLD && onRefresh) {
            setIsRefreshing(true);
            setPullDistance(60); // Keep showing indicator
            try {
                await onRefresh();
            } finally {
                setIsRefreshing(false);
            }
        }
        setPullDistance(0);
        startY.current = 0;
    }, [pullDistance, onRefresh]);

    const progress = Math.min(pullDistance / THRESHOLD, 1);

    return (
        <div
            ref={containerRef}
            className="relative h-full overflow-y-auto"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Pull indicator */}
            <div
                className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center transition-opacity duration-200 z-10"
                style={{
                    top: Math.max(pullDistance - 40, -40),
                    opacity: pullDistance > 10 ? 1 : 0
                }}
            >
                <div className={`w-10 h-10 rounded-full bg-claude-surface border border-claude-border flex items-center justify-center shadow-lg ${isRefreshing ? 'animate-spin' : ''}`}>
                    <RefreshCw
                        className="w-5 h-5 text-claude-accent transition-transform duration-200"
                        style={{
                            transform: `rotate(${progress * 360}deg)`
                        }}
                    />
                </div>
            </div>

            {/* Accessible status for screen readers */}
            <div className="sr-only" role="status" aria-live="polite">
                {isRefreshing ? 'Refreshing content…' : pullDistance >= THRESHOLD ? 'Release to refresh' : ''}
            </div>

            {/* Content with pull transform */}
            <div
                className="transition-transform duration-200"
                style={{
                    transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
}
