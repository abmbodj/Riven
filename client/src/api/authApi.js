import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabaseClient';

// Authentication API - communicates with server for cross-device sync
// Set VITE_API_URL for production (e.g. Render backend URL)
let API_BASE = import.meta.env.VITE_API_URL;

if (!API_BASE) {
    if (Capacitor.isNativePlatform()) {
        // On iOS Simulator, localhost correctly resolving to the Mac's host IP for servers
        // (Note: For physical devices, VITE_API_URL must be explicitly set to the Mac's local network IP in .env)
        API_BASE = 'http://localhost:3000/api';
    } else {
        API_BASE = '/api';
    }
}

// Remove trailing slash if present to avoid double slashes
if (API_BASE && API_BASE.endsWith('/')) {
    API_BASE = API_BASE.slice(0, -1);
}

export const getApiBase = () => API_BASE;



// Helper functions for local auth state
// Store actual JWT on all platforms so Authorization header works as fallback
// when httpOnly cookies fail (e.g. iOS PWA/Add-to-Home-Screen has separate cookie jar)
export const getToken = () => localStorage.getItem('riven_auth_token');
let cachedAppUserId = null;
let cachedAuthToken = null;

export const setToken = (token) => {
    const normalizedToken = token || null;

    if (normalizedToken) {
        localStorage.setItem('riven_auth_token', normalizedToken);
    } else {
        localStorage.removeItem('riven_auth_token');
    }

    if (normalizedToken !== cachedAuthToken) {
        cachedAppUserId = null;
        cachedAuthToken = normalizedToken;
    }
};

// Fetch wrapper with dual auth (Cookie + Header)
const authFetch = async (endpoint, options = {}) => {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    // Always attach Authorization header as fallback for when cookies fail
    // (iOS PWA mode, Safari ITP, cross-origin on native, etc.)
    if (token && token !== 'logged_in') {
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


// Helper for safe data fetching — returns defaults for network/server errors,
// but re-throws auth errors (401/403) so session expiry is properly handled
const safeFetchArray = async (promise) => {
    try {
        const data = await promise;
        return Array.isArray(data) ? data : [];
    } catch (err) {
        if (err.status === 401 || err.status === 403) throw err;
        console.error('[authApi] Fetch failed (returning []):', err.message || err);
        return [];
    }
};

const safeFetchObject = async (promise, defaultVal = {}) => {
    try {
        const data = await promise;
        return data || defaultVal;
    } catch (err) {
        if (err.status === 401 || err.status === 403) throw err;
        console.error('[authApi] Fetch failed (returning default):', err.message || err);
        return defaultVal;
    }
};

// ============ AUTH ENDPOINTS ============

// Helper: create the app user row after a Supabase Auth signup/OAuth login.
// The Supabase access token must already be stored via setToken().
const completeRegistration = async (username) => {
    return authFetch('/auth/complete-registration', {
        method: 'POST',
        body: JSON.stringify({ username }),
    });
};

const bootstrapSupabaseSession = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error || !data.session?.access_token) {
        return null;
    }

    setToken(data.session.access_token);

    try {
        const result = await completeRegistration();
        return { user: result.user };
    } catch (err) {
        console.warn('[login] Supabase bootstrap failed after legacy login:', err.message);
        await supabase.auth.signOut().catch(() => {});
        setToken(null);
        return null;
    }
};

export const register = async (username, email, password) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
    });

    if (!error && data.session) {
        // Supabase confirmed immediately (email confirmation disabled in dashboard).
        setToken(data.session.access_token);
        try {
            const result = await completeRegistration(username);
            return result.user;
        } catch (e) {
            // complete-registration failed (e.g. JWT secret misconfiguration on server).
            // Clear the Supabase token and fall through to legacy register.
            console.warn('[register] complete-registration failed, falling back to legacy:', e.message);
            setToken(null);
        }
    }

    // Email confirmation required, Supabase signup failed, or complete-registration failed —
    // fall back to legacy Express register for immediate login.
    // The Supabase user (if created) will be linked on first confirmed login.
    const legacyData = await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
    });
    if (legacyData.token) setToken(legacyData.token);
    return legacyData.user;
};

export const login = async (email, password) => {
    // Try Supabase Auth first (new users and migrated users)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && data.session) {
        setToken(data.session.access_token);
        // Ensure the user row exists in our DB (handles first-time login after migration)
        try {
            const result = await completeRegistration();
            return { user: result.user };
        } catch {
            // User row already exists — fetch normally
            const user = await authFetch('/auth/me');
            return { user };
        }
    }

    // Supabase Auth failed — fall back to legacy Express login (existing users not yet in Supabase)
    const legacyData = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (legacyData.require2FA) {
        return legacyData;
    }

    if (legacyData.token) {
        const bootstrappedSession = await bootstrapSupabaseSession(email, password);
        if (bootstrappedSession?.user) {
            return bootstrappedSession;
        }
        setToken(legacyData.token);
    }
    else if (legacyData.user) setToken('logged_in');
    return legacyData;
};

export const loginWithGoogle = async (credential) => {
    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
    });
    if (error) throw new Error(error.message);
    setToken(data.session.access_token);
    const result = await completeRegistration();
    return { user: result.user };
};

export const loginWithApple = async (identityToken, _user) => {
    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
    });
    if (error) throw new Error(error.message);
    setToken(data.session.access_token);
    const result = await completeRegistration();
    return { user: result.user };
};

export const logout = async () => {
    try {
        // Sign out of Supabase (clears Supabase session storage)
        await supabase.auth.signOut();
        // Also clear legacy httpOnly cookie
        await authFetch('/auth/logout', { method: 'POST' }).catch(() => {});
    } finally {
        setToken(null);
    }
};

export const getMe = async () => {
    return authFetch('/auth/me');
};

// Refresh the stored token from the active Supabase session.
// Call this on app startup to ensure the token is up to date.
export const refreshSupabaseToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        setToken(session.access_token);
        return session.access_token;
    }
    return null;
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

// ============ DATA ENDPOINTS — Supabase PostgREST (Phase 2) ============
// RLS policies handle auth — see supabase/migrations/phase2_rls_policies.sql

/** Throw in the same shape authFetch uses so callers don't break */
const _sbThrow = (error) => {
    const err = new Error(error.message || 'Supabase query failed');
    err.status = error.code === 'PGRST301' ? 401 : 500;
    throw err;
};

const getAppUserId = async () => {
    const token = getToken();
    if (!token) {
        throw new Error('Must be logged in to write data');
    }

    if (cachedAppUserId && cachedAuthToken === token) {
        return cachedAppUserId;
    }

    const user = await getMe();
    if (!user?.id) {
        throw new Error('Failed to resolve the current user for Supabase writes');
    }

    cachedAppUserId = user.id;
    cachedAuthToken = token;
    return cachedAppUserId;
};

// --- Folders (PostgREST) ---

export const getFolders = async () => {
    const { data, error } = await supabase
        .from('folders')
        .select('*, decks(count)')
        .order('created_at', { ascending: false });
    if (error) _sbThrow(error);
    return (data || []).map(f => ({ ...f, deckCount: f.decks?.[0]?.count ?? 0 }));
};

export const createFolder = async (name, color, icon) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('folders')
        .insert({ user_id: userId, name, color: color || '#6366f1', icon: icon || 'folder' })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateFolder = async (id, name, color, icon) => {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (icon !== undefined) updates.icon = icon;
    const { data, error } = await supabase
        .from('folders')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteFolder = async (id) => {
    // Unlink decks before deleting folder
    await supabase.from('decks').update({ folder_id: null }).eq('folder_id', id);
    const { error } = await supabase.from('folders').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Folder deleted' };
};

// --- Tags (PostgREST) ---

export const getTags = async () => {
    const { data, error } = await supabase
        .from('tags')
        .select('*')
        .order('is_preset', { ascending: false })
        .order('name');
    if (error) _sbThrow(error);
    return data || [];
};

export const createTag = async (name, color) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('tags')
        .insert({ user_id: userId, name, color, is_preset: false })
        .select()
        .single();
    if (error) {
        if (error.code === '23505') { // unique_violation
            const err = new Error('Tag already exists');
            err.status = 400;
            throw err;
        }
        _sbThrow(error);
    }
    return data;
};

export const deleteTag = async (id) => {
    const { error } = await supabase.from('tags').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Tag deleted' };
};

// ============ CLASSES ENDPOINTS (PostgREST) ============

export const getClasses = async () => {
    const { data, error } = await supabase
        .from('classes')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) _sbThrow(error);
    return data || [];
};

export const createClass = async (name, color, professor, room, zoom_link) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('classes')
        .insert({
            user_id: userId,
            name,
            color: color || null,
            professor: professor || null,
            room: room || null,
            zoom_link: zoom_link || null
        })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateClass = async (id, name, color, professor, room, zoom_link) => {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (professor !== undefined) updates.professor = professor;
    if (room !== undefined) updates.room = room;
    if (zoom_link !== undefined) updates.zoom_link = zoom_link;
    const { data, error } = await supabase
        .from('classes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteClass = async (id) => {
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Class deleted' };
};

// --- Assignments (PostgREST) ---

export const getAssignments = async (classId) => {
    let query = supabase.from('assignments').select('*').order('created_at', { ascending: false });
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) _sbThrow(error);
    return data || [];
};

export const createAssignment = async (class_id, title, description, due_date, type) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('assignments')
        .insert({
            user_id: userId,
            class_id,
            title,
            description: description || null,
            status: 'Todo',
            due_date: due_date || null,
            type: type || 'homework',
        })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateAssignment = async (id, updates) => {
    const { data, error } = await supabase
        .from('assignments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteAssignment = async (id) => {
    const { error } = await supabase.from('assignments').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Assignment deleted' };
};

// --- Schedule (PostgREST) ---

export const getSchedule = async () => {
    const { data, error } = await supabase
        .from('schedule_slots')
        .select('*');
    if (error) _sbThrow(error);
    return data || [];
};

export const createScheduleSlot = async (class_id, day_of_week, start_time, end_time) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('schedule_slots')
        .insert({ user_id: userId, class_id, day_of_week, start_time, end_time })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteScheduleSlot = async (id) => {
    const { error } = await supabase.from('schedule_slots').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Schedule slot deleted' };
};

// --- LMS Integration (Canvas)
export const connectCanvas = (icalUrl) => authFetch('/lms/canvas/connect', {
    method: 'POST',
    body: JSON.stringify({ icalUrl })
});
export const disconnectCanvas = () => authFetch('/lms/canvas/disconnect', { method: 'POST' });
export const getCanvasSettings = () => authFetch('/lms/settings');
export const syncCanvas = (adGranted = false) => authFetch('/lms/sync', { method: 'POST', body: JSON.stringify({ adGranted }) });

// --- AI Generation ---
export const getAILimits = () => authFetch('/ai/limits');
export const generateAiDeck = async (notes, file, deckName, classId) => {
    return await authFetch('/ai/generate-deck', {
        method: 'POST',
        body: JSON.stringify({ notes, file, deckName, classId })
    });
};

export const generateAiClass = async (notes, file) => {
    return await authFetch('/ai/generate-class', {
        method: 'POST',
        body: JSON.stringify({ notes, file })
    });
};

export const getDecks = () => safeFetchArray(authFetch('/decks'));
export const getDeck = (id) => authFetch(`/decks/${id}`);
export const createDeck = async (title, description, folderId, tagIds = [], classId = null) => {
    return await authFetch('/decks', {
        method: 'POST',
        body: JSON.stringify({ title, description, folder_id: folderId, tagIds, class_id: classId })
    });
};

export const updateDeck = async (id, title, description, folderId, tagIds = [], classId = null) => {
    return await authFetch(`/decks/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ title, description, folder_id: folderId, tagIds, class_id: classId })
    });
};
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

// ============ MODERATION (BLOCKS & REPORTS) ============
export const blockUser = (userId) => authFetch(`/users/${userId}/block`, { method: 'POST' });
export const unblockUser = (userId) => authFetch(`/users/${userId}/block`, { method: 'DELETE' });
export const getBlockedUsers = () => safeFetchArray(authFetch('/blocked-users'));
export const reportContent = (reportData) => authFetch('/reports', {
    method: 'POST',
    body: JSON.stringify(reportData)
});

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

// ============ STUDY GROUPS ============

export const getGroups = () => safeFetchArray(authFetch('/groups'));
export const createGroup = (name, class_id) => authFetch('/groups', {
    method: 'POST',
    body: JSON.stringify({ name, class_id })
});
export const getGroup = (id) => authFetch(`/groups/${id}`);
export const updateGroup = (id, updates) => authFetch(`/groups/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
});
export const deleteGroup = (id) => authFetch(`/groups/${id}`, { method: 'DELETE' });
export const joinGroup = (join_code) => authFetch('/groups/join', {
    method: 'POST',
    body: JSON.stringify({ join_code })
});
export const leaveGroup = (id) => authFetch(`/groups/${id}/leave`, { method: 'DELETE' });
export const getGroupMembers = (id) => safeFetchArray(authFetch(`/groups/${id}/members`));
export const removeGroupMember = (id, userId) => authFetch(`/groups/${id}/members/${userId}`, { method: 'DELETE' });

export const getGroupDecks = (id) => safeFetchArray(authFetch(`/groups/${id}/decks`));
export const shareDeckToGroup = (id, deck_id) => authFetch(`/groups/${id}/decks`, {
    method: 'POST',
    body: JSON.stringify({ deck_id })
});
export const removeDeckFromGroup = (id, deckId) => authFetch(`/groups/${id}/decks/${deckId}`, { method: 'DELETE' });

export const getGroupFolders = (id) => safeFetchArray(authFetch(`/groups/${id}/folders`));
export const createGroupFolder = (id, name) => authFetch(`/groups/${id}/folders`, {
    method: 'POST', body: JSON.stringify({ name })
});
export const renameGroupFolder = (id, folderId, name) => authFetch(`/groups/${id}/folders/${folderId}`, {
    method: 'PUT', body: JSON.stringify({ name })
});
export const deleteGroupFolder = (id, folderId) => authFetch(`/groups/${id}/folders/${folderId}`, { method: 'DELETE' });

export const getGroupFiles = (id, folderId = null) => safeFetchArray(authFetch(`/groups/${id}/files${folderId ? `?folder_id=${folderId}` : ''}`));
export const uploadGroupFile = (id, data) => authFetch(`/groups/${id}/files`, {
    method: 'POST',
    body: JSON.stringify(data)
});
export const deleteGroupFile = (id, fileId) => authFetch(`/groups/${id}/files/${fileId}`, {
    method: 'DELETE'
});

// Cram Sessions
export const getGroupSessions = (id) => safeFetchArray(authFetch(`/groups/${id}/sessions`));
export const startGroupSession = (id, deckId) => authFetch(`/groups/${id}/sessions`, {
    method: 'POST',
    body: JSON.stringify({ deck_id: deckId })
});
export const joinGroupSession = (sessionId) => authFetch(`/groups/sessions/${sessionId}/join`, {
    method: 'POST'
});
export const respondToSessionCard = (sessionId, cardId, knewIt) => authFetch(`/groups/sessions/${sessionId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ card_id: cardId, knew_it: knewIt })
});
export const getSessionResults = (sessionId) => authFetch(`/groups/sessions/${sessionId}/results`);
export const endGroupSession = (sessionId) => authFetch(`/groups/sessions/${sessionId}/end`, {
    method: 'POST'
});

// ============ ADMIN ENDPOINTS ============

export const adminGetAllUsers = () => safeFetchArray(authFetch('/admin/users'));
export const adminUpdateUser = (userId, updates) => authFetch(`/admin/users/${userId}`, { method: 'PUT', body: JSON.stringify(updates) });
export const adminDeleteUser = (userId) => authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
export const adminGetStats = () => safeFetchObject(authFetch('/admin/stats'));
export const adminUpdateUserRole = (userId, role) => authFetch(`/admin/users/${userId}/role`, { method: 'PUT', body: JSON.stringify({ role }) });

// Admin moderation functions
export const adminGetReports = () => safeFetchArray(authFetch('/admin/reports'));
export const adminResolveReport = (reportId) => authFetch(`/admin/reports/${reportId}/resolve`, { method: 'POST' });
export const adminCloseReport = (reportId) => authFetch(`/admin/reports/${reportId}/close`, { method: 'POST' });
export const adminBanUser = (userId) => authFetch(`/admin/users/${userId}/ban`, { method: 'POST' });

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

// ============ PASSWORD RESET ============

export const forgotPassword = (email) => authFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
});

export const resetPassword = (token, password) => authFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
});

// ============ EMAIL VERIFICATION ============

export const sendVerificationEmail = () => authFetch('/auth/send-verification', { method: 'POST' });

export const verifyEmail = (token) => authFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
});

// ============ HEARTS API ============
export const getHeartsStatus = () => authFetch('/users/hearts/status');
export const getSessionHearts = (deckId) => authFetch(`/users/hearts/session/${deckId}`);
export const decrementHeart = () => authFetch('/users/hearts/decrement', { method: 'POST' });
export const refillHearts = (amount) => authFetch('/users/hearts/refill', { method: 'POST', body: JSON.stringify({ amount }) });
export const practiceRefill = () => authFetch('/users/hearts/practice-refill', { method: 'POST' });

// Owner: Simulate Free Tier toggle
export const toggleSimulateFree = () => authFetch('/auth/simulate-free', { method: 'POST' });

// ============ REFERRALS API ============
export const getReferralInfo = () => authFetch('/referrals/me');
export const applyReferralCode = (code) => authFetch('/referrals/apply', { method: 'POST', body: JSON.stringify({ code }) });
export const checkReferralQualification = () => authFetch('/referrals/check-qualification', { method: 'POST' });

// Rewarded Ads API
export const getAdStatus = () => authFetch('/ads/status');
export const requestAdReward = (feature, options = {}) => authFetch('/ads/request-reward', { method: 'POST', body: JSON.stringify({ feature, ...options }) });
export const claimAdReward = (rewardToken) => authFetch('/ads/claim-reward', { method: 'POST', body: JSON.stringify({ rewardToken }) });

export default {
    getToken,
    setToken,
    register,
    login,
    loginWithGoogle,
    loginWithApple,
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
    getClasses,
    createClass,
    updateClass,
    deleteClass,

    // Assignments
    getAssignments,
    createAssignment,
    updateAssignment,
    deleteAssignment,
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
    generateAiClass,
    adminGetAllUsers,
    adminUpdateUser,
    adminDeleteUser,
    adminGetStats,
    adminUpdateUserRole,
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
    getGroups,
    createGroup,
    getGroup,
    updateGroup,
    deleteGroup,
    joinGroup,
    leaveGroup,
    getGroupMembers,
    removeGroupMember,
    getGroupDecks,
    shareDeckToGroup,
    removeDeckFromGroup,
    getGroupFolders,
    createGroupFolder,
    renameGroupFolder,
    deleteGroupFolder,
    getGroupFiles,
    uploadGroupFile,
    deleteGroupFile,
    blockUser,
    unblockUser,
    getBlockedUsers,
    reportContent,

    // Hearts API
    getHeartsStatus,
    getSessionHearts,
    decrementHeart,
    refillHearts,
    practiceRefill,

    // Owner: Simulate Free Tier toggle
    toggleSimulateFree,

    // Referrals API
    getReferralInfo,
    applyReferralCode,
    checkReferralQualification,

    // Password Reset
    forgotPassword,
    resetPassword,

    // Email Verification
    sendVerificationEmail,
    verifyEmail,

    // Rewarded Ads API
    getAdStatus,
    requestAdReward,
    claimAdReward,
};
