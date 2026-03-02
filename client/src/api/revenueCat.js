/**
 * RevenueCat Web SDK wrapper for Riven.
 *
 * Uses @revenuecat/purchases-js for Stripe-powered payments
 * on the web / PWA. When the env var is missing (local dev),
 * every function gracefully no-ops so the UI never crashes.
 */
import { Purchases, ErrorCode } from '@revenuecat/purchases-js';

const API_KEY = import.meta.env.VITE_REVENUECAT_WEB_API_KEY || '';

let configured = false;

// ── Initialise ──────────────────────────────────────────────
export function initRevenueCat(appUserId) {
    if (typeof window !== 'undefined') {
        window.RC_DEBUG = {
            apiKeyPresent: !!API_KEY,
            configured: false,
            lastError: null,
            offerings: null
        };
    }

    if (!API_KEY) {
        console.warn('[RevenueCat] No API key found in VITE_REVENUECAT_WEB_API_KEY. SDK will not initialize.');
        return;
    }
    if (configured) return;

    try {
        Purchases.configure(API_KEY, String(appUserId));
        configured = true;
        if (window.RC_DEBUG) window.RC_DEBUG.configured = true;
        console.info('[RevenueCat] SDK configured for user', appUserId);
    } catch (err) {
        if (window.RC_DEBUG) window.RC_DEBUG.lastError = err;
        console.error('[RevenueCat] configure() failed:', err);
    }
}

// ── Offerings ───────────────────────────────────────────────
export async function getOfferings() {
    if (!configured) return null;
    try {
        const offerings = await Purchases.getSharedInstance().getOfferings({ currency: 'USD' });
        if (window.RC_DEBUG) window.RC_DEBUG.offerings = offerings;
        return offerings;
    } catch (err) {
        if (window.RC_DEBUG) window.RC_DEBUG.lastError = err;
        console.error('[RevenueCat] getOfferings() failed:', err);
        return null;
    }
}

// ── Purchase ────────────────────────────────────────────────
/**
 * @param {object} rcPackage – a Package object from offerings.current
 * @returns {{ customerInfo: object } | null}
 */
export async function purchase(rcPackage) {
    if (!configured) {
        console.warn('[RevenueCat] SDK not configured – purchase stubbed.');
        return null;
    }
    // purchase() opens the Stripe checkout and resolves on success
    return await Purchases.getSharedInstance().purchase({ rcPackage });
}

// ── Customer info / entitlement check ───────────────────────
export async function getCustomerInfo() {
    if (!configured) return null;
    try {
        return await Purchases.getSharedInstance().getCustomerInfo();
    } catch (err) {
        console.error('[RevenueCat] getCustomerInfo() failed:', err);
        return null;
    }
}

// ── Restore (web = re-fetch entitlements from server) ───────
export async function restorePurchases() {
    return getCustomerInfo();
}

// Re-export ErrorCode so PricingModal can detect cancellations
export { ErrorCode };
