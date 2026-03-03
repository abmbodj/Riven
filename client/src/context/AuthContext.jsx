import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { io } from 'socket.io-client';
import * as authApi from '../api/authApi';
import { AuthContext, AuthActionsContext } from './authContextDef';

// Re-export for convenience
export { AuthContext, AuthActionsContext };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [socket, setSocket] = useState(null);

    // Ref to avoid stale closures in callbacks — lets us remove `user` from dependency arrays
    const userRef = useRef(user);
    useEffect(() => { userRef.current = user; }, [user]);

    // Initial Session Check
    useEffect(() => {
        const initAuth = async () => {
            const token = authApi.getToken();
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const userData = await authApi.getMe();
                if (userData && userData.id) {
                    setUser(userData);
                } else {
                    // Invalid token or session expired
                    authApi.setToken(null);
                    setUser(null);
                }
            } catch (err) {
                console.warn('[AuthContext] Session check failed:', err);
                // On persistent auth error (401/403), clear token
                if (err.message && (err.message.includes('401') || err.message.includes('403'))) {
                    authApi.setToken(null);
                    setUser(null);
                }
                // For network errors (500), do NOT clear token, just fail silently
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    // Socket Initialization — C6 fix: depend on user?.id, guard with isMounted
    useEffect(() => {
        if (!user?.id) {
            setSocket(null);
            return;
        }

        const serverUrl = authApi.getApiBase().replace(/\/api$/, '');
        const token = authApi.getToken();
        let isMounted = true;

        const newSocket = io(serverUrl, {
            withCredentials: true,
            transports: ['websocket', 'polling'],
            extraHeaders: token ? {
                Authorization: `Bearer ${token}`
            } : undefined
        });

        newSocket.on('connect', () => {
            if (isMounted) {
                newSocket.emit('register', token);
            }
        });

        if (isMounted) {
            setSocket(newSocket);
        }

        return () => {
            isMounted = false;
            newSocket.disconnect();
        };
    }, [user?.id]);

    // ============ ACTION CALLBACKS (stable — no user in deps) ============

    const signIn = useCallback(async (email, password) => {
        try {
            const data = await authApi.login(email, password);

            if (data.require2FA) {
                return data;
            }

            if (data.user) {
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

    const signInWith2FA = useCallback(async (tempToken, code) => {
        const userData = await authApi.login2FA(tempToken, code);
        setUser(userData);
        return userData;
    }, []);

    const signOut = useCallback(() => {
        authApi.logout().catch(console.warn);
        authApi.setToken(null);
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
        setUser(prev => prev ? { ...prev, subscription_tier: result.subscription_tier, simulate_free_tier: result.simulate_free_tier } : prev);
        return result;
    }, []);

    // ============ CONTEXT VALUES ============

    // State context — only changes when user/loading/socket change
    const stateValue = useMemo(() => ({
        user,
        loading,
        socket,
        isLoggedIn: !!user,
        isAdmin: user?.isAdmin || user?.isOwner || false,
        isOwner: user?.isOwner || false,
        role: user?.role || 'user',
    }), [user, loading, socket]);

    // Actions context — stable, never triggers re-renders
    const actionsValue = useMemo(() => ({
        signIn,
        signUp,
        signInWith2FA,
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
        signIn, signUp, signInWith2FA, signOut, updateProfile, changePassword,
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
