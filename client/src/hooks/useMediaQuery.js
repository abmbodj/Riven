import { useCallback, useSyncExternalStore } from 'react';

const supportsMatchMedia = () => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
);

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 * Uses useSyncExternalStore so matchMedia stays the source of truth (no
 * set-state-in-effect). SPA-only; the server snapshot is always false.
 *
 * @param {string} query e.g. '(min-width: 768px)'
 * @returns {boolean}
 */
export default function useMediaQuery(query) {
    const subscribe = useCallback((callback) => {
        if (!supportsMatchMedia()) return () => {};
        const mql = window.matchMedia(query);
        // Safari <14 only supports the deprecated addListener API.
        if (typeof mql.addEventListener === 'function') {
            mql.addEventListener('change', callback);
            return () => mql.removeEventListener('change', callback);
        }
        mql.addListener(callback);
        return () => mql.removeListener(callback);
    }, [query]);

    const getSnapshot = useCallback(
        () => (supportsMatchMedia() ? window.matchMedia(query).matches : false),
        [query],
    );

    return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
