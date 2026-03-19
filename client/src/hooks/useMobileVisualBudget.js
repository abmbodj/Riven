import { useSyncExternalStore } from 'react';

const MOBILE_MQ = '(max-width: 767px)';
const COARSE_MQ = '(pointer: coarse)';

function subscribeMobile(cb) {
    const m1 = window.matchMedia(MOBILE_MQ);
    const m2 = window.matchMedia(COARSE_MQ);
    const handler = () => cb();
    m1.addEventListener('change', handler);
    m2.addEventListener('change', handler);
    return () => {
        m1.removeEventListener('change', handler);
        m2.removeEventListener('change', handler);
    };
}

function getMobileVisualBudgetSnapshot() {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(MOBILE_MQ).matches || window.matchMedia(COARSE_MQ).matches;
}

/**
 * True on narrow viewports or coarse pointers (phones, tablets, Capacitor WebView).
 * Use to skip heavy animations and reduce GSAP / particle work.
 */
export function useMobileVisualBudget() {
    return useSyncExternalStore(subscribeMobile, getMobileVisualBudgetSnapshot, () => false);
}

/** For non-React modules (e.g. one-off checks). */
export function getMobileVisualBudget() {
    if (typeof window === 'undefined') return false;
    return getMobileVisualBudgetSnapshot();
}
