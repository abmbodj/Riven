import { useState, useCallback } from 'react';
import { api } from '../api';

/**
 * Shows a rewarded ad using Google Ad Placement API (web).
 * In development, shows a mock ad that auto-completes after 3 seconds.
 */
function showRewardedAd() {
    return new Promise((resolve, reject) => {
        // Development mock: simulate a 3-second ad
        if (import.meta.env.DEV || !window.adBreak) {
            console.log('[Ad] Showing mock rewarded ad (dev mode)...');
            const timer = setTimeout(() => {
                console.log('[Ad] Mock ad completed.');
                resolve(true);
            }, 3000);
            // Store timer for cleanup if needed
            window.__mockAdTimer = timer;
            return;
        }

        // Production: use Google Ad Placement API
        try {
            window.adBreak({
                type: 'reward',
                name: 'rewarded_ad',
                beforeReward: (showAdFn) => {
                    showAdFn();
                },
                adViewed: () => {
                    resolve(true);
                },
                adDismissed: () => {
                    reject(new Error('Ad was dismissed before completion.'));
                },
                adBreakDone: (placementInfo) => {
                    if (placementInfo.breakStatus === 'notReady') {
                        reject(new Error('No ads available right now. Try again later.'));
                    }
                },
            });
        } catch (err) {
            reject(new Error('Failed to load ad. Try again later.'));
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
