// Custom hook for swipe gestures
import { useRef, useCallback } from 'react';

export function useSwipeGesture(options = {}) {
    const {
        onSwipeLeft,
        onSwipeRight,
        onSwipeUp,
        onSwipeDown,
        threshold = 50,
        preventDefault = false
    } = options;

    const touchStartRef = useRef({ x: 0, y: 0 });
    const touchEndRef = useRef({ x: 0, y: 0 });

    const handleTouchStart = useCallback((e) => {
        const touch = e.touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }, []);

    const handleTouchMove = useCallback((e) => {
        if (preventDefault) {
            e.preventDefault();
        }
        const touch = e.touches[0];
        touchEndRef.current = { x: touch.clientX, y: touch.clientY };
    }, [preventDefault]);

    const handleTouchEnd = useCallback(() => {
        const deltaX = touchEndRef.current.x - touchStartRef.current.x;
        const deltaY = touchEndRef.current.y - touchStartRef.current.y;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);

        // Horizontal swipe
        if (absX > absY && absX > threshold) {
            if (deltaX > 0) {
                onSwipeRight?.();
            } else {
                onSwipeLeft?.();
            }
        }
        // Vertical swipe
        else if (absY > absX && absY > threshold) {
            if (deltaY > 0) {
                onSwipeDown?.();
            } else {
                onSwipeUp?.();
            }
        }

        // Reset
        touchStartRef.current = { x: 0, y: 0 };
        touchEndRef.current = { x: 0, y: 0 };
    }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, threshold]);

    return {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd
    };
}

export default useSwipeGesture;
