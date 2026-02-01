// Authentication API - communicates with server for cross-device sync
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const TOKEN_KEY = 'riven_auth_token';

// Get stored token
export const getToken = () => localStorage.getItem(TOKEN_KEY);

// Store token
export const setToken = (token) => {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
    } else {
        localStorage.removeItem(TOKEN_KEY);
    }
};

// Fetch wrapper with auth headers
const authFetch = async (endpoint, options = {}) => {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
};

// ============ AUTH ENDPOINTS ============

export const register = async (username, email, password) => {
    const data = await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
    });
    setToken(data.token);
    return data.user;
};

export const login = async (email, password) => {
    const data = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    return data.user;
};

export const logout = () => {
    setToken(null);
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
    setToken(null);
};

// ============ STREAK ENDPOINTS ============

export const getStreak = async () => {
    return authFetch('/auth/streak');
};

export const updateStreak = async (streakData) => {
    return authFetch('/auth/streak', {
        method: 'PUT',
        body: JSON.stringify({ streakData }),
    });
};

// ============ DATA ENDPOINTS (with auth) ============

export const getFolders = () => authFetch('/folders');
export const createFolder = (name, color, icon) => authFetch('/folders', {
    method: 'POST',
    body: JSON.stringify({ name, color, icon }),
});
export const updateFolder = (id, name, color, icon) => authFetch(`/folders/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ name, color, icon }),
});
export const deleteFolder = (id) => authFetch(`/folders/${id}`, { method: 'DELETE' });

export const getTags = () => authFetch('/tags');
export const createTag = (name, color) => authFetch('/tags', {
    method: 'POST',
    body: JSON.stringify({ name, color }),
});
export const deleteTag = (id) => authFetch(`/tags/${id}`, { method: 'DELETE' });

export const getDecks = () => authFetch('/decks');
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

export const addCard = (deckId, front, back) => authFetch(`/decks/${deckId}/cards`, {
    method: 'POST',
    body: JSON.stringify({ front, back }),
});
export const updateCard = (id, front, back) => authFetch(`/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ front, back }),
});
export const deleteCard = (id) => authFetch(`/cards/${id}`, { method: 'DELETE' });

export const reviewCard = (id, correct) => authFetch(`/cards/${id}/review`, {
    method: 'PUT',
    body: JSON.stringify({ correct }),
});

export const reorderCards = (deckId, cardIds) => authFetch(`/decks/${deckId}/reorder`, {
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

export const getDeckStats = (deckId) => authFetch(`/decks/${deckId}/stats`);

export const getThemes = () => authFetch('/themes');
export const createTheme = (themeData) => authFetch('/themes', {
    method: 'POST',
    body: JSON.stringify(themeData),
});
export const activateTheme = (id) => authFetch(`/themes/${id}/activate`, { method: 'PUT' });
export const deleteTheme = (id) => authFetch(`/themes/${id}`, { method: 'DELETE' });

// ============ SHARING ENDPOINTS ============

export const shareDeck = (deckId) => authFetch(`/decks/${deckId}/share`, { method: 'POST' });
export const getSharedDeck = (shareId) => authFetch(`/shared/${shareId}`);
export const importSharedDeck = (shareId) => authFetch(`/shared/${shareId}/import`, { method: 'POST' });
export const getMySharedDecks = () => authFetch('/my-shared-decks');
export const unshareDeck = (shareId) => authFetch(`/shared/${shareId}`, { method: 'DELETE' });

// ============ GUEST DATA MIGRATION ============

export const migrateGuestData = (guestData) => authFetch('/auth/migrate-guest-data', {
    method: 'POST',
    body: JSON.stringify(guestData),
});

// ============ ADMIN ENDPOINTS ============

export const adminGetAllUsers = () => authFetch('/admin/users');
export const adminUpdateUser = (userId, updates) => authFetch(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
export const adminDeleteUser = (userId) => authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
export const adminGetStats = () => authFetch('/admin/stats');

export default {
    getToken,
    setToken,
    register,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword,
    deleteAccount,
    getStreak,
    updateStreak,
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
    activateTheme,
    deleteTheme,
    shareDeck,
    getSharedDeck,
    importSharedDeck,
    getMySharedDecks,
    unshareDeck,
    migrateGuestData,
    adminGetAllUsers,
    adminUpdateUser,
    adminDeleteUser,
    adminGetStats,
};
