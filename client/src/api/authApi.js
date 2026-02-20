// Authentication API - communicates with server for cross-device sync
// Use '/api' in dev so Vite proxy keeps requests same-origin (cookies work).
// Set VITE_API_URL for production or when server is on a different host.
let API_BASE = import.meta.env.VITE_API_URL || '/api';

// Remove trailing slash if present to avoid double slashes
if (API_BASE.endsWith('/')) {
    API_BASE = API_BASE.slice(0, -1);
}

console.log('[authApi] INITIALIZED. Using API_BASE:', API_BASE);

// Helper functions for local auth state (flag for AuthContext to know if it should try fetching user)
export const getToken = () => localStorage.getItem('riven_auth_token');
export const setToken = (token) => {
    if (token) localStorage.setItem('riven_auth_token', token);
    else localStorage.removeItem('riven_auth_token');
};

// Fetch wrapper with dual auth (Cookie + Header)
const authFetch = async (endpoint, options = {}) => {
    const token = getToken();
    console.log(`[authApi] Fetching ${endpoint}`, options);
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
        });

        // Handle empty or non-JSON responses
        const contentType = response.headers.get('content-type');
        let data = {};

        if (contentType && contentType.includes('application/json')) {
            const text = await response.text();
            data = text ? JSON.parse(text) : {};
        }

        if (!response.ok) {
            console.error(`[authApi] Error ${endpoint}:`, data);
            const error = new Error(data.error || data.message || `Request failed (${response.status})`);
            error.status = response.status;
            throw error;
        }

        return data;
    } catch (error) {
        if (error.name === 'SyntaxError') {
            console.error('[authApi] JSON Parse Error:', error);
            throw new Error('Server returned an invalid response');
        }
        throw error;
    }
};


// Helper for safe data fetching (swallows errors, returns consistent defaults)
const safeFetchArray = async (promise) => {
    try {
        const data = await promise;
        return Array.isArray(data) ? data : [];
    } catch (err) {
        console.warn('[authApi] Safe fetch failed (returning []):', err);
        return [];
    }
};

const safeFetchObject = async (promise, defaultVal = {}) => {
    try {
        const data = await promise;
        return data || defaultVal;
    } catch (err) {
        console.warn('[authApi] Safe fetch failed (returning default):', err);
        return defaultVal;
    }
};

// ============ AUTH ENDPOINTS ============

export const register = async (username, email, password) => {
    const data = await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
    });
    // Token is set as httpOnly cookie AND returned in body
    if (data.token) {
        setToken(data.token);
    }
    return data.user;
};

export const login = async (email, password) => {
    console.log('[authApi] login called', { email });
    const data = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    console.log('[authApi] login response', data);
    // Token is now set as httpOnly cookie by server AND returned in body
    if (data.token) {
        setToken(data.token); // Save token for mobile/fallback
    } else if (data.user) {
        setToken('logged_in'); // Fallback if no token returned (shouldn't happen now)
    }
    // Return the full data object
    return data;
};

export const logout = async () => {
    // Call server to clear httpOnly cookie
    try {
        await authFetch('/auth/logout', {
            method: 'POST',
        });
    } finally {
        setToken(null);
    }
};

export const getMe = async () => {
    return authFetch('/auth/me');
};

export const updateProfile = async (updates) => {
    return authFetch('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(updates),
    });
};

export const changePassword = async (currentPassword, newPassword) => {
    return authFetch('/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
    });
};

export const deleteAccount = async (password) => {
    await authFetch('/auth/account', {
        method: 'DELETE',
        body: JSON.stringify({ password }),
    });
    // Clear httpOnly cookie
    await logout();
};

// ============ STREAK ENDPOINTS ============

export const getStreak = async () => {
    return safeFetchObject(authFetch('/auth/streak'), {});
};

export const updateStreak = async (streakData) => {
    return authFetch('/auth/streak', {
        method: 'PUT',
        body: JSON.stringify({ streakData }),
    });
};

// ============ PET CUSTOMIZATION ============

export const getPetCustomization = async () => {
    return safeFetchObject(authFetch('/auth/pet'), { decorations: [], specialPlants: [] });
};

export const updatePetCustomization = async (customization) => {
    return authFetch('/auth/pet', {
        method: 'PUT',
        body: JSON.stringify({ customization }),
    });
};

// ============ DATA ENDPOINTS (with auth) ============

export const getFolders = () => safeFetchArray(authFetch('/folders'));
export const createFolder = (name, color, icon) => authFetch('/folders', {
    method: 'POST',
    body: JSON.stringify({ name, color, icon }),
});
export const updateFolder = (id, name, color, icon) => authFetch(`/folders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, color, icon }),
});
export const deleteFolder = (id) => authFetch(`/folders/${id}`, { method: 'DELETE' });

export const getTags = () => safeFetchArray(authFetch('/tags'));
export const createTag = (name, color) => authFetch('/tags', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
});
export const deleteTag = (id) => authFetch(`/tags/${id}`, { method: 'DELETE' });

export const getDecks = () => safeFetchArray(authFetch('/decks'));
export const getDeck = (id) => authFetch(`/decks/${id}`);
export const createDeck = (title, description, folderId, tagIds) => authFetch('/decks', {
    method: 'POST',
    body: JSON.stringify({ title, description, folder_id: folderId, tagIds }),
});
export const updateDeck = (id, title, description, folderId, tagIds) => authFetch(`/decks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, description, folder_id: folderId, tagIds }),
});
export const deleteDeck = (id) => authFetch(`/decks/${id}`, { method: 'DELETE' });
export const duplicateDeck = (id) => authFetch(`/decks/${id}/duplicate`, { method: 'POST' });

export const addCard = (deckId, front, back, front_image = null, back_image = null) => authFetch(`/decks/${deckId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ front, back, front_image, back_image }),
});
export const updateCard = (id, front, back, front_image, back_image) => authFetch(`/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ front, back, front_image, back_image }),
});
export const deleteCard = (id) => authFetch(`/cards/${id}`, { method: 'DELETE' });

export const reviewCard = (id, correct) => authFetch(`/cards/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify({ correct }),
});

export const reorderCards = (deckId, cardIds) => authFetch(`/decks/${deckId}/cards/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ cardIds }),
});

export const saveStudySession = (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType) =>
    authFetch(`/study-sessions`, {
        method: 'POST',
        body: JSON.stringify({
            deck_id: deckId,
            cards_studied: cardsStudied,
            cards_correct: cardsCorrect,
            duration_seconds: durationSeconds,
            session_type: sessionType,
        }),
    });

export const getDeckStats = (deckId) => safeFetchObject(authFetch(`/decks/${deckId}/stats`), {});

export const getThemes = () => safeFetchArray(authFetch('/themes'));
export const createTheme = (themeData) => authFetch('/themes', {
    method: 'POST',
    body: JSON.stringify(themeData),
});
export const updateTheme = (id, themeData) => authFetch(`/themes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(themeData),
});
export const activateTheme = (id) => authFetch(`/themes/${id}/activate`, { method: 'PUT' });
export const deleteTheme = (id) => authFetch(`/themes/${id}`, { method: 'DELETE' });

// ============ SHARING ENDPOINTS ============

export const acceptSharedDeck = (messageId) => authFetch(`/messages/${messageId}/accept-deck`, { method: 'POST' });

// ============ GUEST DATA MIGRATION ============

export const migrateGuestData = (guestData) => authFetch('/auth/migrate-guest-data', {
    method: 'POST',
    body: JSON.stringify(guestData),
});

// ============ SOCIAL / FRIENDS ============

export const searchUsers = (query) => safeFetchArray(authFetch(`/users/search?q=${encodeURIComponent(query)}`));
export const getUserProfile = (userId) => authFetch(`/users/${userId}`);
export const getFriends = () => safeFetchArray(authFetch('/friends'));
export const sendFriendRequest = (userId) => authFetch('/friends/request', {
    method: 'POST',
    body: JSON.stringify({ userId }),
});
export const acceptFriendRequest = (userId) => authFetch('/friends/accept', {
    method: 'POST',
    body: JSON.stringify({ userId }),
});
export const removeFriend = (userId) => authFetch(`/friends/${userId}`, { method: 'DELETE' });

// ============ DIRECT MESSAGES ============

export const getConversations = () => safeFetchArray(authFetch('/messages/conversations'));
export const getMessages = (userId, limit, before) => {
    let url = `/messages/${userId}?limit=${limit || 50}`;
    if (before) url += `&before=${encodeURIComponent(before)}`;
    return safeFetchArray(authFetch(url));
};
export const sendMessage = (receiverId, content, messageType = 'text', deckData = null, imageUrl = null) => authFetch('/messages', {
    method: 'POST',
    body: JSON.stringify({ receiverId, content, messageType, deckData, imageUrl }),
});
export const editMessage = (id, content) => authFetch(`/messages/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ content }),
});
export const deleteMessage = (id) => authFetch(`/messages/${id}`, { method: 'DELETE' });
export const getUnreadCount = () => safeFetchObject(authFetch('/messages/unread/count'), { count: 0 });

// ============ ADMIN ENDPOINTS ============

export const adminGetAllUsers = () => safeFetchArray(authFetch('/admin/users'));
export const adminUpdateUser = (userId, updates) => authFetch(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
export const adminDeleteUser = (userId) => authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
export const adminGetStats = () => safeFetchObject(authFetch('/admin/stats'));
export const adminUpdateUserRole = (userId, role) => authFetch(`/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });

// Admin message functions
export const adminGetMessages = () => safeFetchArray(authFetch('/admin/messages'));
export const adminCreateMessage = (title, content, type, expiresAt) => authFetch('/admin/messages', {
    method: 'POST',
    body: JSON.stringify({ title, content, type, expiresAt })
});
export const adminUpdateMessage = (id, updates) => authFetch(`/admin/messages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
});
export const adminDeleteMessage = (id) => authFetch(`/admin/messages/${id}`, { method: 'DELETE' });

// User-facing message functions
export const getActiveMessages = () => safeFetchArray(authFetch('/messages'));
export const dismissMessage = (id) => authFetch(`/messages/${id}/dismiss`, { method: 'POST' });

// ============ 2FA ENDPOINTS ============

export const setup2FA = () => authFetch('/auth/2fa/setup', { method: 'POST' });
export const verify2FA = (token) => authFetch('/auth/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ token })
});
export const disable2FA = (password) => authFetch('/auth/2fa/disable', {
    method: 'POST',
    body: JSON.stringify({ password })
});
export const login2FA = async (tempToken, token) => {
    const data = await authFetch('/auth/2fa/login', {
        method: 'POST',
        body: JSON.stringify({ tempToken, token })
    });
    if (data.token) {
        setToken(data.token);
    }
    return data.user;
};

export default {
    getToken,
    setToken,
    register,
    login,
    login2FA,
    logout,
    getMe,
    updateProfile,
    changePassword,
    deleteAccount,
    getStreak,
    updateStreak,
    getPetCustomization,
    updatePetCustomization,
    setup2FA,
    verify2FA,
    disable2FA,
    getFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    getTags,
    createTag,
    deleteTag,
    getDecks,
    getDeck,
    createDeck,
    updateDeck,
    deleteDeck,
    duplicateDeck,
    addCard,
    updateCard,
    deleteCard,
    reviewCard,
    reorderCards,
    saveStudySession,
    getDeckStats,
    getThemes,
    createTheme,
    updateTheme,
    activateTheme,
    acceptSharedDeck,
    migrateGuestData,
    searchUsers,
    getUserProfile,
    getFriends,
    sendFriendRequest,
    acceptFriendRequest,
    removeFriend,
    getConversations,
    getMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    getUnreadCount,
    adminGetAllUsers,
    adminUpdateUser,
    adminDeleteUser,
    adminGetStats,
    adminUpdateUserRole,
    adminGetMessages,
    adminCreateMessage,
    adminUpdateMessage,
    adminDeleteMessage,
    getActiveMessages,
    dismissMessage,
};
