import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as authApi from '../api/authApi';
import { supabase } from '../lib/supabaseClient';
import { clearOnboardingDoneClient, markOnboardingDoneClient } from '../utils/onboardingGate';
import { getStoredPushInstallationId } from '../utils/pushNotifications.js';
import { AuthContext, AuthActionsContext, AuthStatusContext } from './authContextDef';

// Re-export for convenience
export { AuthContext, AuthActionsContext, AuthStatusContext };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pendingTwoFactor, setPendingTwoFactor] = useState(null);

    // Ref to avoid stale closures in callbacks — lets us remove `user` from dependency arrays
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    useEffect(() => {
        if (user?.id && user.onboardingCompletedAt) {
            markOnboardingDoneClient(user.id);
        }
    }, [user?.id, user?.onboardingCompletedAt]);

    // Initial Session Check
    useEffect(() => {
        const initAuth = async () => {
            try {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Auth initialization timed out')), 10000)
                );
                const userData = await Promise.race([
                    authApi.restoreSessionUser(),
                    timeoutPromise,
                ]);
                if (userData?.require2FA) {
                    setPendingTwoFactor(userData);
                    setUser(null);
                } else if (userData && userData.id) {
                    setPendingTwoFactor(null);
                    const next = await authApi.hydrateUserIfOnboardingMissing(userData);
                    setUser(next);
                } else {
                    setPendingTwoFactor(null);
                    setUser(null);
                }
            } catch (err) {
                console.warn('[AuthContext] Session check failed:', err);
                if (
                    err.code === authApi.AUTH_SESSION_EXPIRED_CODE
                    || err.status === 401
                    || err.status === 403
                    || (err.message && (err.message.includes('401') || err.message.includes('403')))
                ) {
                    authApi.setToken(null);
                    setPendingTwoFactor(null);
                    setUser(null);
                }
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    useEffect(() => {
        const handleAuthExpired = () => {
            authApi.setToken(null);
            setPendingTwoFactor(null);
            setUser(null);
            setLoading(false);
        };

        window.addEventListener(authApi.AUTH_SESSION_EXPIRED_EVENT, handleAuthExpired);
        return () => window.removeEventListener(authApi.AUTH_SESSION_EXPIRED_EVENT, handleAuthExpired);
    }, []);

    // Keep stored token in sync when Supabase auto-refreshes it (1hr expiry)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'TOKEN_REFRESHED' && session?.access_token) {
                authApi.setToken(session.access_token);
            }
            if (event === 'SIGNED_OUT') {
                authApi.setToken(null);
                setPendingTwoFactor(null);
                setUser(null);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // ============ ACTION CALLBACKS (stable — no user in deps) ============

    const signIn = useCallback(async (email, password, options = {}) => {
        try {
            const data = await authApi.login(email, password, options);

            if (data.require2FA) {
                setPendingTwoFactor({
                    ...data,
                    ...(typeof options.keepSignedIn === 'boolean' ? { keepSignedIn: options.keepSignedIn } : {}),
                });
                setUser(null);
                return data;
            }

            if (data.user) {
                setPendingTwoFactor(null);
                const u = await authApi.hydrateUserIfOnboardingMissing(data.user);
                setUser(u);
                return u;
            }

            throw new Error('Login passed but no user returned');
        } catch (error) {
            console.error('[AuthContext] Login failed:', error);
            throw error;
        }
    }, []);

    const signUp = useCallback(async (username, email, password, captchaToken = null) => {
        const userData = await authApi.register(username, email, password, captchaToken);
        const next = await authApi.hydrateUserIfOnboardingMissing(userData);
        setUser(next);
        return next;
    }, []);

    const signInWithGoogle = useCallback(async (credential, options = {}) => {
        try {
            const data = await authApi.loginWithGoogle(credential, options);
            if (data.require2FA) {
                setPendingTwoFactor({
                    ...data,
                    ...(typeof options.keepSignedIn === 'boolean' ? { keepSignedIn: options.keepSignedIn } : {}),
                });
                setUser(null);
                return data;
            }
            if (data.user) {
                setPendingTwoFactor(null);
                const u = await authApi.hydrateUserIfOnboardingMissing(data.user);
                setUser(u);
                return u;
            }
            throw new Error('Google Login passed but no user returned');
        } catch (error) {
            console.error('[AuthContext] Google Login failed:', error);
            throw error;
        }
    }, []);

    const startGoogleOAuth = useCallback(async (options = {}) => {
        await authApi.startGoogleOAuth(options);
    }, []);

    const signInWithApple = useCallback(async (identityToken, rawNonce, appleUser, options = {}) => {
        try {
            const data = await authApi.loginWithApple(identityToken, rawNonce, appleUser, options);
            if (data.require2FA) {
                setPendingTwoFactor({
                    ...data,
                    ...(typeof options.keepSignedIn === 'boolean' ? { keepSignedIn: options.keepSignedIn } : {}),
                });
                setUser(null);
                return data;
            }
            if (data.user) {
                setPendingTwoFactor(null);
                const u = await authApi.hydrateUserIfOnboardingMissing(data.user);
                setUser(u);
                return u;
            }
            throw new Error('Apple Login passed but no user returned');
        } catch (error) {
            console.error('[AuthContext] Apple Login failed:', error);
            throw error;
        }
    }, []);

    const signInWith2FA = useCallback(async (challenge, code, options = {}) => {
        const keepSignedIn = typeof options.keepSignedIn === 'boolean'
            ? options.keepSignedIn
            : challenge?.keepSignedIn;
        const userData = await authApi.login2FA(challenge, code, { keepSignedIn });
        setPendingTwoFactor(null);
        const next = await authApi.hydrateUserIfOnboardingMissing(userData);
        setUser(next);
        return next;
    }, []);

    const signOut = useCallback(async () => {
        clearOnboardingDoneClient();
        const installationId = getStoredPushInstallationId();
        if (installationId) {
            await authApi.deactivatePushDevice(installationId).catch((error) => {
                console.warn('[AuthContext] Failed to deactivate push device during sign out:', error);
            });
        }
        await authApi.logout().catch(console.warn);
        authApi.setToken(null);
        setPendingTwoFactor(null);
        setUser(null);
    }, []);

    const cancelPendingTwoFactor = useCallback(() => {
        clearOnboardingDoneClient();
        authApi.logout().catch(console.warn);
        authApi.setToken(null);
        setPendingTwoFactor(null);
        setUser(null);
    }, []);

    const updateProfile = useCallback(async (updates) => {
        if (!userRef.current) throw new Error('Not logged in');
        const updatedUser = await authApi.updateProfile(updates);
        setUser(updatedUser);
        return updatedUser;
    }, []);

    const changePassword = useCallback(async (currentPassword, newPassword) => {
        if (!userRef.current) throw new Error('Not logged in');
        await authApi.changePassword(currentPassword, newPassword);
    }, []);

    const deleteAccount = useCallback(async (password) => {
        if (!userRef.current) throw new Error('Not logged in');
        await authApi.deleteAccount(password);
        clearOnboardingDoneClient();
        setUser(null);
    }, []);

    const refreshUser = useCallback(async () => {
        try {
            const userData = await authApi.getMe();
            if (userData && userData.id) {
                setUser(userData);
                return userData;
            }
        } catch (err) {
            console.error('[AuthContext] Refresh failed:', err);
            throw err;
        }
    }, []);

    useEffect(() => {
        if (!user?.id) return undefined;

        const refreshEntitlements = () => {
            refreshUser().catch((error) => {
                console.warn('[AuthContext] Foreground refresh failed:', error);
            });
        };

        const handleWindowFocus = () => {
            refreshEntitlements();
        };
        const handleVisibilityChange = () => {
            if (!document.hidden) {
                refreshEntitlements();
            }
        };

        window.addEventListener('focus', handleWindowFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('focus', handleWindowFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [refreshUser, user?.id]);

    const saveOnboardingProgress = useCallback(async (payload) => {
        const updatedUser = await authApi.updateOnboardingProgress(payload);
        if (payload?.markComplete && updatedUser?.id) {
            markOnboardingDoneClient(updatedUser.id);
        }
        setUser(updatedUser);
        return updatedUser;
    }, []);

    const findUserByShareCode = useCallback((code) => authApi.searchUsers(code).then(users => users.find(u => u.shareCode === code)), []);

    // Admin Functions (all stable — no deps)
    const getAllUsers = useCallback(() => authApi.adminGetAllUsers(), []);
    const adminUpdateUser = useCallback((id, updates) => authApi.adminUpdateUser(id, updates), []);
    const adminDeleteUser = useCallback((id) => authApi.adminDeleteUser(id), []);
    const adminGetStats = useCallback(() => authApi.adminGetStats(), []);
    const adminUpdateUserRole = useCallback((id, role) => authApi.adminUpdateUserRole(id, role), []);
    const adminGetMessages = useCallback(() => authApi.adminGetMessages(), []);
    const adminCreateMessage = useCallback((t, c, type, exp) => authApi.adminCreateMessage(t, c, type, exp), []);
    const adminUpdateMessage = useCallback((id, u) => authApi.adminUpdateMessage(id, u), []);
    const adminDeleteMessage = useCallback((id) => authApi.adminDeleteMessage(id), []);
    const adminGetFeedback = useCallback(() => authApi.adminGetFeedback(), []);
    const adminToggleFeedbackFavorite = useCallback((id, isFavorited) => authApi.adminToggleFeedbackFavorite(id, isFavorited), []);
    const adminDeleteFeedback = useCallback((id) => authApi.adminDeleteFeedback(id), []);
    const adminThankFeedback = useCallback((id) => authApi.adminThankFeedback(id), []);
    const adminGetReports = useCallback(() => authApi.adminGetReports(), []);
    const adminResolveReport = useCallback((id) => authApi.adminResolveReport(id), []);
    const adminCloseReport = useCallback((id) => authApi.adminCloseReport(id), []);
    const adminBanUser = useCallback((id) => authApi.adminBanUser(id), []);
    const getActiveMessages = useCallback(() => authApi.getActiveMessages(), []);
    const dismissMessage = useCallback((id) => authApi.dismissMessage(id), []);
    const getUserNotifications = useCallback(() => authApi.getUserNotifications(), []);
    const dismissUserNotification = useCallback((id) => authApi.dismissUserNotification(id), []);
    const getPushPreferences = useCallback(() => authApi.getPushPreferences(), []);
    const updatePushPreferences = useCallback((prefs) => authApi.updatePushPreferences(prefs), []);
    const adminGetUserStreakData = useCallback(() => { return null; }, []);
    const adminUpdateStreakData = useCallback(() => { return true; }, []);

    const toggleSimulateFree = useCallback(async () => {
        const result = await authApi.toggleSimulateFree();

        try {
            const refreshedUser = await authApi.getMe();
            if (refreshedUser?.id) {
                setUser(refreshedUser);
                return result;
            }
        } catch (error) {
            console.warn('[AuthContext] Simulate-free refresh failed:', error);
        }

        setUser(prev => {
            if (!prev) return prev;

            const nextSimulateFree = result.simulate_free_tier ?? prev.simulate_free_tier;
            const baseTier = prev.base_subscription_tier || prev.subscription_tier || 'free';
            let premiumAccessSource = 'free';

            if (prev.role === 'owner' && !nextSimulateFree) {
                premiumAccessSource = 'owner_included';
            } else if (prev.role === 'admin' && !nextSimulateFree) {
                premiumAccessSource = 'admin_included';
            } else if (prev.role === 'friends') {
                premiumAccessSource = 'friends_included';
            } else if (baseTier === 'lifetime') {
                premiumAccessSource = 'lifetime';
            } else if (baseTier === 'supporter') {
                premiumAccessSource = 'subscription';
            }

            const effectiveTier = premiumAccessSource === 'subscription'
                ? 'supporter'
                : premiumAccessSource === 'free'
                    ? 'free'
                    : 'lifetime';

            return {
                ...prev,
                base_subscription_tier: baseTier,
                premium_access_source: premiumAccessSource,
                subscription_tier: effectiveTier,
                simulate_free_tier: nextSimulateFree,
            };
        });
        return result;
    }, []);

    // ============ CONTEXT VALUES ============

    // Status context — only changes on login/logout (not profile updates)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const statusValue = useMemo(() => ({ isLoggedIn: !!user, loading }), [!!user, loading]);

    // State context — only changes when auth state changes
    const stateValue = useMemo(() => ({
        user,
        loading,
        pendingTwoFactor,
        isLoggedIn: !!user,
        isAdmin: user?.isAdmin || user?.isOwner || false,
        isOwner: user?.isOwner || false,
        role: user?.role || 'user',
    }), [user, loading, pendingTwoFactor]);

    // Actions context — stable, never triggers re-renders
    const actionsValue = useMemo(() => ({
        signIn,
        signUp,
        startGoogleOAuth,
        signInWithGoogle,
        signInWithApple,
        signInWith2FA,
        cancelPendingTwoFactor,
        signOut,
        updateProfile,
        changePassword,
        deleteAccount,
        refreshUser,
        saveOnboardingProgress,
        findUserByShareCode,
        getAllUsers,
        adminUpdateUser,
        adminDeleteUser,
        adminGetStats,
        adminUpdateUserRole,
        adminGetUserStreakData,
        adminUpdateStreakData,
        adminGetMessages,
        adminCreateMessage,
        adminUpdateMessage,
        adminDeleteMessage,
        adminGetFeedback,
        adminToggleFeedbackFavorite,
        adminDeleteFeedback,
        adminThankFeedback,
        adminGetReports,
        adminResolveReport,
        adminCloseReport,
        adminBanUser,
        getActiveMessages,
        dismissMessage,
        getUserNotifications,
        dismissUserNotification,
        getPushPreferences,
        updatePushPreferences,
        toggleSimulateFree
    }), [
        signIn, signUp, startGoogleOAuth, signInWithGoogle, signInWithApple, signInWith2FA, cancelPendingTwoFactor, signOut, updateProfile, changePassword,
        deleteAccount, refreshUser, saveOnboardingProgress, findUserByShareCode, getAllUsers, adminUpdateUser,
        adminDeleteUser, adminGetStats, adminUpdateUserRole, adminGetUserStreakData,
        adminUpdateStreakData, adminGetMessages, adminCreateMessage, adminUpdateMessage,
        adminDeleteMessage, adminGetFeedback, adminToggleFeedbackFavorite, adminDeleteFeedback,
        adminThankFeedback, adminGetReports, adminResolveReport, adminCloseReport,
        adminBanUser, getActiveMessages, dismissMessage, getUserNotifications,
        dismissUserNotification, getPushPreferences, updatePushPreferences, toggleSimulateFree
    ]);

    return (
        <AuthStatusContext.Provider value={statusValue}>
            <AuthContext.Provider value={stateValue}>
                <AuthActionsContext.Provider value={actionsValue}>
                    {children}
                </AuthActionsContext.Provider>
            </AuthContext.Provider>
        </AuthStatusContext.Provider>
    );
}
