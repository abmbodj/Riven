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

/**
 * @typedef {'wisp' | 'orb' | 'small' | 'medium' | 'full'} GhostStage
 */

import { useState, useEffect, useCallback, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import * as authApi from '../api/authApi';

const STORAGE_KEY = 'riven_streak_data';
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

/**
 * Calculate hours remaining until streak breaks
 * @param {string|null} lastStudyDate 
 * @returns {number}
 */
const getHoursRemaining = (lastStudyDate) => {
    if (!lastStudyDate) return 0;
    const last = new Date(lastStudyDate);
    const deadline = new Date(last.getTime() + (2 * MS_PER_DAY)); // 48 hours to maintain streak
    const now = new Date();
    return Math.max(0, (deadline.getTime() - now.getTime()) / MS_PER_HOUR);
};

/**
 * Get ghost stage based on streak days
 * @param {number} streak 
 * @returns {GhostStage}
 */
const getGhostStage = (streak) => {
    if (streak <= 3) return 'wisp';
    if (streak <= 7) return 'orb';
    if (streak <= 14) return 'small';
    if (streak <= 30) return 'medium';
    return 'full';
};

/**
 * Get streak status
 * @param {string|null} lastStudyDate 
 * @returns {StreakStatus}
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
 * @param {string|null} lastStudyDate 
 * @returns {boolean}
 */
const hasStudiedToday = (lastStudyDate) => {
    if (!lastStudyDate) return false;
    const last = new Date(lastStudyDate);
    const now = new Date();
    return last.toDateString() === now.toDateString();
};

/**
 * Custom hook for managing study streak
 * @returns {Object}
 */
export function useStreak() {
    const authContext = useContext(AuthContext);
    const user = authContext?.user;
    const isLoggedIn = authContext?.isLoggedIn && !user?.isAdmin;

    const [streakData, setStreakData] = useState(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (e) {
            console.error('Failed to load streak data:', e);
        }
        return {
            currentStreak: 0,
            longestStreak: 0,
            lastStudyDate: null,
            streakStartDate: null,
            pastStreaks: []
        };
    });

    // Sync streak data from server when user logs in
    useEffect(() => {
        if (isLoggedIn) {
            authApi.getStreak()
                .then(serverData => {
                    if (serverData && (serverData.currentStreak || serverData.longestStreak || serverData.lastStudyDate)) {
                        setStreakData(serverData);
                        localStorage.setItem(STORAGE_KEY, JSON.stringify(serverData));
                    }
                })
                .catch(err => console.error('Failed to fetch streak from server:', err));
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

            return {
                ...prev,
                currentStreak: 0,
                streakStartDate: null,
                pastStreaks: [memorial, ...prev.pastStreaks].slice(0, 10) // Keep last 10
            };
        });
    }, []);

    // Persist to localStorage and sync to server
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(streakData));
            // Sync to server if logged in
            if (isLoggedIn) {
                authApi.updateStreak(streakData).catch(err => 
                    console.error('Failed to sync streak to server:', err)
                );
            }
        } catch (e) {
            console.error('Failed to save streak data:', e);
        }
    }, [streakData, isLoggedIn]);

    // Check for broken streak on mount and periodically
    useEffect(() => {
        const checkStreak = () => {
            const status = calculateStatus(streakData.lastStudyDate);
            if (status === 'broken' && streakData.currentStreak > 0) {
                breakStreak();
            }
        };

        checkStreak();
        const interval = setInterval(checkStreak, 60000); // Check every minute
        return () => clearInterval(interval);
    }, [streakData.lastStudyDate, streakData.currentStreak, breakStreak]);

    /**
     * Increment the streak (call when user completes a study session)
     */
    const incrementStreak = useCallback(() => {
        setStreakData(prev => {
            // Don't increment if already studied today
            if (hasStudiedToday(prev.lastStudyDate)) {
                return { ...prev, lastStudyDate: new Date().toISOString() };
            }

            const status = calculateStatus(prev.lastStudyDate);
            const now = new Date().toISOString();
            
            // If streak was broken, start fresh
            if (status === 'broken' || prev.currentStreak === 0) {
                return {
                    ...prev,
                    currentStreak: 1,
                    lastStudyDate: now,
                    streakStartDate: now,
                    longestStreak: Math.max(prev.longestStreak, 1)
                };
            }

            // Continue streak
            const newStreak = prev.currentStreak + 1;
            return {
                ...prev,
                currentStreak: newStreak,
                lastStudyDate: now,
                longestStreak: Math.max(prev.longestStreak, newStreak)
            };
        });
    }, []);

    /**
     * Reset all streak data (for testing)
     */
    const resetStreak = useCallback(() => {
        setStreakData({
            currentStreak: 0,
            longestStreak: 0,
            lastStudyDate: null,
            streakStartDate: null,
            pastStreaks: []
        });
    }, []);

    const getStreakStatus = useCallback(() => {
        return {
            status: calculateStatus(streakData.lastStudyDate),
            hoursRemaining: getHoursRemaining(streakData.lastStudyDate),
            stage: getGhostStage(streakData.currentStreak),
            studiedToday: hasStudiedToday(streakData.lastStudyDate)
        };
    }, [streakData.lastStudyDate, streakData.currentStreak]);

    return {
        currentStreak: streakData.currentStreak,
        longestStreak: streakData.longestStreak,
        lastStudyDate: streakData.lastStudyDate,
        pastStreaks: streakData.pastStreaks,
        streakStartDate: streakData.streakStartDate,
        ghostStage: getGhostStage(streakData.currentStreak),
        status: calculateStatus(streakData.lastStudyDate),
        hoursRemaining: getHoursRemaining(streakData.lastStudyDate),
        studiedToday: hasStudiedToday(streakData.lastStudyDate),
        incrementStreak,
        breakStreak,
        resetStreak,
        getStreakStatus
    };
}

export { getGhostStage, calculateStatus, getHoursRemaining };
