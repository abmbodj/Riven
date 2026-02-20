/**
 * @typedef {Object} StreakData
 * @property {number} currentStreak - Current streak count in days
 * @property {number} longestStreak - Longest streak ever achieved
 * @property {string|null} lastStudyDate - ISO date string of last study
 * @property {string|null} streakStartDate - ISO date string when streak started
 * @property {Array<{streak: number, startDate: string, endDate: string}>} pastStreaks - Memorial of past streaks
 */

/**
 * @typedef {'active' | 'at-risk' | 'broken'} StreakStatus
 */

import { useState, useEffect, useCallback, useContext, useMemo, useRef } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as authApi from '../api/authApi';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

const emptyStreak = {
    currentStreak: 0,
    longestStreak: 0,
    lastStudyDate: null,
    streakStartDate: null,
    pastStreaks: []
};

/**
 * Calculate hours remaining until streak breaks
 */
const getHoursRemaining = (lastStudyDate) => {
    if (!lastStudyDate) return 0;
    const last = new Date(lastStudyDate);
    const deadline = new Date(last.getTime() + (2 * MS_PER_DAY));
    const now = new Date();
    return Math.max(0, (deadline.getTime() - now.getTime()) / MS_PER_HOUR);
};

/**
 * Get streak status
 */
const calculateStatus = (lastStudyDate) => {
    if (!lastStudyDate) return 'broken';
    const hoursRemaining = getHoursRemaining(lastStudyDate);
    if (hoursRemaining <= 0) return 'broken';
    if (hoursRemaining <= 24) return 'at-risk';
    return 'active';
};

/**
 * Check if user studied today
 */
const hasStudiedToday = (lastStudyDate) => {
    if (!lastStudyDate) return false;
    const last = new Date(lastStudyDate);
    const now = new Date();
    return last.toDateString() === now.toDateString();
};

/**
 * Custom hook for managing study streak — server-only (requires auth)
 */
export function useStreak() {
    const authContext = useContext(AuthContext);
    const isLoggedIn = authContext?.isLoggedIn;

    const [streakData, setStreakData] = useState(emptyStreak);
    const [loaded, setLoaded] = useState(false);
    const syncedRef = useRef(false);

    // Fetch streak data from server when logged in
    useEffect(() => {
        if (!isLoggedIn) {
            setTimeout(() => {
                setStreakData(emptyStreak);
                setLoaded(true);
            }, 0);
            syncedRef.current = false;
            return;
        }

        if (syncedRef.current) return;
        syncedRef.current = true;

        authApi.getStreak()
            .then(serverData => {
                if (serverData && (serverData.currentStreak !== undefined || serverData.longestStreak || serverData.lastStudyDate)) {
                    setStreakData({
                        currentStreak: serverData.currentStreak || 0,
                        longestStreak: serverData.longestStreak || 0,
                        lastStudyDate: serverData.lastStudyDate || null,
                        streakStartDate: serverData.streakStartDate || null,
                        pastStreaks: serverData.pastStreaks || []
                    });
                }
            })
            .catch(() => { })
            .finally(() => setLoaded(true));
    }, [isLoggedIn]);

    // Persist to server helper
    const saveToServer = useCallback((data) => {
        if (isLoggedIn) {
            authApi.updateStreak(data).catch(() => { });
        }
    }, [isLoggedIn]);

    /**
     * Break the streak and save to memorial
     */
    const breakStreak = useCallback(() => {
        setStreakData(prev => {
            if (prev.currentStreak === 0) return prev;

            const memorial = {
                streak: prev.currentStreak,
                startDate: prev.streakStartDate,
                endDate: prev.lastStudyDate
            };

            const updated = {
                ...prev,
                currentStreak: 0,
                streakStartDate: null,
                pastStreaks: [memorial, ...prev.pastStreaks].slice(0, 10)
            };
            saveToServer(updated);
            return updated;
        });
    }, [saveToServer]);

    // Check for broken streak on mount and periodically
    useEffect(() => {
        if (!isLoggedIn || !loaded) return;

        const checkStreak = () => {
            const status = calculateStatus(streakData.lastStudyDate);
            if (status === 'broken' && streakData.currentStreak > 0) {
                breakStreak();
            }
        };

        checkStreak();
        const interval = setInterval(checkStreak, 60000);
        return () => clearInterval(interval);
    }, [streakData.lastStudyDate, streakData.currentStreak, breakStreak, isLoggedIn, loaded]);

    /**
     * Increment the streak (call when user completes a study session)
     */
    const incrementStreak = useCallback(() => {
        if (!isLoggedIn) return;

        setStreakData(prev => {
            if (hasStudiedToday(prev.lastStudyDate)) {
                const updated = { ...prev, lastStudyDate: new Date().toISOString() };
                saveToServer(updated);
                return updated;
            }

            const status = calculateStatus(prev.lastStudyDate);
            const now = new Date().toISOString();

            let updated;
            if (status === 'broken' || prev.currentStreak === 0) {
                updated = {
                    ...prev,
                    currentStreak: 1,
                    lastStudyDate: now,
                    streakStartDate: now,
                    longestStreak: Math.max(prev.longestStreak, 1)
                };
            } else {
                const newStreak = prev.currentStreak + 1;
                updated = {
                    ...prev,
                    currentStreak: newStreak,
                    lastStudyDate: now,
                    longestStreak: Math.max(prev.longestStreak, newStreak)
                };
            }

            saveToServer(updated);
            return updated;
        });
    }, [isLoggedIn, saveToServer]);

    /**
     * Reset all streak data
     */
    const resetStreak = useCallback(() => {
        if (!isLoggedIn) return;
        setStreakData(emptyStreak);
        saveToServer(emptyStreak);
    }, [isLoggedIn, saveToServer]);

    const getStreakStatus = useCallback(() => {
        return {
            status: calculateStatus(streakData.lastStudyDate),
            hoursRemaining: getHoursRemaining(streakData.lastStudyDate),
            studiedToday: hasStudiedToday(streakData.lastStudyDate)
        };
    }, [streakData.lastStudyDate]);

    return useMemo(() => ({
        currentStreak: streakData.currentStreak,
        longestStreak: streakData.longestStreak,
        lastStudyDate: streakData.lastStudyDate,
        pastStreaks: streakData.pastStreaks,
        streakStartDate: streakData.streakStartDate,
        status: calculateStatus(streakData.lastStudyDate),
        hoursRemaining: getHoursRemaining(streakData.lastStudyDate),
        studiedToday: hasStudiedToday(streakData.lastStudyDate),
        loaded,
        incrementStreak,
        breakStreak,
        resetStreak,
        getStreakStatus
    }), [streakData, loaded, incrementStreak, breakStreak, resetStreak, getStreakStatus]);
}

export { calculateStatus, getHoursRemaining };
