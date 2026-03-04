import { useState, useCallback } from 'react';
import { api } from '../api';

/**
 * Detect if running as a standalone PWA (home screen app).
 * Google Ads SDK doesn't work in standalone mode — callbacks never fire.
 */
function isStandalonePWA() {
    return window.navigator.standalone ||
        window.matchMedia('(display-mode: standalone)').matches;
}

const AD_TIMEOUT_MS = 15000; // 15 second safety timeout

/**
 * Shows a rewarded ad using Google Ad Placement API (web).
 * In dev mode or standalone PWA, skips the ad and resolves immediately.
 */
function showRewardedAd() {
    return new Promise((resolve, reject) => {
        // Skip ad in dev, when adBreak is missing, or in standalone PWA
        if (import.meta.env.DEV || !window.adBreak || isStandalonePWA()) {
            console.log('[Ad] Skipping ad (dev/standalone/unavailable)');
            resolve(true);
            return;
        }

        // Safety timeout — if Google Ads never calls back, don't hang forever
        let settled = false;
        const timeout = setTimeout(() => {
            if (!settled) {
                settled = true;
                console.warn('[Ad] Timed out waiting for ad callback');
                reject(new Error('Ad timed out. Please try again.'));
            }
        }, AD_TIMEOUT_MS);

        const settle = (fn) => (...args) => {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                fn(...args);
            }
        };

        // Production: use Google Ad Placement API
        try {
            window.adBreak({
                type: 'reward',
                name: 'rewarded_ad',
                beforeReward: (showAdFn) => {
                    showAdFn();
                },
                adViewed: settle(() => {
                    resolve(true);
                }),
                adDismissed: settle(() => {
                    reject(new Error('Ad was dismissed before completion.'));
                }),
                adBreakDone: settle((placementInfo) => {
                    if (placementInfo.breakStatus === 'notReady') {
                        reject(new Error('No ads available right now. Try again later.'));
                    }
                }),
            });
        } catch (err) {
            if (!settled) {
                settled = true;
                clearTimeout(timeout);
                reject(new Error('Failed to load ad. Try again later.'));
            }
        }
    });
}

/**
 * Hook for watching rewarded ads and claiming rewards.
 *
 * Usage:
 *   const { watchAd, loading, error } = useRewardedAd();
 *   const result = await watchAd('hearts_refill');
 */
export default function useRewardedAd() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const watchAd = useCallback(async (feature, options = {}) => {
        setLoading(true);
        setError(null);

        try {
            // 1. Request a reward token from the server
            const { rewardToken } = await api.requestAdReward(feature, options);

            // 2. Show the ad
            await showRewardedAd();

            // 3. Claim the reward
            const result = await api.claimAdReward(rewardToken);

            setLoading(false);
            return result;
        } catch (err) {
            const message = err.message || 'Failed to complete ad reward.';
            setError(message);
            setLoading(false);
            throw err;
        }
    }, []);

    return { watchAd, loading, error };
}
