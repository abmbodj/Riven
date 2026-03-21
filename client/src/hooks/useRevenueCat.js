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
import { Purchases } from '@revenuecat/purchases-capacitor';

const RC_IOS_API_KEY = import.meta.env.VITE_RC_IOS_API_KEY ?? '';

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
    const [initStatus, setInitStatus] = useState('pending');

    // ── configure + fetch offerings ────────────────────────────────────────
    useEffect(() => {
        console.log('[RevenueCat] guard check — isNative:', isNative, 'userId:', userId, 'apiKey present:', !!RC_IOS_API_KEY, 'apiKey value:', RC_IOS_API_KEY?.substring(0, 15));
        if (!isNative) { setInitStatus('skipped: not native'); return; }
        if (!userId) { setInitStatus('skipped: no userId'); return; }
        if (!RC_IOS_API_KEY) { setInitStatus('skipped: no API key'); return; }

        let cancelled = false;

        async function init() {
            try {
                console.log('[RevenueCat] init starting — userId:', userId, 'apiKey:', RC_IOS_API_KEY?.substring(0, 12) + '…');
                setInitStatus('configuring');
                
                if (!configuredRef.current) {
                    await Purchases.configure({
                        apiKey: RC_IOS_API_KEY,
                        appUserID: userId,
                    });
                    configuredRef.current = true;
                    console.log('[RevenueCat] configure() succeeded');
                }

                setInitStatus('fetching offerings');
                console.log('[RevenueCat] calling getOfferings()…');
                const offeringsResponse = await Purchases.getOfferings();
                console.log('[RevenueCat] getOfferings() raw response:', JSON.stringify(offeringsResponse, null, 2));

                const offeringsResult = offeringsResponse?.offerings;
                console.log('[RevenueCat] offerings.current:', offeringsResult?.current);
                console.log('[RevenueCat] offerings.all keys:', offeringsResult?.all ? Object.keys(offeringsResult.all) : 'N/A');

                setInitStatus('fetching customer info');
                const { customerInfo: info } = await Purchases.getCustomerInfo();
                console.log('[RevenueCat] customerInfo OK, entitlements:', JSON.stringify(info?.entitlements?.active));

                if (!cancelled) {
                    setOfferings(offeringsResult);
                    setCustomerInfo(info);
                    setError(null);
                    setInitStatus('success');
                }
            } catch (err) {
                if (!cancelled) {
                    console.error('[RevenueCat] init error:', err);
                    console.error('[RevenueCat] init error details:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
                    setError(err?.message ?? 'RevenueCat initialisation failed');
                    setInitStatus('error: ' + (err?.message ?? 'unknown'));
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
        /** Debug: tracks whether init ran and why */
        initStatus,
        purchasePackage,
        restorePurchases,
        hasEntitlement,
    };
}

export default useRevenueCat;
