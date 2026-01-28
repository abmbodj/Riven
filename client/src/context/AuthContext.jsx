import React, { createContext, useState, useCallback } from 'react';

export const AuthContext = createContext(null);

const AUTH_STORAGE_KEY = 'riven_auth';
const USERS_STORAGE_KEY = 'riven_users';

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const stored = localStorage.getItem(AUTH_STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch {
            console.error('Failed to load auth');
        }
        return null;
    });
    // loading state for future async operations
    const loading = false;

    // Get all users (for local auth)
    const getUsers = useCallback(() => {
        try {
            const stored = localStorage.getItem(USERS_STORAGE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    }, []);

    // Save users
    const saveUsers = useCallback((users) => {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }, []);

    // Generate unique ID
    const generateId = () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    };

    // Generate share code
    const generateShareCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    };

    // Sign up
    const signUp = useCallback(async (username, email, password) => {
        const users = getUsers();
        
        // Check if email already exists
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
            throw new Error('Email already registered');
        }

        // Check if username already exists
        if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error('Username already taken');
        }

        const newUser = {
            id: generateId(),
            username,
            email: email.toLowerCase(),
            password, // In production, this should be hashed!
            shareCode: generateShareCode(),
            createdAt: new Date().toISOString(),
            avatar: null,
            bio: '',
            sharedDecks: [], // IDs of decks shared by this user
            receivedDecks: [] // Shared decks received from others
        };

        users.push(newUser);
        saveUsers(users);

        // Auto login
        const sessionUser = { ...newUser };
        delete sessionUser.password;
        setUser(sessionUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));

        return sessionUser;
    }, [getUsers, saveUsers]);

    // Sign in
    const signIn = useCallback(async (email, password) => {
        const users = getUsers();
        const found = users.find(
            u => u.email.toLowerCase() === email.toLowerCase() && u.password === password
        );

        if (!found) {
            throw new Error('Invalid email or password');
        }

        const sessionUser = { ...found };
        delete sessionUser.password;
        setUser(sessionUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));

        return sessionUser;
    }, [getUsers]);

    // Sign out
    const signOut = useCallback(() => {
        setUser(null);
        localStorage.removeItem(AUTH_STORAGE_KEY);
    }, []);

    // Update profile
    const updateProfile = useCallback(async (updates) => {
        if (!user) throw new Error('Not logged in');

        const users = getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) throw new Error('User not found');

        // Check username uniqueness if changing
        if (updates.username && updates.username !== user.username) {
            if (users.some(u => u.id !== user.id && u.username.toLowerCase() === updates.username.toLowerCase())) {
                throw new Error('Username already taken');
            }
        }

        users[idx] = { ...users[idx], ...updates };
        saveUsers(users);

        const sessionUser = { ...users[idx] };
        delete sessionUser.password;
        setUser(sessionUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));

        return sessionUser;
    }, [user, getUsers, saveUsers]);

    // Change password
    const changePassword = useCallback(async (currentPassword, newPassword) => {
        if (!user) throw new Error('Not logged in');

        const users = getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) throw new Error('User not found');

        if (users[idx].password !== currentPassword) {
            throw new Error('Current password is incorrect');
        }

        users[idx].password = newPassword;
        saveUsers(users);
    }, [user, getUsers, saveUsers]);

    // Delete account
    const deleteAccount = useCallback(async (password) => {
        if (!user) throw new Error('Not logged in');

        const users = getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) throw new Error('User not found');

        if (users[idx].password !== password) {
            throw new Error('Password is incorrect');
        }

        users.splice(idx, 1);
        saveUsers(users);
        signOut();
    }, [user, getUsers, saveUsers, signOut]);

    // Find user by share code
    const findUserByShareCode = useCallback((shareCode) => {
        const users = getUsers();
        const found = users.find(u => u.shareCode === shareCode.toUpperCase());
        if (!found) return null;
        return {
            id: found.id,
            username: found.username,
            avatar: found.avatar,
            shareCode: found.shareCode
        };
    }, [getUsers]);

    // Share a deck with another user
    const shareDeck = useCallback(async (deckId, deckData) => {
        if (!user) throw new Error('Not logged in');

        const users = getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) throw new Error('User not found');

        const shareId = generateId();
        const sharedDeck = {
            shareId,
            deckId,
            deckData: JSON.parse(JSON.stringify(deckData)), // Clone deck data
            sharedAt: new Date().toISOString(),
            sharedBy: {
                id: user.id,
                username: user.username
            }
        };

        if (!users[idx].sharedDecks) users[idx].sharedDecks = [];
        users[idx].sharedDecks.push(sharedDeck);
        saveUsers(users);

        // Update session
        const sessionUser = { ...users[idx] };
        delete sessionUser.password;
        setUser(sessionUser);
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));

        return shareId;
    }, [user, getUsers, saveUsers]);

    // Get shared deck by shareId
    const getSharedDeck = useCallback((shareId) => {
        const users = getUsers();
        for (const u of users) {
            if (u.sharedDecks) {
                const deck = u.sharedDecks.find(d => d.shareId === shareId);
                if (deck) return deck;
            }
        }
        return null;
    }, [getUsers]);

    // Import shared deck
    const importSharedDeck = useCallback(async (shareId) => {
        if (!user) throw new Error('Not logged in');

        const sharedDeck = getSharedDeck(shareId);
        if (!sharedDeck) throw new Error('Shared deck not found');

        const users = getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) throw new Error('User not found');

        // Record that we received this deck
        if (!users[idx].receivedDecks) users[idx].receivedDecks = [];
        if (!users[idx].receivedDecks.includes(shareId)) {
            users[idx].receivedDecks.push(shareId);
            saveUsers(users);
        }

        return sharedDeck.deckData;
    }, [user, getUsers, saveUsers, getSharedDeck]);

    // Unshare a deck
    const unshareDeck = useCallback(async (shareId) => {
        if (!user) throw new Error('Not logged in');

        const users = getUsers();
        const idx = users.findIndex(u => u.id === user.id);
        if (idx === -1) throw new Error('User not found');

        if (users[idx].sharedDecks) {
            users[idx].sharedDecks = users[idx].sharedDecks.filter(d => d.shareId !== shareId);
            saveUsers(users);

            const sessionUser = { ...users[idx] };
            delete sessionUser.password;
            setUser(sessionUser);
            localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(sessionUser));
        }
    }, [user, getUsers, saveUsers]);

    // Get user's shared decks
    const getMySharedDecks = useCallback(() => {
        if (!user) return [];
        return user.sharedDecks || [];
    }, [user]);

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            isLoggedIn: !!user,
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
            getMySharedDecks
        }}>
            {children}
        </AuthContext.Provider>
    );
}
