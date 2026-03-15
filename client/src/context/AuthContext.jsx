import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import * as authApi from '../api/authApi';
import { supabase } from '../lib/supabaseClient';
import { AuthContext, AuthActionsContext } from './authContextDef';

// Re-export for convenience
export { AuthContext, AuthActionsContext };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [pendingTwoFactor, setPendingTwoFactor] = useState(null);

    // Ref to avoid stale closures in callbacks — lets us remove `user` from dependency arrays
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // Initial Session Check
    useEffect(() => {
        const initAuth = async () => {
            try {
                const userData = await authApi.restoreSessionUser();
                if (userData?.require2FA) {
                    setPendingTwoFactor(userData);
                    setUser(null);
                } else if (userData && userData.id) {
                    setPendingTwoFactor(null);
                    setUser(userData);
                } else {
                    setPendingTwoFactor(null);
                    setUser(null);
                }
            } catch (err) {
                console.warn('[AuthContext] Session check failed:', err);
                if (err.status === 401 || err.status === 403 || (err.message && (err.message.includes('401') || err.message.includes('403')))) {
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

    // Keep stored token in sync when Supabase auto-refreshes it (1hr expiry)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'TOKEN_REFRESHED' && session?.access_token) {
                authApi.setToken(session.access_token);
            }
            if (event === 'SIGNED_OUT') {
                authApi.setToken(null);
                setPendingTwoFactor(null);
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    // ============ ACTION CALLBACKS (stable — no user in deps) ============

    const signIn = useCallback(async (email, password) => {
        try {
            const data = await authApi.login(email, password);

            if (data.require2FA) {
                setPendingTwoFactor(data);
                setUser(null);
                return data;
            }

            if (data.user) {
                setPendingTwoFactor(null);
                setUser(data.user);
                return data.user;
            }

            throw new Error('Login passed but no user returned');
        } catch (error) {
            console.error('[AuthContext] Login failed:', error);
            throw error;
        }
    }, []);

    const signUp = useCallback(async (username, email, password) => {
        const userData = await authApi.register(username, email, password);
        setUser(userData);
        return userData;
    }, []);

    const signInWithGoogle = useCallback(async (credential) => {
        try {
            const data = await authApi.loginWithGoogle(credential);
            if (data.require2FA) {
                setPendingTwoFactor(data);
                setUser(null);
                return data;
            }
            if (data.user) {
                setPendingTwoFactor(null);
                setUser(data.user);
                return data.user;
            }
            throw new Error('Google Login passed but no user returned');
        } catch (error) {
            console.error('[AuthContext] Google Login failed:', error);
            throw error;
        }
    }, []);

    const signInWithApple = useCallback(async (identityToken, appleUser) => {
        try {
            const data = await authApi.loginWithApple(identityToken, appleUser);
            if (data.require2FA) {
                setPendingTwoFactor(data);
                setUser(null);
                return data;
            }
            if (data.user) {
                setPendingTwoFactor(null);
                setUser(data.user);
                return data.user;
            }
            throw new Error('Apple Login passed but no user returned');
        } catch (error) {
            console.error('[AuthContext] Apple Login failed:', error);
            throw error;
        }
    }, []);

    const signInWith2FA = useCallback(async (challenge, code) => {
        const userData = await authApi.login2FA(challenge, code);
        setPendingTwoFactor(null);
        setUser(userData);
        return userData;
    }, []);

    const signOut = useCallback(() => {
        authApi.logout().catch(console.warn);
        authApi.setToken(null);
        setPendingTwoFactor(null);
        setUser(null);
    }, []);

    const cancelPendingTwoFactor = useCallback(() => {
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
    const adminGetReports = useCallback(() => authApi.adminGetReports(), []);
    const adminResolveReport = useCallback((id) => authApi.adminResolveReport(id), []);
    const adminCloseReport = useCallback((id) => authApi.adminCloseReport(id), []);
    const adminBanUser = useCallback((id) => authApi.adminBanUser(id), []);
    const getActiveMessages = useCallback(() => authApi.getActiveMessages(), []);
    const dismissMessage = useCallback((id) => authApi.dismissMessage(id), []);
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

        setUser(prev => prev ? {
            ...prev,
            subscription_tier: result.subscription_tier ?? prev.subscription_tier,
            simulate_free_tier: result.simulate_free_tier ?? prev.simulate_free_tier,
        } : prev);
        return result;
    }, []);

    // ============ CONTEXT VALUES ============

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
        signInWithGoogle,
        signInWithApple,
        signInWith2FA,
        cancelPendingTwoFactor,
        signOut,
        updateProfile,
        changePassword,
        deleteAccount,
        refreshUser,
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
        adminGetReports,
        adminResolveReport,
        adminCloseReport,
        adminBanUser,
        getActiveMessages,
        dismissMessage,
        toggleSimulateFree
    }), [
        signIn, signUp, signInWithGoogle, signInWithApple, signInWith2FA, cancelPendingTwoFactor, signOut, updateProfile, changePassword,
        deleteAccount, refreshUser, findUserByShareCode, getAllUsers, adminUpdateUser,
        adminDeleteUser, adminGetStats, adminUpdateUserRole, adminGetUserStreakData,
        adminUpdateStreakData, adminGetMessages, adminCreateMessage, adminUpdateMessage,
        adminDeleteMessage, adminGetReports, adminResolveReport, adminCloseReport,
        adminBanUser, getActiveMessages, dismissMessage, toggleSimulateFree
    ]);

    return (
        <AuthContext.Provider value={stateValue}>
            <AuthActionsContext.Provider value={actionsValue}>
                {children}
            </AuthActionsContext.Provider>
        </AuthContext.Provider>
    );
}
