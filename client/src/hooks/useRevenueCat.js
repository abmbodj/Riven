/**
 * useRevenueCat — native iOS in-app purchase hook via RevenueCat.
 *
 * On native (Capacitor) platforms this configures the Purchases SDK and
 * exposes purchase / restore helpers.  On web / PWA it returns null values
 * so callers can fall back to the Stripe checkout path.
 *
 * Usage
 * ─────
 * const { isNative, offerings, purchasePackage, restorePurchases } = useRevenueCat(userId);
 *
 * Environment
 * ───────────
 * VITE_RC_IOS_API_KEY   RevenueCat iOS public API key (appl_xxxxx)
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';

const RC_IOS_API_KEY = import.meta.env.VITE_RC_IOS_API_KEY ?? '';

/** Lazy-import so the native module is never bundled into the web build. */
async function getPurchases() {
    const mod = await import('@revenuecat/purchases-capacitor');
    return mod.Purchases;
}

/**
 * @param {string|null} userId — the logged-in user's app user ID (e.g. Supabase auth UUID).
 *   Pass null / undefined until the user is known; the hook will not configure until it's set.
 */
export function useRevenueCat(userId) {
    const isNative = Capacitor.isNativePlatform();
    const configuredRef = useRef(false);

    const [offerings, setOfferings] = useState(null);
    const [customerInfo, setCustomerInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // ── configure + fetch offerings ────────────────────────────────────────
    useEffect(() => {
        if (!isNative || !userId || !RC_IOS_API_KEY) return;

        let cancelled = false;

        async function init() {
            try {
                const Purchases = await getPurchases();

                if (!configuredRef.current) {
                    await Purchases.configure({
                        apiKey: RC_IOS_API_KEY,
                        appUserID: userId,
                    });
                    configuredRef.current = true;
                }

                const { offerings: offeringsResult } = await Purchases.getOfferings();
                const { customerInfo: info } = await Purchases.getCustomerInfo();

                if (!cancelled) {
                    setOfferings(offeringsResult);
                    setCustomerInfo(info);
                    setError(null);
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('[RevenueCat] init error:', err);
                    setError(err?.message ?? 'RevenueCat initialisation failed');
                }
            }
        }

        init();

        return () => {
            cancelled = true;
        };
    }, [isNative, userId]);

    // ── purchasePackage ────────────────────────────────────────────────────
    /**
     * Purchase a RevenueCat Package.
     * @param {import('@revenuecat/purchases-capacitor').PurchasesPackage} pkg
     * @returns {{ customerInfo: object }|null}
     */
    const purchasePackage = useCallback(
        async (pkg) => {
            if (!isNative) return null;
            setLoading(true);
            setError(null);
            try {
                const Purchases = await getPurchases();
                const result = await Purchases.purchasePackage({ aPackage: pkg });
                setCustomerInfo(result.customerInfo);
                return result;
            } catch (err) {
                // PURCHASE_CANCELLED (code 1) is not a real error
                if (err?.code !== 1) {
                    console.error('[RevenueCat] purchasePackage error:', err);
                    setError(err?.message ?? 'Purchase failed');
                }
                return null;
            } finally {
                setLoading(false);
            }
        },
        [isNative]
    );

    // ── restorePurchases ───────────────────────────────────────────────────
    /**
     * Restore previous purchases for the current Apple ID.
     * @returns {{ customerInfo: object }|null}
     */
    const restorePurchases = useCallback(async () => {
        if (!isNative) return null;
        setLoading(true);
        setError(null);
        try {
            const Purchases = await getPurchases();
            const result = await Purchases.restorePurchases();
            setCustomerInfo(result.customerInfo);
            return result;
        } catch (err) {
            console.error('[RevenueCat] restorePurchases error:', err);
            setError(err?.message ?? 'Restore failed');
            return null;
        } finally {
            setLoading(false);
        }
    }, [isNative]);

    // ── helpers ────────────────────────────────────────────────────────────

    /**
     * Returns true when the given entitlement is active in the latest customerInfo.
     * @param {string} entitlementId  e.g. 'premium'
     */
    const hasEntitlement = useCallback(
        (entitlementId) => {
            return !!customerInfo?.entitlements?.active?.[entitlementId];
        },
        [customerInfo]
    );

    return {
        /** true when running as a native Capacitor app */
        isNative,
        /** RevenueCat Offerings object (null until loaded) */
        offerings,
        /** Latest CustomerInfo (null until loaded) */
        customerInfo,
        /** true while a purchase or restore is in-flight */
        loading,
        /** Error string or null */
        error,
        purchasePackage,
        restorePurchases,
        hasEntitlement,
    };
}

export default useRevenueCat;
