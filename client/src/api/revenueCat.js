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
            apiKeyStart: API_KEY ? API_KEY.substring(0, 7) : 'none',
            appUserId: appUserId,
            configured: false,
            lastError: null,
            offerings: null
        };
        console.log('[RevenueCat] Initializing with User ID:', appUserId);
        if (API_KEY && !API_KEY.startsWith('rcb_')) {
            console.error('[RevenueCat] WARNING: Your API Key does not start with "rcb_". It might be a Stripe key instead of a RevenueCat Web Billing key.');
        }
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
        console.info('[RevenueCat] SDK configured successfully.');
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

// ── Management Interface ────────────────────────────────────
/**
 * Opens the Stripe Customer Portal (managementURL) in a new tab.
 * Requires "RevenueCat Web Billing" and "Stripe Customer Portal" to be configured.
 */
export async function manageSubscription() {
    if (!configured) return;
    try {
        const customerInfo = await getCustomerInfo();
        if (customerInfo?.managementURL) {
            window.open(customerInfo.managementURL, '_blank');
        } else {
            console.warn('[RevenueCat] No management URL found. Ensure Stripe Customer Portal is configured.');
            alert("No subscription management link found. Please go to your email or Stripe to manage your plan.");
        }
    } catch (err) {
        console.error('[RevenueCat] manageSubscription failed:', err);
    }
}

// ── Restore (web = re-fetch entitlements from server) ───────
export async function restorePurchases() {
    return getCustomerInfo();
}

export function isConfigured() {
    return configured;
}

// Re-export ErrorCode so PricingModal can detect cancellations
export { ErrorCode };
