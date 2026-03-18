import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabaseClient';

// Authentication API - communicates with server for cross-device sync
// Set VITE_API_URL for the legacy Express server (used only for login/register/2FA bridges)
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



// SECURITY NOTE: Storing JWTs client-side is an XSS risk. We prefer httpOnly
// cookies (set by the server), but Capacitor/iOS PWA environments have broken
// cookie jars so we fall back to in-memory + sessionStorage. localStorage is
// only used on native platforms where XSS surface is minimal.
const TOKEN_KEY = 'riven_auth_token';
export const AUTH_SESSION_EXPIRED_CODE = 'AUTH_SESSION_EXPIRED';
export const AUTH_SESSION_EXPIRED_EVENT = 'riven-auth-session-expired';
const useLocalStorage = Capacitor.isNativePlatform();
const tokenStore = useLocalStorage ? localStorage : sessionStorage;

export const getToken = () => tokenStore.getItem(TOKEN_KEY);
let cachedAppUserId = null;
let cachedAuthToken = null;

export const setToken = (token) => {
    const normalizedToken = token || null;

    if (normalizedToken) {
        tokenStore.setItem(TOKEN_KEY, normalizedToken);
    } else {
        tokenStore.removeItem(TOKEN_KEY);
        localStorage.removeItem(TOKEN_KEY);
    }

    if (normalizedToken !== cachedAuthToken) {
        cachedAppUserId = null;
        cachedAuthToken = normalizedToken;
    }
};

const decodeJwtPayload = (token) => {
    if (typeof token !== 'string') return null;
    const segments = token.split('.');
    if (segments.length !== 3) return null;

    try {
        const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const json = atob(padded);
        return JSON.parse(json);
    } catch {
        return null;
    }
};

const isSupabaseAccessToken = (token) => {
    if (!token || token === 'logged_in') return false;
    const payload = decodeJwtPayload(token);
    if (!payload) return false;

    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    return audience.includes('authenticated') && typeof payload.sub === 'string' && payload.sub.length > 0;
};

const tokenBelongsToSupabaseUrl = (token, supabaseUrl) => {
    if (!token || !supabaseUrl) return false;
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.iss !== 'string') return false;

    try {
        const tokenIssuer = new URL(payload.iss);
        const expected = new URL(supabaseUrl);
        return tokenIssuer.host === expected.host;
    } catch {
        return false;
    }
};

const isTokenEligibleForEdge = (token) => (
    isSupabaseAccessToken(token)
    && !isJwtExpired(token)
);

const isJwtExpired = (token) => {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return false;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowInSeconds;
};

const shouldForceReauthFromEdgeError = (status, message) => {
    if (status !== 401) return false;
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('invalid jwt')
        || normalized.includes('invalid token')
        || normalized.includes('unauthorized')
        || normalized.includes('missing bearer');
};

const emitAuthSessionExpired = () => {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
    }
};

const forceReauth = async () => {
    if (typeof supabase?.auth?.signOut === 'function') {
        await supabase.auth.signOut().catch(() => {});
    }
    setToken(null);
    emitAuthSessionExpired();
};

function getCsrfToken() {
    const match = document.cookie.match(/(?:^|;\s*)riven_csrf=([^;]+)/);
    return match ? match[1] : '';
}

// Fetch wrapper with dual auth (Cookie + Header)
const authFetch = async (endpoint, options = {}) => {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token && token !== 'logged_in') {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const method = (options.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
        let csrf = getCsrfToken();
        if (!csrf) {
            // Prime the CSRF cookie with a GET request, then re-read it.
            // This handles the case where a stale cookie exists server-side but the
            // browser hasn't made any GET to our API yet (e.g. first login after Supabase call).
            await fetch(`${API_BASE}/csrf`, { credentials: 'include' }).catch(() => {});
            csrf = getCsrfToken();
        }
        if (csrf) {
            headers['x-csrf-token'] = csrf;
        }
    }

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers,
            credentials: 'include',
            signal: options.signal || AbortSignal.timeout(10000),
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
            error.code = data.code;
            error.body = data;
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



const getActiveSupabaseSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session?.access_token ? session : null;
};

const buildAuthRedirectUrl = (path = '') => {
    const origin = globalThis?.location?.origin;
    if (!origin || origin === 'null') return undefined;
    return `${origin.replace(/\/$/, '')}${path}`;
};

const isLegacyTokenHash = (token) => typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);

const edgeFunctionFetch = async (functionName, { method = 'POST', body, query, skipForceReauth = false } = {}) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        const error = new Error('Supabase Edge Functions are not configured');
        error.code = 'EDGE_FUNCTIONS_NOT_CONFIGURED';
        throw error;
    }

    const url = new URL(`${supabaseUrl}/functions/v1/${functionName}`);
    if (query) {
        Object.entries(query).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        });
    }

    const getEdgeFunctionToken = async () => {
        const validateWithSupabaseAuth = async (candidateToken) => {
            if (!isTokenEligibleForEdge(candidateToken)) return false;

            if (typeof supabase?.auth?.getUser !== 'function') {
                return tokenBelongsToSupabaseUrl(candidateToken, supabaseUrl);
            }

            const { data: userData, error: userError } = await supabase.auth.getUser(candidateToken).catch(() => ({
                data: { user: null },
                error: new Error('Token validation failed'),
            }));

            return !userError && Boolean(userData?.user?.id);
        };

        // Try fresh session first, then force-refresh once, then use stored token only if it is a Supabase access token.
        const session = await getActiveSupabaseSession().catch(() => null);
        if (session?.access_token && await validateWithSupabaseAuth(session.access_token)) {
            return session.access_token;
        }

        const { data } = typeof supabase?.auth?.refreshSession === 'function'
            ? await supabase.auth.refreshSession().catch(() => ({ data: {} }))
            : { data: {} };
        if (data?.session?.access_token && await validateWithSupabaseAuth(data.session.access_token)) {
            setToken(data.session.access_token);
            return data.session.access_token;
        }

        const storedToken = getToken();
        if (!storedToken) {
            return null;
        }

        if (!await validateWithSupabaseAuth(storedToken)) {
            setToken(null);
            return null;
        }

        return storedToken;
    };

    const token = await getEdgeFunctionToken();
    const headers = {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
    };

    if (token && token !== 'logged_in') {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = response.headers.get('content-type');
    let data = {};

    if (contentType && contentType.includes('application/json')) {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
    }

    if (!response.ok) {
        const error = new Error(data.error || data.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.code = data.code;
        error.body = data;

        if (!skipForceReauth && shouldForceReauthFromEdgeError(response.status, error.message)) {
            // Only destroy the session if it is genuinely invalid.
            // The Supabase gateway may reject valid tokens (e.g. --no-verify-jwt not set),
            // so check whether the session is still alive before force-logging out.
            const stillValid = await getActiveSupabaseSession().catch(() => null);
            if (!stillValid) {
                await forceReauth();
                error.code = AUTH_SESSION_EXPIRED_CODE;
                error.message = 'Session expired. Please sign in again.';
            }
        }

        throw error;
    }

    return data;
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
const completeRegistration = async (username, captchaToken = null) => {
    return edgeFunctionFetch('complete-registration', {
        method: 'POST',
        body: { username, ...(captchaToken ? { captchaToken } : {}) },
        skipForceReauth: true,
    });
};

const getLocalMe = async () => {
    const session = await getActiveSupabaseSession().catch(() => null);

    if (session) {
        const row = await getSupabaseSelfUserRow();
        return mapOwnUserRow(row);
    }

    return authFetch('/auth/me');
};

const getSupabaseMfaState = async () => {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        return {
            hasSession: false,
            enabled: false,
            factorId: null,
            currentLevel: null,
            nextLevel: null,
        };
    }

    const [{ data: aalData, error: aalError }, { data: factorData, error: factorError }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
    ]);

    if (aalError) throw aalError;
    if (factorError) throw factorError;

    const verifiedTotpFactors = Array.isArray(factorData?.totp)
        ? factorData.totp
        : (factorData?.all || []).filter((factor) => factor.factor_type === 'totp' && factor.status === 'verified');

    return {
        hasSession: true,
        enabled: verifiedTotpFactors.length > 0,
        factorId: verifiedTotpFactors[0]?.id || null,
        currentLevel: aalData?.currentLevel || null,
        nextLevel: aalData?.nextLevel || null,
    };
};

const mergeUserWithMfaState = (user, mfaState) => {
    if (!user) return user;

    return {
        ...user,
        twoFAEnabled: Boolean(user.twoFAEnabled || mfaState?.enabled),
    };
};

const requiresSupabaseMfaChallenge = (mfaState) => (
    Boolean(
        mfaState?.enabled
        && mfaState?.factorId
        && mfaState?.nextLevel === 'aal2'
        && mfaState?.currentLevel !== 'aal2'
    )
);

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

export const register = async (username, email, password, captchaToken = null) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } },
    });

    if (!error && data.session) {
        // Supabase confirmed immediately (email confirmation disabled in dashboard).
        setToken(data.session.access_token);
        try {
            const result = await completeRegistration(username, captchaToken);
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
        body: JSON.stringify({ username, email, password, captchaToken }),
    });

    // Legacy register now creates a Supabase Auth user — sign in to get a
    // proper Supabase session so edge functions work immediately.
    const { data: sbLogin } = await supabase.auth.signInWithPassword({ email, password }).catch(() => ({ data: {} }));
    if (sbLogin?.session?.access_token) {
        setToken(sbLogin.session.access_token);
    } else if (legacyData.token) {
        setToken(legacyData.token);
    }

    return legacyData.user;
};

export const login = async (email, password) => {
    // Try Supabase Auth first (new users and migrated users)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && data.session) {
        setToken(data.session.access_token);
        // Ensure the user row exists in our DB (handles first-time login after migration)
        let user;
        try {
            const result = await completeRegistration();
            user = result.user;
        } catch {
            // User row already exists — fetch normally
            user = await getLocalMe();
        }

        const mfaState = await getSupabaseMfaState().catch(() => ({
            hasSession: true,
            enabled: false,
            factorId: null,
            currentLevel: null,
            nextLevel: null,
        }));

        // Existing legacy 2FA users still need the temp-token flow until they
        // explicitly move their factor into Supabase MFA.
        if (user?.twoFAEnabled && !mfaState.enabled) {
            await supabase.auth.signOut().catch(() => {});
            setToken(null);

            const legacyData = await authFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            if (legacyData.require2FA) {
                return {
                    ...legacyData,
                    provider: 'legacy',
                };
            }

            if (legacyData.token) {
                const bootstrappedSession = await bootstrapSupabaseSession(email, password);
                if (bootstrappedSession?.user) {
                    return bootstrappedSession;
                }
                setToken(legacyData.token);
            } else if (legacyData.user) {
                setToken('logged_in');
            }

            return legacyData;
        }

        if (requiresSupabaseMfaChallenge(mfaState)) {
            return {
                require2FA: true,
                provider: 'supabase',
                factorId: mfaState.factorId,
            };
        }

        return { user: mergeUserWithMfaState(user, mfaState) };
    }

    // Supabase Auth failed — fall back to legacy Express login (existing users not yet in Supabase)
    const legacyData = await authFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
    });
    if (legacyData.require2FA) {
        return {
            ...legacyData,
            provider: 'legacy',
        };
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
    const mfaState = await getSupabaseMfaState().catch(() => ({
        hasSession: true,
        enabled: false,
        factorId: null,
        currentLevel: null,
        nextLevel: null,
    }));

    if (result.user?.twoFAEnabled && !mfaState.enabled) {
        await supabase.auth.signOut().catch(() => {});
        setToken(null);

        const legacyData = await authFetch('/auth/oauth/google', {
            method: 'POST',
            body: JSON.stringify({ credential }),
        });
        if (legacyData.require2FA) {
            return {
                ...legacyData,
                provider: 'legacy',
            };
        }

        if (legacyData.token) setToken(legacyData.token);
        return legacyData;
    }

    if (requiresSupabaseMfaChallenge(mfaState)) {
        return {
            require2FA: true,
            provider: 'supabase',
            factorId: mfaState.factorId,
        };
    }

    return { user: mergeUserWithMfaState(result.user, mfaState) };
};

export const loginWithApple = async (identityToken, _user) => {
    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
    });
    if (error) throw new Error(error.message);
    setToken(data.session.access_token);
    const result = await completeRegistration();
    const mfaState = await getSupabaseMfaState().catch(() => ({
        hasSession: true,
        enabled: false,
        factorId: null,
        currentLevel: null,
        nextLevel: null,
    }));

    if (result.user?.twoFAEnabled && !mfaState.enabled) {
        await supabase.auth.signOut().catch(() => {});
        setToken(null);

        const legacyData = await authFetch('/auth/oauth/apple', {
            method: 'POST',
            body: JSON.stringify({ identityToken, user: _user }),
        });
        if (legacyData.require2FA) {
            return {
                ...legacyData,
                provider: 'legacy',
            };
        }

        if (legacyData.token) setToken(legacyData.token);
        return legacyData;
    }

    if (requiresSupabaseMfaChallenge(mfaState)) {
        return {
            require2FA: true,
            provider: 'supabase',
            factorId: mfaState.factorId,
        };
    }

    return { user: mergeUserWithMfaState(result.user, mfaState) };
};

export const logout = async () => {
    try {
        await supabase.auth.signOut();
    } finally {
        setToken(null);
    }
};

export const getMe = async () => {
    const [user, mfaState] = await Promise.all([
        getLocalMe(),
        getSupabaseMfaState().catch(() => null),
    ]);

    return mergeUserWithMfaState(user, mfaState);
};

export const restoreSessionUser = async () => {
    const refreshedSupabaseToken = await refreshSupabaseToken().catch(() => null);
    const token = getToken();
    if (!token) {
        return null;
    }

    try {
        const [user, mfaState] = await Promise.all([
            getLocalMe(),
            getSupabaseMfaState().catch(() => ({
                hasSession: false,
                enabled: false,
                factorId: null,
                currentLevel: null,
                nextLevel: null,
            })),
        ]);

        if (mfaState.hasSession && user?.twoFAEnabled && !mfaState.enabled) {
            await supabase.auth.signOut().catch(() => {});
            setToken(null);
            return null;
        }

        if (requiresSupabaseMfaChallenge(mfaState)) {
            return {
                require2FA: true,
                provider: 'supabase',
                factorId: mfaState.factorId,
            };
        }

        return mergeUserWithMfaState(user, mfaState);
    } catch (err) {
        if (refreshedSupabaseToken && err.code === 'ACCOUNT_SETUP_REQUIRED') {
            const result = await completeRegistration();
            const mfaState = await getSupabaseMfaState().catch(() => ({
                hasSession: false,
                enabled: false,
                factorId: null,
                currentLevel: null,
                nextLevel: null,
            }));

            if (requiresSupabaseMfaChallenge(mfaState)) {
                return {
                    require2FA: true,
                    provider: 'supabase',
                    factorId: mfaState.factorId,
                };
            }

            return mergeUserWithMfaState(result.user, mfaState);
        }
        throw err;
    }
};

const resolveCurrentUser = async (currentUserOverride = null) => {
    if (currentUserOverride?.id) {
        return currentUserOverride;
    }
    return getMe();
};

// Refresh the stored token from the active Supabase session.
// Call this on app startup to ensure the token is up to date.
export const refreshSupabaseToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
        return null;
    }

    // Guard against stale or malformed persisted sessions before any edge call.
    if (!isSupabaseAccessToken(accessToken) || isJwtExpired(accessToken)) {
        await supabase.auth.signOut().catch(() => {});
        setToken(null);
        return null;
    }

    if (typeof supabase?.auth?.getUser === 'function') {
        const { data, error } = await supabase.auth.getUser(accessToken).catch(() => ({ data: { user: null }, error: new Error('Failed to validate session') }));
        if (error || !data?.user?.id) {
            await supabase.auth.signOut().catch(() => {});
            setToken(null);
            return null;
        }
    }

    setToken(accessToken);
    return accessToken;
};

export const changePassword = async (_currentPassword, newPassword) => {
    if (!newPassword) {
        const error = new Error('Current and new password are required');
        error.status = 400;
        throw error;
    }

    if (newPassword.length < 8) {
        const error = new Error('Password must be at least 8 characters');
        error.status = 400;
        throw error;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
    return { message: 'Password changed successfully' };
};

export const deleteAccount = async () => {
    await edgeFunctionFetch('account-actions', { method: 'DELETE' });
    await logout();
};

// ============ STREAK ENDPOINTS ============

// ============ DATA ENDPOINTS — Supabase PostgREST (Phase 2) ============
// RLS policies handle auth — see supabase/migrations/phase2_rls_policies.sql

/** Throw in the same shape authFetch uses so callers don't break */
const _sbThrow = (error) => {
    const err = new Error(error.message || 'Supabase query failed');
    err.code = error.code;
    err.details = error.details;
    err.hint = error.hint;
    err.status = error.code === 'PGRST301'
        ? 401
        : error.code === '42501'
            ? 403
            : ['23505', '23514', '22P02'].includes(error.code)
                ? 400
                : 500;
    throw err;
};

const DEFAULT_PET_CUSTOMIZATION = {
    gardenTheme: 'cottage',
    decorations: [],
    specialPlants: [],
};

const SELF_PROFILE_SELECT = [
    'id',
    'username',
    'display_name',
    'email',
    'share_code',
    'avatar',
    'banner',
    'bio',
    'streak_data',
    'pet_customization',
    'role',
    'is_admin',
    'created_at',
    'two_fa_enabled',
    'subscription_tier',
    'simulate_free_tier',
    'email_verified',
].join(', ');

const isValidProfileUsername = (username) => (
    username.length >= 2
    && username.length <= 30
    && /^[a-zA-Z0-9_]+$/.test(username)
);

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
    const seen = new Set();
    return (data || []).filter(tag => {
        const key = tag.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
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
const callCanvasLmsEndpoint = ({ action, payload }) =>
    edgeFunctionFetch('canvas-lms', {
        method: 'POST',
        body: { action, ...(payload || {}) },
    });

export const connectCanvas = (icalUrl) => callCanvasLmsEndpoint({
    action: 'connect',
    payload: { icalUrl },
});
export const disconnectCanvas = () => callCanvasLmsEndpoint({
    action: 'disconnect',
});
export const getCanvasSettings = async () => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('users')
        .select('canvas_ical_url')
        .eq('id', userId)
        .single();
    if (error) _sbThrow(error);

    return {
        isConnected: Boolean(data?.canvas_ical_url),
        canvasUrl: data?.canvas_ical_url ? 'Canvas Feed Active' : '',
    };
};
export const syncCanvas = (adGranted = false) => callCanvasLmsEndpoint({
    action: 'sync',
    payload: { adGranted },
});

// --- AI Generation ---
export const getAILimits = () => edgeFunctionFetch('ai-limits', { method: 'GET' });

export const generateAiDeck = (notes, file, deckName, classId, className) =>
    edgeFunctionFetch('generate-deck', { body: { notes, file, deckName, classId, className } });

export const generateAiClass = (notes, file) =>
    edgeFunctionFetch('generate-class', { body: { notes, file } });

export const generateAiGuide = (notes, file, title, noteId, classId, className) =>
    edgeFunctionFetch('generate-guide', { body: { notes, file, title, noteId, classId, className } });

export const generateAiExam = (notes, file, title, sourceType, sourceId, classId, className) =>
    edgeFunctionFetch('generate-exam', { body: { notes, file, title, sourceType, sourceId, classId, className } });

export const generateFromYoutube = (youtubeUrl, type, { title, classId, deckName, className } = {}) =>
    edgeFunctionFetch('generate-from-youtube', { body: { youtubeUrl, type, title, classId, deckName, className } });

// --- AI Generation (Streaming) ---

const edgeFunctionStreamFetch = async (functionName, { body } = {}) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '');
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
        const error = new Error('Supabase Edge Functions are not configured');
        error.code = 'EDGE_FUNCTIONS_NOT_CONFIGURED';
        throw error;
    }

    const url = new URL(`${supabaseUrl}/functions/v1/${functionName}`);
    url.searchParams.set('stream', '1');

    // Reuse the same token resolution as edgeFunctionFetch
    const getEdgeFunctionToken = async () => {
        const validateWithSupabaseAuth = async (candidateToken) => {
            if (!isTokenEligibleForEdge(candidateToken)) return false;

            if (typeof supabase?.auth?.getUser !== 'function') {
                return tokenBelongsToSupabaseUrl(candidateToken, supabaseUrl);
            }

            const { data: userData, error: userError } = await supabase.auth.getUser(candidateToken).catch(() => ({
                data: { user: null },
                error: new Error('Token validation failed'),
            }));

            return !userError && Boolean(userData?.user?.id);
        };

        const session = await getActiveSupabaseSession().catch(() => null);
        if (session?.access_token && await validateWithSupabaseAuth(session.access_token)) {
            return session.access_token;
        }

        const { data } = typeof supabase?.auth?.refreshSession === 'function'
            ? await supabase.auth.refreshSession().catch(() => ({ data: {} }))
            : { data: {} };
        if (data?.session?.access_token && await validateWithSupabaseAuth(data.session.access_token)) {
            setToken(data.session.access_token);
            return data.session.access_token;
        }

        const storedToken = getToken();
        if (!storedToken) return null;
        if (!await validateWithSupabaseAuth(storedToken)) {
            setToken(null);
            return null;
        }
        return storedToken;
    };

    const token = await getEdgeFunctionToken();
    const headers = {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
    };

    if (token && token !== 'logged_in') {
        headers.Authorization = `Bearer ${token}`;
    }

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 120_000);

    const response = await fetch(url.toString(), {
        method: 'POST',
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: abortController.signal,
    });

    if (!response.ok) {
        const text = await response.text();
        let data = {};
        try { data = text ? JSON.parse(text) : {}; } catch { /* non-JSON error */ }
        const error = new Error(data.error || data.message || `Request failed (${response.status})`);
        error.status = response.status;
        error.code = data.code;
        error.body = data;
        throw error;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    return {
        async *chunks() {
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const events = buffer.split('\n\n');
                buffer = events.pop(); // incomplete event stays in buffer

                for (const eventBlock of events) {
                    if (!eventBlock.trim()) continue;
                    const lines = eventBlock.split('\n');
                    let eventType = 'chunk';
                    let data = '';
                    for (const line of lines) {
                        if (line.startsWith('event: ')) eventType = line.slice(7);
                        if (line.startsWith('data: ')) data = line.slice(6);
                    }
                    if (data) {
                        try {
                            yield { type: eventType, data: JSON.parse(data) };
                        } catch {
                            // Skip malformed events
                        }
                    }
                }
            }
            clearTimeout(timeoutId);
        },
        abort: () => {
            clearTimeout(timeoutId);
            abortController.abort();
        },
    };
};

export const generateAiDeckStream = (notes, file, deckName, classId, className) =>
    edgeFunctionStreamFetch('generate-deck', { body: { notes, file, deckName, classId, className } });

export const generateAiGuideStream = (notes, file, title, noteId, classId, className) =>
    edgeFunctionStreamFetch('generate-guide', { body: { notes, file, title, noteId, classId, className } });

export const generateAiExamStream = (notes, file, title, sourceType, sourceId, classId, className) =>
    edgeFunctionStreamFetch('generate-exam', { body: { notes, file, title, sourceType, sourceId, classId, className } });

export const generateFromYoutubeStream = (youtubeUrl, type, { title, classId, deckName, className } = {}) =>
    edgeFunctionStreamFetch('generate-from-youtube', { body: { youtubeUrl, type, title, classId, deckName, className } });

export const enhanceNoteWithAudioStream = (noteId, audioPath, userNotes, title, className) =>
    edgeFunctionStreamFetch('enhance-notes', { body: { noteId, audioPath, userNotes, title, className } });

// --- Notes (PostgREST) ---

export const getNotes = async (classId) => {
    let query = supabase.from('notes').select('*').order('updated_at', { ascending: false });
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) _sbThrow(error);
    return data || [];
};

export const getNote = async (id) => {
    const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('id', id)
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const createNote = async (title, content, classId) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('notes')
        .insert({
            user_id: userId,
            title: title || 'Untitled',
            content: content || {},
            class_id: classId || null,
        })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateNote = async (id, updates) => {
    const payload = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.content !== undefined) payload.content = updates.content;
    if (updates.class_id !== undefined) payload.class_id = updates.class_id;
    const { data, error } = await supabase
        .from('notes')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteNote = async (id) => {
    const { error } = await supabase.from('notes').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Note deleted' };
};

export const uploadNoteAudio = async (noteId, audioBlob) => {
    const userId = await getAppUserId();
    const path = `${userId}/${noteId}.webm`;
    const { error } = await supabase.storage
        .from('note-audio')
        .upload(path, audioBlob, {
            contentType: 'audio/webm',
            upsert: true,
        });
    if (error) _sbThrow(error);
    return { path };
};

export const enhanceNoteWithAudio = (noteId, audioPath, userNotes, title, className) =>
    edgeFunctionFetch('enhance-notes', { body: { noteId, audioPath, userNotes, title, className } });

// --- Study Guides (PostgREST) ---

export const getStudyGuides = async (classId) => {
    let query = supabase.from('study_guides').select('*').order('updated_at', { ascending: false });
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) _sbThrow(error);
    return data || [];
};

export const getStudyGuide = async (id) => {
    const { data, error } = await supabase
        .from('study_guides')
        .select('*')
        .eq('id', id)
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateStudyGuide = async (id, updates) => {
    const payload = {};
    if (updates.title !== undefined) payload.title = updates.title;
    if (updates.content !== undefined) payload.content = updates.content;
    if (updates.class_id !== undefined) payload.class_id = updates.class_id;
    const { data, error } = await supabase
        .from('study_guides')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteStudyGuide = async (id) => {
    const { error } = await supabase.from('study_guides').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Study guide deleted' };
};

// --- Mock Exams (PostgREST) ---

export const getMockExams = async (classId) => {
    let query = supabase.from('mock_exams').select('*').order('created_at', { ascending: false });
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) _sbThrow(error);
    return data || [];
};

export const getMockExam = async (id) => {
    const { data, error } = await supabase
        .from('mock_exams')
        .select('*')
        .eq('id', id)
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteMockExam = async (id) => {
    const { error } = await supabase.from('mock_exams').delete().eq('id', id);
    if (error) _sbThrow(error);
    return { message: 'Mock exam deleted' };
};

// --- Exam Attempts (PostgREST) ---

export const createExamAttempt = async (examId, score, total, answers) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('exam_attempts')
        .insert({
            user_id: userId,
            exam_id: examId,
            score,
            total,
            answers: answers || [],
        })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const getExamAttempts = async (examId) => {
    const { data, error } = await supabase
        .from('exam_attempts')
        .select('*')
        .eq('exam_id', examId)
        .order('completed_at', { ascending: false });
    if (error) _sbThrow(error);
    return data || [];
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

export const acceptSharedDeck = (messageId) =>
    edgeFunctionFetch('accept-shared-deck', { method: 'POST', body: { messageId } });

// ============ GUEST DATA MIGRATION ============

export const migrateGuestData = async (guestData) => {
    const userId = await getAppUserId();
    const folders = Array.isArray(guestData?.folders) ? guestData.folders : [];
    const tags = Array.isArray(guestData?.tags) ? guestData.tags : [];
    const decks = Array.isArray(guestData?.decks) ? guestData.decks : [];
    const cards = Array.isArray(guestData?.cards) ? guestData.cards : [];
    const deckTags = Array.isArray(guestData?.deckTags) ? guestData.deckTags : [];
    const studySessions = Array.isArray(guestData?.studySessions) ? guestData.studySessions : [];

    const folderIdMap = {};
    const tagIdMap = {};
    const deckIdMap = {};
    let importedTagCount = 0;

    for (const folder of folders) {
        const { data, error } = await supabase
            .from('folders')
            .insert({
                user_id: userId,
                name: folder.name,
                color: folder.color || '#6366f1',
                icon: folder.icon || 'folder',
                created_at: folder.created_at || new Date().toISOString(),
            })
            .select()
            .single();
        if (error) _sbThrow(error);
        folderIdMap[folder.id] = data.id;
    }

    if (tags.length > 0) {
        const { data: existingTags, error: existingTagsError } = await supabase
            .from('tags')
            .select('id, name')
            .eq('user_id', userId);
        if (existingTagsError) _sbThrow(existingTagsError);

        const existingTagIdsByName = new Map((existingTags || []).map((tag) => [tag.name.toLowerCase(), tag.id]));

        for (const tag of tags.filter((entry) => !entry.is_preset)) {
            const normalizedName = tag.name.toLowerCase();
            const existingTagId = existingTagIdsByName.get(normalizedName);
            if (existingTagId) {
                tagIdMap[tag.id] = existingTagId;
                continue;
            }

            const { data, error } = await supabase
                .from('tags')
                .insert({
                    user_id: userId,
                    name: tag.name,
                    color: tag.color,
                    is_preset: false,
                    created_at: tag.created_at || new Date().toISOString(),
                })
                .select()
                .single();
            if (error) _sbThrow(error);

            tagIdMap[tag.id] = data.id;
            existingTagIdsByName.set(normalizedName, data.id);
            importedTagCount += 1;
        }
    }

    for (const deck of decks) {
        const { data, error } = await supabase
            .from('decks')
            .insert({
                user_id: userId,
                title: deck.title,
                description: deck.description || '',
                folder_id: deck.folder_id ? folderIdMap[deck.folder_id] || null : null,
                created_at: deck.created_at || new Date().toISOString(),
                last_studied: deck.last_studied || null,
            })
            .select()
            .single();
        if (error) _sbThrow(error);
        deckIdMap[deck.id] = data.id;
    }

    const cardPayloads = cards
        .map((card) => {
            const newDeckId = deckIdMap[card.deck_id];
            if (!newDeckId) return null;
            return {
                deck_id: newDeckId,
                front: card.front,
                back: card.back,
                position: card.position || 0,
                difficulty: card.difficulty || 0,
                times_reviewed: card.times_reviewed || 0,
                times_correct: card.times_correct || 0,
                last_reviewed: card.last_reviewed || null,
                next_review: card.next_review || null,
                created_at: card.created_at || new Date().toISOString(),
            };
        })
        .filter(Boolean);

    if (cardPayloads.length > 0) {
        const { error } = await supabase.from('cards').insert(cardPayloads);
        if (error) _sbThrow(error);
    }

    const deckTagPayloads = deckTags
        .map((entry) => {
            const newDeckId = deckIdMap[entry.deck_id];
            const newTagId = tagIdMap[entry.tag_id];
            if (!newDeckId || !newTagId) return null;
            return { deck_id: newDeckId, tag_id: newTagId };
        })
        .filter(Boolean);

    if (deckTagPayloads.length > 0) {
        const { error } = await supabase.from('deck_tags').insert(deckTagPayloads);
        if (error) _sbThrow(error);
    }

    const sessionPayloads = studySessions
        .map((session) => {
            const newDeckId = deckIdMap[session.deck_id];
            if (!newDeckId) return null;
            return {
                deck_id: newDeckId,
                cards_studied: session.cards_studied || 0,
                cards_correct: session.cards_correct || 0,
                duration_seconds: session.duration_seconds || 0,
                session_type: session.session_type || 'study',
                created_at: session.created_at || new Date().toISOString(),
            };
        })
        .filter(Boolean);

    if (sessionPayloads.length > 0) {
        const { error } = await supabase.from('study_sessions').insert(sessionPayloads);
        if (error) _sbThrow(error);
    }

    return {
        message: 'Guest data migrated successfully',
        imported: {
            folders: Object.keys(folderIdMap).length,
            tags: importedTagCount,
            decks: Object.keys(deckIdMap).length,
        },
    };
};

const loadCurrentUserRow = async () => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('users')
        .select(SELF_PROFILE_SELECT)
        .eq('id', userId)
        .single();
    if (error) _sbThrow(error);
    return data;
};

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

const mapOwnUserRow = (row) => {
    const { role, isAdmin, isOwner } = normalizeRoleFlags(row);
    const effectiveTier = (role === 'owner' || role === 'admin') && !Boolean(row.simulate_free_tier)
        ? 'lifetime'
        : (row.subscription_tier || 'free');

    return {
        id: row.id,
        username: row.username,
        displayName: row.display_name || row.username,
        email: row.email,
        shareCode: row.share_code || null,
        avatar: row.avatar || null,
        banner: row.banner || null,
        bio: row.bio || '',
        streakData: parseJsonish(row.streak_data) || {},
        petCustomization: parseJsonish(row.pet_customization) || DEFAULT_PET_CUSTOMIZATION,
        role,
        isAdmin,
        isOwner,
        createdAt: row.created_at || null,
        twoFAEnabled: Boolean(row.two_fa_enabled),
        subscription_tier: effectiveTier,
        simulate_free_tier: Boolean(row.simulate_free_tier),
        email_verified: Boolean(row.email_verified),
    };
};

const getSupabaseSelfUserRow = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser?.id) {
        const err = new Error('Account setup required');
        err.code = 'ACCOUNT_SETUP_REQUIRED';
        err.status = 401;
        throw err;
    }

    const { data, error } = await supabase
        .from('users')
        .select(SELF_PROFILE_SELECT)
        .eq('supabase_auth_id', authUser.id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') {
            const accountSetupError = new Error('Account setup required');
            accountSetupError.code = 'ACCOUNT_SETUP_REQUIRED';
            accountSetupError.status = 401;
            throw accountSetupError;
        }
        _sbThrow(error);
    }

    return data;
};

const mapBlockedUserRow = (row) => ({
    id: row.id,
    username: row.username,
    avatar: row.avatar || null,
    blocked_at: row.blocked_at || null,
});

// ============ PROFILE / STREAK / PET DATA ============

export const updateProfile = async (updates = {}) => {
    const nextUpdates = {};

    if (updates.username !== undefined) {
        const username = updates.username.trim();
        if (!isValidProfileUsername(username)) {
            const error = new Error('Username must be 2-30 characters, alphanumeric and underscores only');
            error.status = 400;
            throw error;
        }
        nextUpdates.username = username;
    }

    if (updates.displayName !== undefined) nextUpdates.display_name = updates.displayName.trim();
    if (updates.bio !== undefined) nextUpdates.bio = updates.bio;
    if (updates.avatar !== undefined) nextUpdates.avatar = updates.avatar;
    if (updates.banner !== undefined) nextUpdates.banner = updates.banner;

    try {
        if (!Object.keys(nextUpdates).length) {
            return mapOwnUserRow(await loadCurrentUserRow());
        }

        const userId = await getAppUserId();
        const { data, error } = await supabase
            .from('users')
            .update(nextUpdates)
            .eq('id', userId)
            .select(SELF_PROFILE_SELECT)
            .single();
        if (error) _sbThrow(error);
        return mapOwnUserRow(data);
    } catch (error) {
        if (error.code === '23505') {
            const duplicateUsernameError = new Error('Username already taken');
            duplicateUsernameError.status = 400;
            throw duplicateUsernameError;
        }
        throw error;
    }
};

export const getStreak = async () => safeFetchObject((async () => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('users')
        .select('streak_data')
        .eq('id', userId)
        .single();
    if (error) _sbThrow(error);
    return parseJsonish(data?.streak_data) || {};
})(), {});

export const updateStreak = async (streakData) => {
    const userId = await getAppUserId();
    const { error } = await supabase
        .from('users')
        .update({ streak_data: JSON.stringify(streakData || {}) })
        .eq('id', userId);
    if (error) _sbThrow(error);
    return { message: 'Streak data saved' };
};

// ============ PET CUSTOMIZATION ============

export const getPetCustomization = async () => safeFetchObject((async () => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('users')
        .select('pet_customization')
        .eq('id', userId)
        .single();
    if (error) _sbThrow(error);
    return parseJsonish(data?.pet_customization) || DEFAULT_PET_CUSTOMIZATION;
})(), DEFAULT_PET_CUSTOMIZATION);

export const updatePetCustomization = async (customization) => {
    const userId = await getAppUserId();
    const { error } = await supabase
        .from('users')
        .update({ pet_customization: JSON.stringify(customization || DEFAULT_PET_CUSTOMIZATION) })
        .eq('id', userId);
    if (error) _sbThrow(error);
    return {
        message: 'Garden customization saved',
        customization: customization || DEFAULT_PET_CUSTOMIZATION,
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
export const blockUser = async (userId) => {
    const { data, error } = await supabase.rpc('block_user', {
        target_user_id: Number(userId),
    });
    if (error) _sbThrow(error);
    return data || { message: 'User blocked successfully' };
};

export const unblockUser = async (userId) => {
    const { data, error } = await supabase.rpc('unblock_user', {
        target_user_id: Number(userId),
    });
    if (error) _sbThrow(error);
    return data || { message: 'User unblocked successfully' };
};

export const getBlockedUsers = async () => safeFetchArray((async () => {
    const { data, error } = await supabase.rpc('list_blocked_users');
    if (error) _sbThrow(error);
    return (data || []).map(mapBlockedUserRow);
})());

export const reportContent = async (reportData) => {
    const { data, error } = await supabase.rpc('submit_report', {
        target_user_id: reportData?.reportedUserId == null ? null : Number(reportData.reportedUserId),
        report_content_type: reportData?.contentType ?? null,
        report_content_id: reportData?.contentId ?? null,
        report_reason: reportData?.reason ?? null,
        report_details: reportData?.details ?? null,
    });
    if (error) _sbThrow(error);
    return data || { message: 'Report submitted successfully. Our team will review it shortly.' };
};

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

export const getConversations = async (currentUserOverride = null) => {
    const currentUser = await resolveCurrentUser(currentUserOverride);
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

export const getMessages = async (userId, limit = 50, before, currentUserOverride = null) => {
    const currentUser = await resolveCurrentUser(currentUserOverride);
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
    if (readError) {
        console.warn('[authApi] Failed to mark messages as read:', readError.message || readError);
    }

    return (data || [])
        .slice()
        .sort((left, right) => new Date(left.created_at) - new Date(right.created_at))
        .map((row) => mapMessageRow(row, currentUser));
};

export const sendMessage = async (
    receiverId,
    content,
    messageType = 'text',
    deckData = null,
    imageUrl = null,
    currentUserOverride = null
) => {
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

    const currentUser = await resolveCurrentUser(currentUserOverride);
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

export const editMessage = async (id, content, currentUserOverride = null) => {
    if (!content) {
        const error = new Error('Message content is required');
        error.status = 400;
        throw error;
    }

    const currentUser = await resolveCurrentUser(currentUserOverride);
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

export const getUnreadCount = async (currentUserOverride = null) => {
    const currentUser = await resolveCurrentUser(currentUserOverride);
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

export const subscribeToTypingPresence = (currentUserId, otherUserId, handlers = {}) => {
    const normalizedCurrentUserId = Number(currentUserId);
    const normalizedOtherUserId = Number(otherUserId);

    if (!Number.isInteger(normalizedCurrentUserId) || !Number.isInteger(normalizedOtherUserId)) {
        return {
            startTyping: () => Promise.resolve(),
            stopTyping: () => Promise.resolve(),
            unsubscribe: () => {},
        };
    }

    const channelName = `dm_${Math.min(normalizedCurrentUserId, normalizedOtherUserId)}_${Math.max(normalizedCurrentUserId, normalizedOtherUserId)}`;
    const channel = supabase.channel(channelName, {
        config: {
            presence: {
                key: `user-${normalizedCurrentUserId}`,
            },
        },
    });

    const syncTypingState = () => {
        const state = channel.presenceState?.() || {};
        const isOtherUserTyping = Object.values(state)
            .flat()
            .some((presence) => Number(presence?.userId) === normalizedOtherUserId && presence?.isTyping === true);

        handlers.onTypingChange?.(isOtherUserTyping);
    };

    channel.on('presence', { event: 'sync' }, syncTypingState);
    channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await channel.track({
                userId: normalizedCurrentUserId,
                isTyping: false,
            });
        }
    });

    return {
        startTyping: () => channel.track({
            userId: normalizedCurrentUserId,
            isTyping: true,
        }),
        stopTyping: () => channel.track({
            userId: normalizedCurrentUserId,
            isTyping: false,
        }),
        unsubscribe: () => {
            channel.untrack?.();
            supabase.removeChannel(channel);
        },
    };
};

// ============ STUDY GROUPS ============

const callGroupRpc = async (fn, params = {}) => {
    const { data, error } = await supabase.rpc(fn, params);
    if (error) _sbThrow(error);
    return data;
};

const callGroupActionEndpoint = ({ method, action, payload }) =>
    edgeFunctionFetch('group-actions', {
        method,
        body: { action, ...(payload || {}) },
    });

const callGroupSessionEndpoint = ({ action, payload }) =>
    edgeFunctionFetch('group-sessions', {
        method: 'POST',
        body: { action, ...(payload || {}) },
    });

export const getGroups = async () => safeFetchArray((async () => {
    const data = await callGroupRpc('list_user_groups');
    return data || [];
})());
export const createGroup = (name, class_id) => callGroupActionEndpoint({
    method: 'POST',
    action: 'group-create',
    payload: { name, class_id },
});
export const getGroup = async (id) => {
    const data = await callGroupRpc('get_group_details', {
        target_group_id: id,
    });
    const group = Array.isArray(data) ? data[0] : data;

    if (!group) {
        const error = new Error('Group not found');
        error.status = 404;
        throw error;
    }

    return group;
};
export const updateGroup = (id, updates) => callGroupActionEndpoint({
    method: 'PUT',
    action: 'group-update',
    payload: { groupId: id, ...updates },
});
export const deleteGroup = (id) => callGroupActionEndpoint({
    method: 'DELETE',
    action: 'group-delete',
    payload: { groupId: id },
});
export const joinGroup = (join_code) => callGroupActionEndpoint({
    method: 'POST',
    action: 'group-join',
    payload: { join_code },
});
export const leaveGroup = (id) => callGroupActionEndpoint({
    method: 'DELETE',
    action: 'group-leave',
    payload: { groupId: id },
});
export const getGroupMembers = async (id) => safeFetchArray((async () => {
    const data = await callGroupRpc('list_group_members', {
        target_group_id: id,
    });
    return data || [];
})());
export const removeGroupMember = (id, userId) => callGroupActionEndpoint({
    method: 'DELETE',
    action: 'group-member-remove',
    payload: { groupId: id, userId },
});

export const getGroupDecks = async (id) => safeFetchArray((async () => {
    const data = await callGroupRpc('list_group_decks', {
        target_group_id: id,
    });
    return data || [];
})());
export const shareDeckToGroup = (id, deck_id) => callGroupActionEndpoint({
    method: 'POST',
    action: 'group-deck-share',
    payload: { groupId: id, deck_id },
});
export const removeDeckFromGroup = (id, deckId) => callGroupActionEndpoint({
    method: 'DELETE',
    action: 'group-deck-remove',
    payload: { groupId: id, deckId },
});

export const getGroupFolders = async (id) => safeFetchArray((async () => {
    const data = await callGroupRpc('list_group_folders', {
        target_group_id: id,
    });
    return data || [];
})());
export const createGroupFolder = (id, name) => callGroupActionEndpoint({
    method: 'POST',
    action: 'group-folder-create',
    payload: { groupId: id, name },
});
export const renameGroupFolder = (id, folderId, name) => callGroupActionEndpoint({
    method: 'PUT',
    action: 'group-folder-update',
    payload: { groupId: id, folderId, name },
});
export const deleteGroupFolder = (id, folderId) => callGroupActionEndpoint({
    method: 'DELETE',
    action: 'group-folder-delete',
    payload: { groupId: id, folderId },
});

export const getGroupFiles = async (id, folderId = null) => safeFetchArray((async () => {
    const data = await callGroupRpc('list_group_files', {
        target_group_id: id,
        target_folder_id: folderId || null,
    });
    return data || [];
})());
export const uploadGroupFile = (id, data) => callGroupActionEndpoint({
    method: 'POST',
    action: 'group-file-upload',
    payload: { groupId: id, ...data },
});
export const deleteGroupFile = (id, fileId) => callGroupActionEndpoint({
    method: 'DELETE',
    action: 'group-file-delete',
    payload: { groupId: id, fileId },
});

// Cram Sessions
export const getGroupSessions = async (id) => safeFetchArray((async () => {
    const data = await callGroupRpc('list_group_sessions', {
        target_group_id: id,
    });
    return data || [];
})());
export const startGroupSession = (id, deckId) => callGroupSessionEndpoint({
    action: 'session-start',
    payload: { groupId: id, deckId },
});
export const joinGroupSession = (sessionId) => callGroupSessionEndpoint({
    action: 'session-join',
    payload: { sessionId },
});
export const respondToSessionCard = (sessionId, cardId, knewIt) => callGroupSessionEndpoint({
    action: 'session-respond',
    payload: { sessionId, cardId, knewIt },
});
export const getSessionResults = async (sessionId) => {
    const data = await callGroupRpc('get_group_session_results', {
        target_session_id: sessionId,
    });
    return data || { weakSpots: [], personalStats: {} };
};
export const endGroupSession = (sessionId) => callGroupSessionEndpoint({
    action: 'session-end',
    payload: { sessionId },
});

export const subscribeToGroupSessionEvents = (groupId, handlers = {}) => {
    const channel = supabase
        .channel(`group_sessions_${groupId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'cram_sessions',
            filter: `group_id=eq.${groupId}`,
        }, (payload) => {
            if (payload?.new?.status === 'active') {
                handlers.onStarted?.(payload.new);
            }
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'cram_sessions',
            filter: `group_id=eq.${groupId}`,
        }, (payload) => {
            if (payload?.new?.status === 'ended' && payload?.old?.status !== 'ended') {
                handlers.onEnded?.(payload.new);
                return;
            }

            if (payload?.new?.status === 'active' && payload?.old?.status !== 'active') {
                handlers.onStarted?.(payload.new);
            }
        });

    channel.subscribe();
    return () => supabase.removeChannel(channel);
};

export const subscribeToCramSession = (sessionId, handlers = {}) => {
    const channel = supabase
        .channel(`cram_session_${sessionId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'cram_responses',
            filter: `session_id=eq.${sessionId}`,
        }, (payload) => {
            handlers.onProgress?.({ userId: payload?.new?.user_id });
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'cram_responses',
            filter: `session_id=eq.${sessionId}`,
        }, (payload) => {
            handlers.onProgress?.({ userId: payload?.new?.user_id });
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'cram_sessions',
            filter: `id=eq.${sessionId}`,
        }, (payload) => {
            if (payload?.new?.status === 'ended' && payload?.old?.status !== 'ended') {
                handlers.onEnded?.(payload.new);
            }
        });

    channel.subscribe();
    return () => supabase.removeChannel(channel);
};

// ============ ADMIN ENDPOINTS ============

const callAdminEndpoint = ({ method = 'GET', action, query, body }) =>
    edgeFunctionFetch('admin-actions', {
        method,
        query: method === 'GET' ? { action, ...query } : undefined,
        body: method === 'GET' ? undefined : { action, ...body },
    });

const normalizeAdminReport = (report) => {
    const reporterUsername = report?.reporter_username || report?.reporter_name || 'Unknown';
    const reportedUsername = report?.reported_username || report?.reported_name || 'Unknown';
    const resolverUsername = report?.resolver_username || report?.resolver_name || null;

    return {
        ...report,
        reporter_name: report?.reporter_name || reporterUsername,
        reported_name: report?.reported_name || reportedUsername,
        resolver_name: report?.resolver_name || resolverUsername,
        reporter_username: reporterUsername,
        reported_username: reportedUsername,
        resolver_username: resolverUsername,
    };
};

export const adminGetAllUsers = () => safeFetchArray(callAdminEndpoint({
    method: 'GET',
    action: 'users',
}));
export const adminUpdateUser = (userId, updates) => callAdminEndpoint({
    method: 'PUT',
    action: 'user-update',
    body: { userId, ...updates },
});
export const adminDeleteUser = (userId) => callAdminEndpoint({
    method: 'DELETE',
    action: 'user-delete',
    body: { userId },
});
export const adminGetStats = () => safeFetchObject(callAdminEndpoint({
    method: 'GET',
    action: 'stats',
}));
export const adminUpdateUserRole = (userId, role) => callAdminEndpoint({
    method: 'PUT',
    action: 'user-role',
    body: { userId, role },
});

// Admin moderation functions
export const adminGetReports = async () => safeFetchArray((async () => {
    const reports = await callAdminEndpoint({
        method: 'GET',
        action: 'reports',
    });
    return Array.isArray(reports) ? reports.map(normalizeAdminReport) : [];
})());
export const adminResolveReport = (reportId) => callAdminEndpoint({
    method: 'POST',
    action: 'report-resolve',
    body: { reportId },
});
export const adminCloseReport = (reportId) => callAdminEndpoint({
    method: 'POST',
    action: 'report-close',
    body: { reportId },
});
export const adminBanUser = (userId) => callAdminEndpoint({
    method: 'POST',
    action: 'user-ban',
    body: { userId },
});

// Admin message functions
export const adminGetMessages = () => safeFetchArray(callAdminEndpoint({
    method: 'GET',
    action: 'messages',
}));
export const adminCreateMessage = (title, content, type, expiresAt) => callAdminEndpoint({
    method: 'POST',
    action: 'message-create',
    body: { title, content, type, expiresAt },
});
export const adminUpdateMessage = (id, updates) => callAdminEndpoint({
    method: 'PUT',
    action: 'message-update',
    body: { messageId: id, ...updates },
});
export const adminDeleteMessage = (id) => callAdminEndpoint({
    method: 'DELETE',
    action: 'message-delete',
    body: { messageId: id },
});

// User-facing message functions
export const getActiveMessages = async () => safeFetchArray((async () => {
    const userId = await getAppUserId();
    const now = new Date().toISOString();

    const [
        { data: messages, error: messagesError },
        { data: dismissed, error: dismissedError },
    ] = await Promise.all([
        supabase
            .from('global_messages')
            .select('id, title, content, type, created_at, expires_at')
            .eq('is_active', 1)
            .order('created_at', { ascending: false }),
        supabase
            .from('user_dismissed_messages')
            .select('message_id')
            .eq('user_id', userId),
    ]);

    if (messagesError) _sbThrow(messagesError);
    if (dismissedError) _sbThrow(dismissedError);

    const dismissedIds = new Set((dismissed || []).map((row) => row.message_id));

    return (messages || [])
        .filter((message) => !message.expires_at || message.expires_at > now)
        .filter((message) => !dismissedIds.has(message.id))
        .map((message) => ({
            id: message.id,
            title: message.title,
            content: message.content,
            type: message.type,
            createdAt: message.created_at,
        }));
})());

export const dismissMessage = async (id) => {
    const userId = await getAppUserId();
    const { error } = await supabase
        .from('user_dismissed_messages')
        .insert({
            user_id: userId,
            message_id: Number(id),
        });

    if (error && error.code !== '23505') _sbThrow(error);
    return { message: 'Message dismissed' };
};

// ============ 2FA ENDPOINTS ============

export const getActiveTwoFactorProvider = async () => {
    const mfaState = await getSupabaseMfaState().catch(() => ({
        hasSession: false,
        enabled: false,
    }));

    if (mfaState.hasSession && mfaState.enabled) {
        return 'supabase';
    }

    return 'legacy';
};

export const setup2FA = async () => {
    const mfaState = await getSupabaseMfaState().catch(() => ({
        hasSession: false,
        enabled: false,
    }));

    if (!mfaState.hasSession) {
        const legacyData = await authFetch('/auth/2fa/setup', { method: 'POST' });
        return {
            provider: 'legacy',
            ...legacyData,
        };
    }

    const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        issuer: 'Riven',
        friendlyName: 'Riven',
    });
    if (error) throw error;

    return {
        provider: 'supabase',
        factorId: data.id,
        secret: data.totp.secret,
        qrCode: data.totp.qr_code,
    };
};

export const verify2FA = async (setupDataOrToken, maybeToken) => {
    const setupData = typeof setupDataOrToken === 'object' && setupDataOrToken
        ? setupDataOrToken
        : null;
    const token = setupData ? maybeToken : setupDataOrToken;

    if (setupData?.provider === 'supabase' && setupData.factorId) {
        const { data, error } = await supabase.auth.mfa.challengeAndVerify({
            factorId: setupData.factorId,
            code: token,
        });
        if (error) throw error;
        if (data?.access_token) setToken(data.access_token);
        return { message: '2FA enabled successfully' };
    }

    return authFetch('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ token })
    });
};

export const disable2FA = async (input) => {
    const payload = typeof input === 'object' && input
        ? input
        : { password: input };

    if (payload.provider === 'legacy') {
        return authFetch('/auth/2fa/disable', {
            method: 'POST',
            body: JSON.stringify({ password: payload.password })
        });
    }

    const mfaState = await getSupabaseMfaState().catch(() => ({
        hasSession: false,
        enabled: false,
        factorId: null,
    }));

    if (mfaState.hasSession && mfaState.enabled && mfaState.factorId) {
        if (!payload.code) {
            const error = new Error('Verification code is required');
            error.status = 400;
            throw error;
        }

        const { data, error } = await supabase.auth.mfa.challengeAndVerify({
            factorId: mfaState.factorId,
            code: payload.code,
        });
        if (error) throw error;
        if (data?.access_token) setToken(data.access_token);

        const { error: unenrollError } = await supabase.auth.mfa.unenroll({
            factorId: mfaState.factorId,
        });
        if (unenrollError) throw unenrollError;

        return { message: '2FA disabled successfully' };
    }

    return authFetch('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password: payload.password })
    });
};

export const login2FA = async (challengeOrTempToken, token) => {
    if (challengeOrTempToken?.provider === 'supabase' && challengeOrTempToken.factorId) {
        const { data, error } = await supabase.auth.mfa.challengeAndVerify({
            factorId: challengeOrTempToken.factorId,
            code: token,
        });
        if (error) throw error;
        if (data?.access_token) setToken(data.access_token);
        return getMe();
    }

    const tempToken = typeof challengeOrTempToken === 'string'
        ? challengeOrTempToken
        : challengeOrTempToken?.tempToken;

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

export const forgotPassword = (email) =>
    edgeFunctionFetch('forgot-password', { method: 'POST', body: { email } });

export const resetPassword = async (token, password) => {
    if (!token || !password) {
        const error = new Error('Token and new password are required');
        error.status = 400;
        throw error;
    }

    if (password.length < 8) {
        const error = new Error('Password must be at least 8 characters');
        error.status = 400;
        throw error;
    }

    if (!isLegacyTokenHash(token)) {
        let recoveryData = null;
        try {
            const redirectTo = buildAuthRedirectUrl('/reset-password');
            const params = {
                token_hash: token,
                type: 'recovery',
                ...(redirectTo ? { options: { redirectTo } } : {}),
            };
            const { data, error } = await supabase.auth.verifyOtp(params);
            if (!error) {
                recoveryData = data;
            }
        } catch {
            recoveryData = null;
        }

        if (recoveryData) {
            if (recoveryData.session?.access_token) {
                setToken(recoveryData.session.access_token);
            }

            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            return { message: 'Password has been reset successfully. You can now log in.' };
        }
    }

    return edgeFunctionFetch('reset-password', {
        method: 'POST',
        body: { token, password },
    });
};

// ============ HEARTS API ============
export const getHeartsStatus = () =>
    edgeFunctionFetch('hearts', { method: 'GET', query: { action: 'status' } });

export const getSessionHearts = (deckId) =>
    edgeFunctionFetch('hearts', { method: 'GET', query: { action: 'session', deckId } });

export const decrementHeart = () =>
    edgeFunctionFetch('hearts', { method: 'POST', body: { action: 'decrement' } });

export const refillHearts = (amount) =>
    edgeFunctionFetch('hearts', { method: 'POST', body: { action: 'refill', amount } });

export const practiceRefill = () =>
    edgeFunctionFetch('hearts', { method: 'POST', body: { action: 'practice-refill' } });

// Owner: Simulate Free Tier toggle
export const toggleSimulateFree = async () => {
    return edgeFunctionFetch('simulate-free', { method: 'POST' });
};

// ============ REFERRALS API ============
export const getReferralInfo = () =>
    edgeFunctionFetch('referrals', { method: 'GET', query: { action: 'me' } });

export const applyReferralCode = (code) =>
    edgeFunctionFetch('referrals', { method: 'POST', body: { action: 'apply', code } });

export const checkReferralQualification = () =>
    edgeFunctionFetch('referrals', { method: 'POST', body: { action: 'check-qualification' } });

// ============ STRIPE API ============
export const createStripeCheckoutSession = ({ priceId, isSubscription }) =>
    edgeFunctionFetch('create-checkout', { method: 'POST', body: { priceId, isSubscription } });

export const createStripePortalSession = () =>
    edgeFunctionFetch('create-portal', { method: 'POST' });


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
    restoreSessionUser,
    updateProfile,
    changePassword,
    deleteAccount,
    getStreak,
    updateStreak,
    getPetCustomization,
    updatePetCustomization,
    getActiveTwoFactorProvider,
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
    subscribeToTypingPresence,
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

    // Stripe API
    createStripeCheckoutSession,
    createStripePortalSession,

    // Password Reset
    forgotPassword,
    resetPassword,

};
