import { useState, useCallback, useEffect } from 'react';
import * as authApi from '../api/authApi';
import * as guestDb from '../db/indexedDB';
import { AuthContext } from './authContextDef';

// Re-export for convenience
export { AuthContext };

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
                } catch {
                    // Token invalid or expired, clear it
                    authApi.setToken(null);
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    // Migrate guest data to server
    const migrateGuestData = useCallback(async () => {
        try {
            const hasData = await guestDb.hasGuestData();
            if (!hasData) return { migrated: false };

            const guestData = await guestDb.exportAllGuestData();
            const result = await authApi.migrateGuestData(guestData);
            
            // Clear local data after successful migration
            await guestDb.clearAllGuestData();
            
            return { migrated: true, ...result };
        } catch (error) {
            console.error('Failed to migrate guest data:', error);
            return { migrated: false, error: error.message };
        }
    }, []);

    // Sign up - also migrates guest data
    const signUp = useCallback(async (username, email, password) => {
        const userData = await authApi.register(username, email, password);
        setUser(userData);
        
        // Migrate guest data after successful signup
        const migrationResult = await migrateGuestData();
        
        return { ...userData, migration: migrationResult };
    }, [migrateGuestData]);

    // Sign in - admin role is now handled server-side
    const signIn = useCallback(async (email, password) => {
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

    // Find user by share code
    const findUserByShareCode = useCallback(() => {
        // TODO: Implement server endpoint for finding users by share code
        return null;
    }, []);

    // Share a deck
    const shareDeck = useCallback(async (deckId) => {
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

    // Get all users (admin only)
    const getAllUsers = useCallback(async () => {
        if (!user?.isAdmin) return [];
        try {
            return await authApi.adminGetAllUsers();
        } catch {
            return [];
        }
    }, [user]);

    // Update any user (admin only)
    const adminUpdateUser = useCallback(async (userId, updates) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        return await authApi.adminUpdateUser(userId, updates);
    }, [user]);

    // Delete any user (admin only)
    const adminDeleteUser = useCallback(async (userId) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        return await authApi.adminDeleteUser(userId);
    }, [user]);

    // Get admin stats
    const adminGetStats = useCallback(async () => {
        if (!user?.isAdmin) return null;
        try {
            return await authApi.adminGetStats();
        } catch {
            return null;
        }
    }, [user]);

    // Get user's streak data (admin only - from localStorage for now)
    const adminGetUserStreakData = useCallback(() => {
        if (!user?.isAdmin) return null;
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

    // Get all global messages (admin only)
    const adminGetMessages = useCallback(async () => {
        if (!user?.isAdmin) return [];
        try {
            return await authApi.adminGetMessages();
        } catch {
            return [];
        }
    }, [user]);

    // Create a global message (admin only)
    const adminCreateMessage = useCallback(async (title, content, type, expiresAt) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        return await authApi.adminCreateMessage(title, content, type, expiresAt);
    }, [user]);

    // Update a global message (admin only)
    const adminUpdateMessage = useCallback(async (id, updates) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        return await authApi.adminUpdateMessage(id, updates);
    }, [user]);

    // Delete a global message (admin only)
    const adminDeleteMessage = useCallback(async (id) => {
        if (!user?.isAdmin) throw new Error('Admin access required');
        return await authApi.adminDeleteMessage(id);
    }, [user]);

    // Get active messages for current user
    const getActiveMessages = useCallback(async () => {
        if (!user) return [];
        try {
            return await authApi.getActiveMessages();
        } catch {
            return [];
        }
    }, [user]);

    // Dismiss a message
    const dismissMessage = useCallback(async (id) => {
        if (!user) throw new Error('Not logged in');
        return await authApi.dismissMessage(id);
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
            adminGetStats,
            adminGetUserStreakData,
            adminUpdateStreakData,
            adminGetMessages,
            adminCreateMessage,
            adminUpdateMessage,
            adminDeleteMessage,
            // User message functions
            getActiveMessages,
            dismissMessage
        }}>
            {children}
        </AuthContext.Provider>
    );
}
