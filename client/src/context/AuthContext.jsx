import { useState, useCallback, useEffect, useMemo } from 'react';
import * as authApi from '../api/authApi';
import { AuthContext } from './authContextDef';

// Re-export for convenience
export { AuthContext };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

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

    // Sign In - Atomic & Simple
    const signIn = useCallback(async (email, password) => {
        try {
            const data = await authApi.login(email, password);

            // Handle 2FA requirement
            if (data.require2FA) {
                return data; // Return to UI to handle 2FA step
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

    // Sign Up - Simple (Migration removed from critical path)
    const signUp = useCallback(async (username, email, password) => {
        const userData = await authApi.register(username, email, password);
        setUser(userData);
        return userData;
    }, []);

    // Sign In with 2FA
    const signInWith2FA = useCallback(async (tempToken, code) => {
        const userData = await authApi.login2FA(tempToken, code);
        setUser(userData);
        return userData;
    }, []);

    // Sign Out
    const signOut = useCallback(() => {
        authApi.logout().catch(console.warn); // Best effort logout
        authApi.setToken(null);
        setUser(null);
    }, []);

    // Update Profile
    const updateProfile = useCallback(async (updates) => {
        if (!user) throw new Error('Not logged in');
        const updatedUser = await authApi.updateProfile(updates);
        setUser(updatedUser);
        return updatedUser;
    }, [user]);

    // Change Password
    const changePassword = useCallback(async (currentPassword, newPassword) => {
        if (!user) throw new Error('Not logged in');
        await authApi.changePassword(currentPassword, newPassword);
    }, [user]);

    // Delete Account
    const deleteAccount = useCallback(async (password) => {
        if (!user) throw new Error('Not logged in');
        await authApi.deleteAccount(password);
        setUser(null);
    }, [user]);

    // Passthrough functions (logic is in authApi, but exposed via context for consistency)
    const findUserByShareCode = useCallback((code) => authApi.searchUsers(code).then(users => users.find(u => u.shareCode === code)), []);

    // Admin Functions
    const getAllUsers = useCallback(() => authApi.adminGetAllUsers(), []);
    const adminUpdateUser = useCallback((id, updates) => authApi.adminUpdateUser(id, updates), []);
    const adminDeleteUser = useCallback((id) => authApi.adminDeleteUser(id), []);
    const adminGetStats = useCallback(() => authApi.adminGetStats(), []);
    const adminUpdateUserRole = useCallback((id, role) => authApi.adminUpdateUserRole(id, role), []);
    const adminGetMessages = useCallback(() => authApi.adminGetMessages(), []);
    const adminCreateMessage = useCallback((t, c, type, exp) => authApi.adminCreateMessage(t, c, type, exp), []);
    const adminUpdateMessage = useCallback((id, u) => authApi.adminUpdateMessage(id, u), []);
    const adminDeleteMessage = useCallback((id) => authApi.adminDeleteMessage(id), []);
    const getActiveMessages = useCallback(() => authApi.getActiveMessages(), []);
    const dismissMessage = useCallback((id) => authApi.dismissMessage(id), []);
    // Streak data is now part of user object or fetched via generic endpoint, 
    // but for admin viewing we might need a specific call. authApi has getStreak but that's for 'me'.
    // If admin needs to view another user's streak, it should cover in adminGetAllUsers or generic user update.
    const adminGetUserStreakData = useCallback(() => { return null; }, []);
    const adminUpdateStreakData = useCallback(() => { return true; }, []);

    const contextValue = useMemo(() => ({
        user,
        loading,
        isLoggedIn: !!user,
        isAdmin: user?.isAdmin || user?.isOwner || false,
        isOwner: user?.isOwner || false,
        role: user?.role || 'user',
        signIn,
        signUp,
        signInWith2FA,
        signOut,
        updateProfile,
        changePassword,
        deleteAccount,
        // Sharing
        findUserByShareCode,
        // Admin
        getAllUsers,
        adminUpdateUser,
        adminDeleteUser,
        adminGetStats,
        adminUpdateUserRole,
        adminGetUserStreakData, // Legacy/Stub
        adminUpdateStreakData, // Legacy/Stub
        adminGetMessages,
        adminCreateMessage,
        adminUpdateMessage,
        adminDeleteMessage,
        getActiveMessages,
        dismissMessage
    }), [
        user, loading, signIn, signUp, signInWith2FA, signOut, updateProfile, changePassword,
        deleteAccount, findUserByShareCode, getAllUsers, adminUpdateUser, adminDeleteUser,
        adminGetStats, adminUpdateUserRole, adminGetUserStreakData, adminUpdateStreakData,
        adminGetMessages, adminCreateMessage, adminUpdateMessage, adminDeleteMessage,
        getActiveMessages, dismissMessage
    ]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
}
