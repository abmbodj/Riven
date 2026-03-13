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

const parseJsonish = (value) => {
    if (!value) return null;
    if (typeof value === 'object') return value;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const getDeckTags = async (deckIds) => {
    if (!deckIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from('deck_tags')
        .select('deck_id, tag_id')
        .in('deck_id', deckIds);
    if (error) _sbThrow(error);
    return data || [];
};

const getTagsByIds = async (tagIds) => {
    if (!tagIds.length) {
        return [];
    }

    const { data, error } = await supabase
        .from('tags')
        .select('*')
        .in('id', tagIds);
    if (error) _sbThrow(error);
    return data || [];
};

const validateDeck = (title, description) => {
    if (!title) {
        const error = new Error('Title is required');
        error.status = 400;
        throw error;
    }
    if (title.length > 200) {
        const error = new Error('Title must be under 200 characters');
        error.status = 400;
        throw error;
    }
    if (description && description.length > 2000) {
        const error = new Error('Description must be under 2000 characters');
        error.status = 400;
        throw error;
    }
};

const validateCardContent = (front, back, front_image, back_image) => {
    if ((!front && !front_image) || (!back && !back_image)) {
        const error = new Error('Front and back content (text or image) are required');
        error.status = 400;
        throw error;
    }
    if (front && front.length > 5000) {
        const error = new Error('Front content must be under 5000 characters');
        error.status = 400;
        throw error;
    }
    if (back && back.length > 5000) {
        const error = new Error('Back content must be under 5000 characters');
        error.status = 400;
        throw error;
    }
};

export const getDecks = async () => {
    const { data: decks, error } = await supabase
        .from('decks')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) _sbThrow(error);

    const deckRows = decks || [];
    if (deckRows.length === 0) {
        return [];
    }

    const deckIds = deckRows.map((deck) => deck.id);
    const [deckTags, cards] = await Promise.all([
        getDeckTags(deckIds),
        supabase.from('cards').select('deck_id').in('deck_id', deckIds).then(({ data, error: cardsError }) => {
            if (cardsError) _sbThrow(cardsError);
            return data || [];
        }),
    ]);

    const tags = await getTagsByIds([...new Set(deckTags.map((row) => row.tag_id))]);
    const tagsById = new Map(tags.map((tag) => [tag.id, tag]));
    const tagIdsByDeck = new Map();
    const cardCountByDeck = new Map();

    for (const row of deckTags) {
        const existing = tagIdsByDeck.get(row.deck_id) || [];
        existing.push(row.tag_id);
        tagIdsByDeck.set(row.deck_id, existing);
    }

    for (const card of cards) {
        cardCountByDeck.set(card.deck_id, (cardCountByDeck.get(card.deck_id) || 0) + 1);
    }

    return deckRows.map((deck) => ({
        ...deck,
        cardCount: cardCountByDeck.get(deck.id) || 0,
        tags: (tagIdsByDeck.get(deck.id) || [])
            .map((tagId) => tagsById.get(tagId))
            .filter(Boolean),
    }));
};

export const getDeck = async (id) => {
    const deckId = Number(id);
    const { data: deck, error } = await supabase
        .from('decks')
        .select('*')
        .eq('id', deckId)
        .single();
    if (error) _sbThrow(error);

    const [cardsResult, deckTags] = await Promise.all([
        supabase
            .from('cards')
            .select('*')
            .eq('deck_id', deckId)
            .order('position')
            .then(({ data, error: cardsError }) => {
                if (cardsError) _sbThrow(cardsError);
                return data || [];
            }),
        getDeckTags([deckId]),
    ]);

    const tags = await getTagsByIds(deckTags.map((row) => row.tag_id));
    return {
        ...deck,
        cards: cardsResult,
        tags,
    };
};

export const createDeck = async (title, description, folderId, tagIds = [], classId = null) => {
    validateDeck(title, description);

    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('decks')
        .insert({
            user_id: userId,
            title,
            description: description || '',
            folder_id: folderId || null,
            class_id: classId || null,
        })
        .select()
        .single();
    if (error) _sbThrow(error);

    if (tagIds.length > 0) {
        const { error: deckTagsError } = await supabase
            .from('deck_tags')
            .insert(tagIds.map((tagId) => ({ deck_id: data.id, tag_id: tagId })));
        if (deckTagsError) _sbThrow(deckTagsError);
    }

    return data;
};

export const updateDeck = async (id, title, description, folderId, tagIds = [], classId = null) => {
    validateDeck(title, description);

    const deckId = Number(id);
    const { data, error } = await supabase
        .from('decks')
        .update({
            title,
            description: description || '',
            folder_id: folderId || null,
            class_id: classId || null,
        })
        .eq('id', deckId)
        .select()
        .single();
    if (error) _sbThrow(error);

    const { error: deleteTagsError } = await supabase
        .from('deck_tags')
        .delete()
        .eq('deck_id', deckId);
    if (deleteTagsError) _sbThrow(deleteTagsError);

    if (tagIds.length > 0) {
        const { error: insertTagsError } = await supabase
            .from('deck_tags')
            .insert(tagIds.map((tagId) => ({ deck_id: deckId, tag_id: tagId })));
        if (insertTagsError) _sbThrow(insertTagsError);
    }

    return data;
};

export const deleteDeck = async (id) => {
    const { error } = await supabase
        .from('decks')
        .delete()
        .eq('id', Number(id));
    if (error) _sbThrow(error);
    return { message: 'Deck deleted' };
};

export const duplicateDeck = async (id) => {
    const [sourceDeck, userId] = await Promise.all([
        getDeck(id),
        getAppUserId(),
    ]);

    if (sourceDeck.user_id !== userId) {
        const error = new Error('Not authorized');
        error.status = 403;
        throw error;
    }

    const { data: newDeck, error } = await supabase
        .from('decks')
        .insert({
            user_id: userId,
            title: `${sourceDeck.title} (Copy)`,
            description: sourceDeck.description || '',
            folder_id: sourceDeck.folder_id || null,
            class_id: sourceDeck.class_id || null,
        })
        .select()
        .single();
    if (error) _sbThrow(error);

    if (sourceDeck.cards?.length > 0) {
        const { error: cardsError } = await supabase
            .from('cards')
            .insert(sourceDeck.cards.map((card) => ({
                deck_id: newDeck.id,
                front: card.front || '',
                back: card.back || '',
                front_image: card.front_image || null,
                back_image: card.back_image || null,
                position: card.position || 0,
            })));
        if (cardsError) _sbThrow(cardsError);
    }

    if (sourceDeck.tags?.length > 0) {
        const { error: tagsError } = await supabase
            .from('deck_tags')
            .insert(sourceDeck.tags.map((tag) => ({
                deck_id: newDeck.id,
                tag_id: tag.id,
            })));
        if (tagsError) _sbThrow(tagsError);
    }

    return newDeck;
};

export const addCard = async (deckId, front, back, front_image = null, back_image = null) => {
    validateCardContent(front, back, front_image, back_image);

    const numericDeckId = Number(deckId);
    const { data: cards, error: cardsError } = await supabase
        .from('cards')
        .select('position')
        .eq('deck_id', numericDeckId);
    if (cardsError) _sbThrow(cardsError);

    const maxPosition = (cards || []).reduce((max, card) => Math.max(max, card.position || 0), -1);
    const { data, error } = await supabase
        .from('cards')
        .insert({
            deck_id: numericDeckId,
            front: front || '',
            back: back || '',
            front_image: front_image || null,
            back_image: back_image || null,
            position: maxPosition + 1,
        })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateCard = async (id, front, back, front_image, back_image) => {
    validateCardContent(front, back, front_image, back_image);

    const updates = {
        front: front || '',
        back: back || '',
    };
    if (front_image !== undefined) updates.front_image = front_image;
    if (back_image !== undefined) updates.back_image = back_image;

    const { data, error } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', Number(id))
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteCard = async (id) => {
    const { error } = await supabase
        .from('cards')
        .delete()
        .eq('id', Number(id));
    if (error) _sbThrow(error);
    return { message: 'Card deleted' };
};

export const reviewCard = async (id, correct) => {
    const cardId = Number(id);
    const { data: card, error: cardError } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .single();
    if (cardError) _sbThrow(cardError);

    const currentDifficulty = card.difficulty || 0;
    const nextDifficulty = correct
        ? Math.min(5, currentDifficulty + 1)
        : Math.max(0, currentDifficulty - 1);
    const intervals = [1, 3, 7, 14, 30, 60];
    const now = new Date();
    const nextReview = new Date(now);
    nextReview.setDate(nextReview.getDate() + intervals[nextDifficulty]);

    const { data, error } = await supabase
        .from('cards')
        .update({
            difficulty: nextDifficulty,
            times_reviewed: (card.times_reviewed || 0) + 1,
            times_correct: correct ? (card.times_correct || 0) + 1 : (card.times_correct || 0),
            last_reviewed: now.toISOString(),
            next_review: nextReview.toISOString(),
        })
        .eq('id', cardId)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const reorderCards = async (deckId, cardIds) => {
    if (!Array.isArray(cardIds)) {
        const error = new Error('cardIds array is required');
        error.status = 400;
        throw error;
    }

    await Promise.all(cardIds.map(async (cardId, position) => {
        const { error } = await supabase
            .from('cards')
            .update({ position })
            .eq('id', Number(cardId));
        if (error) _sbThrow(error);
    }));

    return { message: 'Cards reordered' };
};

export const saveStudySession = async (deckId, cardsStudied, cardsCorrect, durationSeconds, sessionType) => {
    const numericDeckId = Number(deckId);
    const { data, error } = await supabase
        .from('study_sessions')
        .insert({
            deck_id: numericDeckId,
            cards_studied: cardsStudied || 0,
            cards_correct: cardsCorrect || 0,
            duration_seconds: durationSeconds || 0,
            session_type: sessionType || 'study',
        })
        .select()
        .single();
    if (error) _sbThrow(error);

    const { error: deckError } = await supabase
        .from('decks')
        .update({ last_studied: new Date().toISOString() })
        .eq('id', numericDeckId);
    if (deckError) _sbThrow(deckError);

    return data;
};

export const getDeckStats = async (deckId) => {
    const numericDeckId = Number(deckId);
    const [{ data: sessions, error: sessionsError }, { data: cards, error: cardsError }] = await Promise.all([
        supabase
            .from('study_sessions')
            .select('*')
            .eq('deck_id', numericDeckId)
            .order('created_at', { ascending: false }),
        supabase
            .from('cards')
            .select('*')
            .eq('deck_id', numericDeckId),
    ]);

    if (sessionsError) _sbThrow(sessionsError);
    if (cardsError) _sbThrow(cardsError);

    const sessionRows = sessions || [];
    const cardRows = cards || [];
    const totalStudied = sessionRows.reduce((sum, session) => sum + (session.cards_studied || 0), 0);
    const totalCorrect = sessionRows.reduce((sum, session) => sum + (session.cards_correct || 0), 0);
    const totalTime = sessionRows.reduce((sum, session) => sum + (session.duration_seconds || 0), 0);

    const cardsByDifficulty = {
        new: cardRows.filter((card) => (card.times_correct || 0) === 0 && (card.times_reviewed || 0) === 0).length,
        learning: cardRows.filter((card) => (card.times_reviewed || 0) > 0 && (card.times_correct || 0) < 2).length,
        familiar: cardRows.filter((card) => (card.times_correct || 0) >= 2 && (card.times_correct || 0) < 5).length,
        mastered: cardRows.filter((card) => (card.times_correct || 0) >= 5).length,
    };

    return {
        totalSessions: sessionRows.length,
        totalCardsStudied: totalStudied,
        totalStudied,
        totalCorrect,
        accuracy: totalStudied > 0 ? Math.round((totalCorrect / totalStudied) * 100) : 0,
        totalTimeSeconds: totalTime,
        totalTime,
        cardCount: cardRows.length,
        masteredCount: cardsByDifficulty.mastered,
        cardsByDifficulty,
        recentSessions: sessionRows.slice(0, 10),
    };
};

export const getThemes = async () => {
    const { data, error } = await supabase.from('themes').select('*');
    if (error) _sbThrow(error);

    return (data || []).sort((left, right) => {
        const defaultDelta = Number(right.is_default) - Number(left.is_default);
        if (defaultDelta !== 0) return defaultDelta;
        return (left.name || '').localeCompare(right.name || '');
    });
};

export const createTheme = async (themeData) => {
    const userId = await getAppUserId();
    const payload = {
        user_id: userId,
        name: themeData.name,
        bg_color: themeData.bg_color,
        surface_color: themeData.surface_color,
        text_color: themeData.text_color,
        secondary_text_color: themeData.secondary_text_color,
        border_color: themeData.border_color,
        accent_color: themeData.accent_color,
        font_family_display: themeData.font_family_display || 'Cormorant Garamond',
        font_family_body: themeData.font_family_body || 'Lora',
        is_active: 0,
        is_default: 0,
    };

    const { data, error } = await supabase
        .from('themes')
        .insert(payload)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateTheme = async (id, themeData) => {
    const updates = {};
    if (themeData.name !== undefined) updates.name = themeData.name;
    if (themeData.bg_color !== undefined) updates.bg_color = themeData.bg_color;
    if (themeData.surface_color !== undefined) updates.surface_color = themeData.surface_color;
    if (themeData.text_color !== undefined) updates.text_color = themeData.text_color;
    if (themeData.secondary_text_color !== undefined) updates.secondary_text_color = themeData.secondary_text_color;
    if (themeData.border_color !== undefined) updates.border_color = themeData.border_color;
    if (themeData.accent_color !== undefined) updates.accent_color = themeData.accent_color;
    if (themeData.font_family_display !== undefined) updates.font_family_display = themeData.font_family_display;
    if (themeData.font_family_body !== undefined) updates.font_family_body = themeData.font_family_body;

    const { data, error } = await supabase
        .from('themes')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const activateTheme = async (id) => {
    const userId = await getAppUserId();

    const { error: clearError } = await supabase
        .from('themes')
        .update({ is_active: 0 })
        .eq('user_id', userId);
    if (clearError) _sbThrow(clearError);

    const { data, error } = await supabase
        .from('themes')
        .update({ is_active: 1 })
        .eq('id', id)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteTheme = async (id) => {
    const { error } = await supabase.from('themes').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Theme deleted' };
};

// ============ SHARING ENDPOINTS ============

export const acceptSharedDeck = (messageId) => authFetch(`/messages/${messageId}/accept-deck`, { method: 'POST' });

// ============ GUEST DATA MIGRATION ============

export const migrateGuestData = (guestData) => authFetch('/auth/migrate-guest-data', {
    method: 'POST',
    body: JSON.stringify(guestData),
});

// ============ SOCIAL / FRIENDS ============

const normalizeRoleFlags = (row) => {
    const role = row.role || (row.is_owner ? 'owner' : row.is_admin ? 'admin' : 'user');
    const isOwner = Boolean(row.is_owner || role === 'owner');
    const isAdmin = Boolean(row.is_admin || isOwner || role === 'admin');

    return { role, isAdmin, isOwner };
};

const mapSocialUserRow = (row) => {
    const { role, isAdmin, isOwner } = normalizeRoleFlags(row);

    return {
        id: row.id,
        username: row.username,
        avatar: row.avatar || null,
        banner: row.banner || null,
        bio: row.bio || '',
        shareCode: row.share_code || null,
        role,
        isAdmin,
        isOwner,
    };
};

const mapPublicProfileRow = (row) => {
    const { role, isAdmin, isOwner } = normalizeRoleFlags(row);

    return {
        id: row.id,
        username: row.username,
        avatar: row.avatar || null,
        banner: row.banner || null,
        bio: row.bio || '',
        shareCode: row.share_code || null,
        createdAt: row.created_at || null,
        role,
        isAdmin,
        isOwner,
        deckCount: Number(row.deck_count || 0),
        friendshipStatus: row.friendship_status || null,
        friendshipDirection: row.friendship_direction || null,
    };
};

const mapFriendRow = (row) => {
    const { role, isAdmin, isOwner } = normalizeRoleFlags(row);

    return {
        id: row.id,
        username: row.username,
        avatar: row.avatar || null,
        bio: row.bio || '',
        status: row.status,
        role,
        isAdmin,
        isOwner,
        isOutgoing: Boolean(row.is_outgoing),
        createdAt: row.created_at || null,
    };
};

export const searchUsers = async (query) => {
    const trimmedQuery = (query || '').trim();
    if (trimmedQuery.length < 2) {
        return [];
    }

    const { data, error } = await supabase.rpc('search_public_users', {
        search_query: trimmedQuery,
    });
    if (error) _sbThrow(error);
    return (data || []).map(mapSocialUserRow);
};

export const getUserProfile = async (userId) => {
    const { data, error } = await supabase.rpc('get_public_user_profile', {
        target_user_id: Number(userId),
    });
    if (error) _sbThrow(error);

    const profileRow = Array.isArray(data) ? data[0] : data;
    if (!profileRow) {
        const err = new Error('User not found');
        err.status = 404;
        throw err;
    }

    return mapPublicProfileRow(profileRow);
};

export const getFriends = async () => {
    const { data, error } = await supabase.rpc('list_friends');
    if (error) _sbThrow(error);
    return (data || []).map(mapFriendRow);
};

export const sendFriendRequest = async (userId) => {
    const { data, error } = await supabase.rpc('send_friend_request', {
        target_user_id: Number(userId),
    });
    if (error) _sbThrow(error);
    return data || { message: 'Friend request sent' };
};

export const acceptFriendRequest = async (userId) => {
    const { data, error } = await supabase.rpc('accept_friend_request', {
        requester_user_id: Number(userId),
    });
    if (error) _sbThrow(error);
    return data || { message: 'Friend request accepted' };
};

export const removeFriend = async (userId) => {
    const { data, error } = await supabase.rpc('remove_friendship', {
        target_user_id: Number(userId),
    });
    if (error) _sbThrow(error);
    return data || { message: 'Friend removed' };
};

// ============ MODERATION (BLOCKS & REPORTS) ============
export const blockUser = (userId) => authFetch(`/users/${userId}/block`, { method: 'POST' });
export const unblockUser = (userId) => authFetch(`/users/${userId}/block`, { method: 'DELETE' });
export const getBlockedUsers = () => safeFetchArray(authFetch('/blocked-users'));
export const reportContent = (reportData) => authFetch('/reports', {
    method: 'POST',
    body: JSON.stringify(reportData)
});

// ============ DIRECT MESSAGES ============

const mapMessageRow = (row, currentUser) => ({
    id: row.id,
    senderId: row.sender_id,
    receiverId: row.receiver_id,
    senderUsername: row.sender_id === currentUser.id ? currentUser.username || null : null,
    senderAvatar: row.sender_id === currentUser.id ? currentUser.avatar || null : null,
    content: row.content,
    messageType: row.message_type || 'text',
    deckData: parseJsonish(row.deck_data),
    imageUrl: row.image_url || null,
    isEdited: Boolean(row.is_edited),
    isRead: Boolean(row.is_read),
    createdAt: row.created_at,
    isMine: row.sender_id === currentUser.id,
});

export const getConversations = async () => {
    const currentUser = await getMe();
    const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
    if (error) _sbThrow(error);

    const messages = data || [];
    const grouped = new Map();

    for (const message of messages) {
        const otherUserId = message.sender_id === currentUser.id
            ? message.receiver_id
            : message.sender_id;
        const existing = grouped.get(otherUserId);

        if (!existing) {
            grouped.set(otherUserId, {
                userId: otherUserId,
                lastMessage: message.content,
                lastMessageType: message.message_type || 'text',
                lastMessageAt: message.created_at,
                isOwnMessage: message.sender_id === currentUser.id,
                unreadCount: message.receiver_id === currentUser.id && !message.is_read ? 1 : 0,
            });
            continue;
        }

        if (message.receiver_id === currentUser.id && !message.is_read) {
            existing.unreadCount += 1;
        }
    }

    const profiles = await Promise.all([...grouped.keys()].map(async (userId) => {
        const profile = await getUserProfile(userId);
        return [userId, profile];
    }));
    const profileMap = new Map(profiles);

    return [...grouped.values()]
        .map((conversation) => ({
            ...conversation,
            username: profileMap.get(conversation.userId)?.username || 'Unknown',
            avatar: profileMap.get(conversation.userId)?.avatar || null,
        }))
        .sort((left, right) => new Date(right.lastMessageAt) - new Date(left.lastMessageAt));
};

export const getMessages = async (userId, limit = 50, before) => {
    const currentUser = await getMe();
    let query = supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${Number(userId)}),and(sender_id.eq.${Number(userId)},receiver_id.eq.${currentUser.id})`);

    if (before) {
        query = query.lt('created_at', before);
    }

    const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(limit || 50);
    if (error) _sbThrow(error);

    const { error: readError } = await supabase.rpc('mark_messages_read', {
        other_user_id: Number(userId),
    });
    if (readError) _sbThrow(readError);

    return (data || [])
        .slice()
        .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
        .map((row) => mapMessageRow(row, currentUser));
};

export const sendMessage = async (receiverId, content, messageType = 'text', deckData = null, imageUrl = null) => {
    if (!receiverId) {
        const error = new Error('Receiver ID is required');
        error.status = 400;
        throw error;
    }
    if (!content && !imageUrl && !deckData) {
        const error = new Error('Message content, image or deck is required');
        error.status = 400;
        throw error;
    }
    if (content && typeof content === 'string' && content.trim().length === 0 && !imageUrl && !deckData) {
        const error = new Error('Message content cannot be empty');
        error.status = 400;
        throw error;
    }
    if (content && content.length > 5000) {
        const error = new Error('Message content must be under 5000 characters');
        error.status = 400;
        throw error;
    }

    const currentUser = await getMe();
    const { data, error } = await supabase
        .from('messages')
        .insert({
            sender_id: currentUser.id,
            receiver_id: Number(receiverId),
            content: content || '',
            message_type: messageType || 'text',
            deck_data: deckData ? JSON.stringify(deckData) : null,
            image_url: imageUrl || null,
        })
        .select()
        .single();
    if (error) _sbThrow(error);
    return mapMessageRow(data, currentUser);
};

export const editMessage = async (id, content) => {
    if (!content) {
        const error = new Error('Message content is required');
        error.status = 400;
        throw error;
    }

    const currentUser = await getMe();
    const { data, error } = await supabase
        .from('messages')
        .update({
            content,
            is_edited: 1,
        })
        .eq('id', Number(id))
        .select()
        .single();
    if (error) _sbThrow(error);
    return mapMessageRow(data, currentUser);
};

export const deleteMessage = async (id) => {
    const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', Number(id));
    if (error) _sbThrow(error);
    return { success: true };
};

export const getUnreadCount = async () => {
    const currentUser = await getMe();
    const { count, error } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .eq('is_read', 0);
    if (error) _sbThrow(error);
    return { count: count || 0 };
};

export const subscribeToMessages = (currentUserId, handlers = {}) => {
    const channel = supabase
        .channel(`messages_${currentUserId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            handlers.onInsert?.(mapMessageRow(payload.new, { id: currentUserId }));
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
            handlers.onUpdate?.(mapMessageRow(payload.new, { id: currentUserId }));
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
            handlers.onDelete?.(mapMessageRow(payload.old, { id: currentUserId }));
        });

    channel.subscribe();
    return () => supabase.removeChannel(channel);
};

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
    subscribeToMessages,
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
