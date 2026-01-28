import React, { createContext, useState, useCallback, useEffect } from 'react';
import * as authApi from '../api/authApi';

export const AuthContext = createContext(null);

const ADMIN_CREDENTIALS = { email: 'admin@riven.app', password: 'RivenAdmin2026!' };

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check for existing token on mount
    useEffect(() => {
        const checkAuth = async () => {
            const token = authApi.getToken();
            if (token) {
                try {
                    const userData = await authApi.getMe();
                    setUser(userData);
                } catch (error) {
                    console.error('Token validation failed:', error);
                    authApi.setToken(null);
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    // Sign up
    const signUp = useCallback(async (username, email, password) => {
        const userData = await authApi.register(username, email, password);
        setUser(userData);
        return userData;
    }, []);

    // Sign in
    const signIn = useCallback(async (email, password) => {
        // Check for admin login (local only)
        if (email.toLowerCase() === ADMIN_CREDENTIALS.email && password === ADMIN_CREDENTIALS.password) {
            const adminUser = {
                id: 'admin',
                username: 'Admin',
                email: ADMIN_CREDENTIALS.email,
                shareCode: 'ADMIN000',
                createdAt: new Date().toISOString(),
                avatar: null,
                bio: 'System Administrator',
                isAdmin: true,
            };
            setUser(adminUser);
            return adminUser;
        }

        const userData = await authApi.login(email, password);
        setUser(userData);
        return userData;
    }, []);

    // Sign out
    const signOut = useCallback(() => {
        authApi.logout();
        setUser(null);
    }, []);

    // Update profile
    const updateProfile = useCallback(async (updates) => {
        if (!user) throw new Error('Not logged in');
        if (user.isAdmin) throw new Error('Cannot update admin profile');

        const updatedUser = await authApi.updateProfile(updates);
        setUser(updatedUser);
        return updatedUser;
    }, [user]);

    // Change password
    const changePassword = useCallback(async (currentPassword, newPassword) => {
        if (!user) throw new Error('Not logged in');
        if (user.isAdmin) throw new Error('Cannot change admin password');

        await authApi.changePassword(currentPassword, newPassword);
    }, [user]);

    // Delete account
    const deleteAccount = useCallback(async (password) => {
        if (!user) throw new Error('Not logged in');
        if (user.isAdmin) throw new Error('Cannot delete admin account');

        await authApi.deleteAccount(password);
        setUser(null);
    }, [user]);

    // Find user by share code (would need server endpoint)
    const findUserByShareCode = useCallback((shareCode) => {
        // This would need a server endpoint
        console.warn('findUserByShareCode not yet implemented for server');
        return null;
    }, []);

    // Share a deck
    const shareDeck = useCallback(async (deckId, deckData) => {
        if (!user) throw new Error('Not logged in');
        if (user.isAdmin) return null;

        const result = await authApi.shareDeck(deckId);
        return result.shareId;
    }, [user]);

    // Get shared deck by shareId
    const getSharedDeck = useCallback(async (shareId) => {
        try {
            return await authApi.getSharedDeck(shareId);
        } catch {
            return null;
        }
    }, []);

    // Import shared deck
    const importSharedDeck = useCallback(async (shareId) => {
        if (!user) throw new Error('Not logged in');
        if (user.isAdmin) throw new Error('Admin cannot import decks');

        return await authApi.importSharedDeck(shareId);
    }, [user]);

    // Unshare a deck
    const unshareDeck = useCallback(async (shareId) => {
        if (!user) throw new Error('Not logged in');
        if (user.isAdmin) return;

        await authApi.unshareDeck(shareId);
    }, [user]);

    // Get user's shared decks
    const getMySharedDecks = useCallback(async () => {
        if (!user || user.isAdmin) return [];
        try {
            return await authApi.getMySharedDecks();
        } catch {
            return [];
        }
    }, [user]);

    // ==================== ADMIN FUNCTIONS ====================
    // Note: Admin functions need server-side implementation for full functionality

    // Get all users (admin only)
    const getAllUsers = useCallback(() => {
        if (!user?.isAdmin) return [];
        // Would need admin endpoint
        console.warn('getAllUsers needs admin API endpoint');
        return [];
    }, [user]);

    // Update any user (admin only)
    const adminUpdateUser = useCallback(async (userId, updates) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        // Would need admin endpoint
        console.warn('adminUpdateUser needs admin API endpoint');
        return null;
    }, [user]);

    // Delete any user (admin only)
    const adminDeleteUser = useCallback(async (userId) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        // Would need admin endpoint
        console.warn('adminDeleteUser needs admin API endpoint');
    }, [user]);

    // Get user's streak data (admin only)
    const adminGetUserStreakData = useCallback(() => {
        if (!user?.isAdmin) return null;
        // For admin, read from global localStorage
        try {
            const streakData = localStorage.getItem('ghost_streak_data');
            return streakData ? JSON.parse(streakData) : null;
        } catch {
            return null;
        }
    }, [user]);

    // Update streak data (admin only)
    const adminUpdateStreakData = useCallback((newStreakData) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        localStorage.setItem('ghost_streak_data', JSON.stringify(newStreakData));
        return true;
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isLoggedIn: !!user,
            isAdmin: user?.isAdmin || false,
            signUp,
            signIn,
            signOut,
            updateProfile,
            changePassword,
            deleteAccount,
            findUserByShareCode,
            shareDeck,
            getSharedDeck,
            importSharedDeck,
            unshareDeck,
            getMySharedDecks,
            // Admin functions
            getAllUsers,
            adminUpdateUser,
            adminDeleteUser,
            adminGetUserStreakData,
            adminUpdateStreakData
        }}>
            {children}
        </AuthContext.Provider>
    );
}
