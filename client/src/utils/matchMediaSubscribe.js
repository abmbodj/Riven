/**
 * Subscribe to MediaQueryList changes. Uses addEventListener when available,
 * otherwise falls back to legacy addListener/removeListener (older Safari, some WebViews).
 * @param {MediaQueryList} mq
 * @param {() => void} handler
 * @returns {() => void} unsubscribe
 */
export function subscribeMediaQueryList(mq, handler) {
    if (typeof mq.addEventListener === 'function') {
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
}
