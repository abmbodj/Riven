/**
 * Dispatches optional product-analytics hooks for the onboarding funnel.
 * Listen: window.addEventListener('riven:onboarding', (e) => { ... e.detail })
 */
export function trackOnboarding(name, payload = {}) {
    if (typeof window === 'undefined') return;
    try {
        window.dispatchEvent(new CustomEvent('riven:onboarding', {
            detail: { name, payload, ts: Date.now() },
        }));
    } catch {
        /* ignore */
    }
}
