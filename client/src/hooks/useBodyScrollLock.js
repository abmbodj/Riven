// Hook to lock body scroll when modals are open (prevents iOS bounce)
import { useEffect } from 'react';

let lockCount = 0;
let originalOverflow = '';

export function useBodyScrollLock(isLocked) {
    useEffect(() => {
        if (!isLocked) return;

        // Store original overflow on first lock
        if (lockCount === 0) {
            originalOverflow = document.body.style.overflow;
        }

        lockCount++;
        document.body.classList.add('modal-open');
        document.body.style.overflow = 'hidden';

        // Prevent touchmove on body
        const preventScroll = (e) => {
            // Allow scrolling inside modal content
            if (e.target.closest('.modal-scroll-content')) {
                return;
            }
            e.preventDefault();
        };

        document.body.addEventListener('touchmove', preventScroll, { passive: false });

        return () => {
            lockCount--;
            document.body.removeEventListener('touchmove', preventScroll);

            if (lockCount === 0) {
                document.body.classList.remove('modal-open');
                document.body.style.overflow = originalOverflow;
            }
        };
    }, [isLocked]);
}

// Standalone function for use outside React
export function lockBodyScroll() {
    if (lockCount === 0) {
        originalOverflow = document.body.style.overflow;
    }
    lockCount++;
    document.body.classList.add('modal-open');
    document.body.style.overflow = 'hidden';
}

export function unlockBodyScroll() {
    lockCount--;
    if (lockCount === 0) {
        document.body.classList.remove('modal-open');
        document.body.style.overflow = originalOverflow;
    }
}

export default useBodyScrollLock;
