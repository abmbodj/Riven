import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabaseClient';
import {
    forEachAuthStorage,
    getRivenTokenStorage,
    getSafeStorage,
    setAuthPersistenceMode,
} from '../lib/authPersistence';
import {
    DEPRECATED_DEFAULT_THEME_NAMES,
    getDefaultThemes,
    THEME_VISUAL_FIELDS,
} from '../themeCatalog.js';
import {
    isSharedMessageType,
    normalizeSharedPayload,
    serializeSharedPayload,
} from '../utils/sharedResources.js';
import {
    buildAggregatePaceTemperament,
    buildStrengthInsights,
    MIN_HUB_INSIGHT_ATTEMPTS,
} from '../lib/examInsightSignals.js';

// Authentication API - communicates with server for cross-device sync
// Set VITE_API_URL for the legacy Express server (used only for login/register/2FA bridges)
const normalizeApiBase = (apiBase) => {
    const normalized = String(apiBase || '').trim();
    if (!normalized) return normalized;

    if (/^https?:\/\//i.test(normalized)) {
        try {
            const url = new URL(normalized);
            const pathname = url.pathname.replace(/\/+$/, '');
            url.pathname = pathname || '/api';
            return `${url.origin}${url.pathname}${url.search}${url.hash}`;
        } catch {
            return normalized.replace(/\/+$/, '');
        }
    }

    return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
};

const resolveApiBase = () => {
    let apiBase = import.meta.env.VITE_API_URL;

    if (!apiBase) {
        if (Capacitor.isNativePlatform()) {
            // On iOS Simulator, localhost correctly resolves to the Mac's host IP for servers.
            // For physical devices, VITE_API_URL must be explicitly set to the Mac's local network IP.
            apiBase = 'http://localhost:3000/api';
        } else {
            apiBase = '/api';
        }
    }

    return normalizeApiBase(apiBase);
};

const getApiBase = () => resolveApiBase();



// SECURITY NOTE: Storing JWTs client-side is an XSS risk. We prefer httpOnly
// cookies (set by the server), but Capacitor/iOS PWA environments have broken
// cookie jars so we fall back to in-memory + Web Storage. The mobile
// keep-signed-in option chooses durable vs session-only storage explicitly.
const TOKEN_KEY = 'riven_auth_token';
const GOOGLE_OAUTH_BRIDGE_TOKEN_KEY = 'riven_google_oauth_bridge_token';
export const AUTH_SESSION_EXPIRED_CODE = 'AUTH_SESSION_EXPIRED';
export const AUTH_SESSION_EXPIRED_EVENT = 'riven-auth-session-expired';
const csrfTokenCache = new Map();
const EDGE_FUNCTION_AUTH_HEADER = 'x-supabase-auth';
const WEEKLY_SUMMARY_STORAGE_PREFIX = 'riven:weekly-summary';
const WEEKLY_SUMMARY_TTL_MS = 15 * 60 * 1000;
const DEFAULT_PUSH_PREFERENCES = Object.freeze({
    messagesEnabled: true,
    streakEnabled: true,
    reengagementEnabled: true,
});
const getWeeklySummaryStorageKey = (timeZone = 'UTC') => `${WEEKLY_SUMMARY_STORAGE_PREFIX}:${timeZone}`;

const clearWeeklySummaryCache = () => {
    const storage = getSafeStorage('sessionStorage');
    if (!storage) return;

    for (let index = storage.length - 1; index >= 0; index -= 1) {
        const key = storage.key(index);
        if (key?.startsWith(WEEKLY_SUMMARY_STORAGE_PREFIX)) {
            storage.removeItem(key);
        }
    }
};

const readWeeklySummaryCache = (timeZone) => {
    const storage = getSafeStorage('sessionStorage');
    if (!storage) return null;

    try {
        const raw = storage.getItem(getWeeklySummaryStorageKey(timeZone));
        if (!raw) return null;

        const parsed = JSON.parse(raw);
        if (!parsed?.expiresAt || Date.now() > parsed.expiresAt) {
            storage.removeItem(getWeeklySummaryStorageKey(timeZone));
            return null;
        }

        return parsed.value ?? null;
    } catch {
        storage.removeItem(getWeeklySummaryStorageKey(timeZone));
        return null;
    }
};

const writeWeeklySummaryCache = (timeZone, value) => {
    const storage = getSafeStorage('sessionStorage');
    if (!storage) return;

    storage.setItem(getWeeklySummaryStorageKey(timeZone), JSON.stringify({
        expiresAt: Date.now() + WEEKLY_SUMMARY_TTL_MS,
        value,
    }));
};

export const getToken = () => getRivenTokenStorage().getItem(TOKEN_KEY);
let cachedAppUserId = null;
let cachedAuthToken = null;

const applyAuthPersistenceOption = (options = {}) => {
    if (typeof options?.keepSignedIn === 'boolean') {
        setAuthPersistenceMode(options.keepSignedIn);
    }
};

export const setToken = (token) => {
    const normalizedToken = token || null;

    if (normalizedToken) {
        getRivenTokenStorage().setItem(TOKEN_KEY, normalizedToken);
    } else {
        forEachAuthStorage((storage) => {
            storage.removeItem(TOKEN_KEY);
            storage.removeItem(GOOGLE_OAUTH_BRIDGE_TOKEN_KEY);
        });
    }

    if (normalizedToken !== cachedAuthToken) {
        cachedAppUserId = null;
        cachedAuthToken = normalizedToken;
    }
};

const cacheGoogleOAuthBridgeToken = (token) => {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    if (!normalizedToken) return null;
    getRivenTokenStorage().setItem(GOOGLE_OAUTH_BRIDGE_TOKEN_KEY, normalizedToken);
    return normalizedToken;
};

const getCachedGoogleOAuthBridgeToken = () => {
    let cachedToken = null;

    forEachAuthStorage((storage) => {
        if (cachedToken != null) return;
        cachedToken = storage.getItem(GOOGLE_OAUTH_BRIDGE_TOKEN_KEY);
    });

    return cachedToken;
};

const clearGoogleOAuthBridgeToken = () => {
    forEachAuthStorage((storage) => {
        storage.removeItem(GOOGLE_OAUTH_BRIDGE_TOKEN_KEY);
    });
};

const normalizePushPreferenceFlag = (value, fallback) => {
    if (typeof value === 'boolean') return value;
    if (value == null) return fallback;
    return Boolean(value);
};

const normalizePushPreferences = (value) => ({
    messagesEnabled: normalizePushPreferenceFlag(
        value?.messagesEnabled ?? value?.messages_enabled,
        DEFAULT_PUSH_PREFERENCES.messagesEnabled,
    ),
    streakEnabled: normalizePushPreferenceFlag(
        value?.streakEnabled ?? value?.streak_enabled,
        DEFAULT_PUSH_PREFERENCES.streakEnabled,
    ),
    reengagementEnabled: normalizePushPreferenceFlag(
        value?.reengagementEnabled ?? value?.reengagement_enabled,
        DEFAULT_PUSH_PREFERENCES.reengagementEnabled,
    ),
});

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

const shouldPreserveSessionOnBridgeFailure = (error) => {
    const status = Number(error?.status);
    if (status && status !== 401 && status !== 403) {
        return true;
    }

    const normalized = String(error?.message || '').toLowerCase();
    return normalized.includes('invalid response')
        || normalized.includes('failed to fetch')
        || normalized.includes('load failed')
        || normalized.includes('networkerror');
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

const getApiOrigin = () => {
    if (typeof window === 'undefined') return null;

    try {
        return new URL(getApiBase(), window.location.origin).origin;
    } catch {
        return null;
    }
};

const getCsrfCacheKey = () => getApiOrigin() || getApiBase();

const isCrossOriginApiBase = () => (
    typeof window !== 'undefined'
    && Boolean(getApiOrigin())
    && getApiOrigin() !== window.location.origin
);

const clearCachedCsrfToken = () => {
    const cacheKey = getCsrfCacheKey();
    if (cacheKey) {
        csrfTokenCache.delete(cacheKey);
    }
};

const cacheCsrfToken = (token) => {
    const normalizedToken = typeof token === 'string' ? token.trim() : '';
    if (!normalizedToken) return '';

    const cacheKey = getCsrfCacheKey();
    if (cacheKey) {
        csrfTokenCache.set(cacheKey, normalizedToken);
    }

    return normalizedToken;
};

const getCachedCsrfToken = () => {
    const cacheKey = getCsrfCacheKey();
    if (!cacheKey) return '';
    return csrfTokenCache.get(cacheKey) || '';
};

const extractCsrfToken = async (response) => {
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return '';
    }

    const text = await response.text().catch(() => '');
    if (!text) {
        return '';
    }

    try {
        const data = JSON.parse(text);
        return typeof data?.csrfToken === 'string' ? data.csrfToken : '';
    } catch {
        return '';
    }
};

const primeCsrfToken = async () => {
    const cachedToken = getCachedCsrfToken();
    if (cachedToken) {
        return cachedToken;
    }

    if (!isCrossOriginApiBase()) {
        const sameOriginCookieToken = getCsrfToken();
        if (sameOriginCookieToken) {
            return cacheCsrfToken(sameOriginCookieToken);
        }
    }

    const response = await fetch(`${getApiBase()}/csrf`, {
        credentials: 'include',
    }).catch(() => null);

    if (!response) {
        return '';
    }

    const responseToken = await extractCsrfToken(response);
    if (responseToken) {
        return cacheCsrfToken(responseToken);
    }

    if (!isCrossOriginApiBase()) {
        const refreshedCookieToken = getCsrfToken();
        if (refreshedCookieToken) {
            return cacheCsrfToken(refreshedCookieToken);
        }
    }

    return '';
};

// Fetch wrapper with dual auth (Cookie + Header)
const authFetch = async (endpoint, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const requiresCsrf = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';

    const executeRequest = async ({ allowCsrfRetry = true } = {}) => {
        const token = getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers,
        };

        if (token && token !== 'logged_in') {
            headers.Authorization = `Bearer ${token}`;
        }

        if (requiresCsrf) {
            const csrfToken = await primeCsrfToken();
            if (csrfToken) {
                headers['x-csrf-token'] = csrfToken;
            }
        }

        try {
            const response = await fetch(`${getApiBase()}${endpoint}`, {
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
                if (allowCsrfRetry && requiresCsrf && response.status === 403 && data?.error === 'CSRF token mismatch') {
                    clearCachedCsrfToken();
                    await primeCsrfToken().catch(() => '');
                    return executeRequest({ allowCsrfRetry: false });
                }

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

    return executeRequest();
};

const getSupabaseUrl = () => (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const getSupabaseAnonKey = () => import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const isLegacyAuthBridgeEnabled = () => (
    import.meta.env.VITE_ENABLE_LEGACY_AUTH_BRIDGE === 'true'
    || Boolean(import.meta.env.VITE_API_URL)
);
const hasLegacyAuthCookie = () => (
    typeof document !== 'undefined'
    && /(?:^|;\s*)token=/.test(document.cookie || '')
);
const canAttemptSupabaseSessionBridge = () => (
    isLegacyAuthBridgeEnabled()
    && (Boolean(getToken()) || hasLegacyAuthCookie())
);

const hydrateSupabaseSessionFromBridge = async () => {
    if (!canAttemptSupabaseSessionBridge()) {
        return null;
    }

    const bridgeData = await authFetch('/auth/supabase-token', { method: 'POST' });
    const accessToken = bridgeData?.access_token || null;
    const refreshToken = bridgeData?.refresh_token || null;

    if (!accessToken) {
        return null;
    }

    if (typeof supabase?.auth?.setSession === 'function' && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
        });
        if (error) throw error;

        const session = data?.session || null;
        if (session?.access_token) {
            setToken(session.access_token);
            return session;
        }
    }

    setToken(accessToken);
    return {
        access_token: accessToken,
        refresh_token: refreshToken,
    };
};



const getActiveSupabaseSession = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    return session?.access_token ? session : null;
};

const getSessionProvider = (session) => (
    session?.user?.app_metadata?.provider
    || session?.user?.identities?.[0]?.provider
    || null
);

const isGoogleOAuthSession = (session) => getSessionProvider(session) === 'google';

const cacheGoogleOAuthBridgeTokenFromSession = (session) => {
    if (!isGoogleOAuthSession(session)) {
        return null;
    }

    return cacheGoogleOAuthBridgeToken(session?.provider_token);
};

const buildAuthRedirectUrl = (path = '') => {
    const origin = globalThis?.location?.origin;
    if (!origin || origin === 'null') return undefined;
    return `${origin.replace(/\/$/, '')}${path}`;
};

const isLegacyTokenHash = (token) => typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);

// Shared token resolution for edge function calls.
// Uses the Supabase client's own session — the same token that PostgREST uses successfully.
// No client-side JWT validation; the Supabase gateway validates server-side.
const resolveEdgeFunctionToken = async (_supabaseUrl, { skipForceReauth = false } = {}) => {
    const accessToken = await refreshSupabaseToken().catch(() => null);
    if (accessToken) {
        return accessToken;
    }

    if (!skipForceReauth) {
        setToken(null);
        await forceReauth();
        const error = new Error('Session expired. Please sign in again.');
        error.code = AUTH_SESSION_EXPIRED_CODE;
        error.status = 401;
        throw error;
    }

    return null;
};

export const primeEdgeFunctionAuth = async () => {
    const supabaseUrl = getSupabaseUrl();
    return resolveEdgeFunctionToken(supabaseUrl);
};

const fetchEdgeFunctionWithQuery = async (functionName, { method = 'GET', body, query, skipForceReauth = false } = {}) => {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    const accessToken = await resolveEdgeFunctionToken(supabaseUrl, { skipForceReauth });
    const url = new URL(`${supabaseUrl}/functions/v1/${functionName}`);

    Object.entries(query || {}).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
            url.searchParams.set(key, String(value));
        }
    });

    const headers = {
        apikey: anonKey,
    };

    if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
        headers[EDGE_FUNCTION_AUTH_HEADER] = accessToken;
    }

    if (method !== 'GET' && method !== 'HEAD' && body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url.toString(), {
        method,
        headers,
        body: method !== 'GET' && method !== 'HEAD' && body !== undefined
            ? JSON.stringify(body)
            : undefined,
    });

    const contentType = response.headers.get('content-type') || '';
    let responseBody = {};

    if (contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        responseBody = text ? JSON.parse(text) : {};
    } else {
        const text = await response.text().catch(() => '');
        responseBody = text ? { message: text } : {};
    }

    if (!response.ok) {
        const message = responseBody.error || responseBody.message || 'Edge function request failed';
        const err = new Error(message);
        err.status = response.status;
        err.code = responseBody.code;
        err.body = responseBody;

        if (!skipForceReauth && shouldForceReauthFromEdgeError(response.status, message)) {
            let bridgeAttemptFailed = false;
            const bridgedSession = await hydrateSupabaseSessionFromBridge().catch((bridgeError) => {
                if (shouldPreserveSessionOnBridgeFailure(bridgeError)) {
                    console.warn('[authApi] Supabase auth bridge unavailable; preserving current session state.', bridgeError);
                    return null;
                }
                bridgeAttemptFailed = true;
                return null;
            });
            if (bridgedSession?.access_token) {
                return fetchEdgeFunctionWithQuery(functionName, {
                    method,
                    body,
                    query,
                    skipForceReauth: true,
                });
            }

            if (canAttemptSupabaseSessionBridge() && !bridgeAttemptFailed) {
                throw err;
            }

            await forceReauth();
            err.code = AUTH_SESSION_EXPIRED_CODE;
            err.message = 'Session expired. Please sign in again.';
        }

        throw err;
    }

    return responseBody;
};

const edgeFunctionFetch = async (functionName, { method = 'POST', body, query, skipForceReauth = false } = {}) => {
    return fetchEdgeFunctionWithQuery(functionName, { method, body, query, skipForceReauth });
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
    return edgeFunctionFetch('complete-registration', {
        method: 'POST',
        body: username ? { username } : {},
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
        options: {
            data: { username },
            ...(captchaToken ? { captchaToken } : {}),
        },
    });

    if (!error && data.session) {
        // Supabase confirmed immediately (email confirmation disabled in dashboard).
        setToken(data.session.access_token);
        const result = await completeRegistration(username);
        return result.user;
    }

    // Email confirmation required or Supabase signup failed —
    // fall back to legacy Express register for immediate login.
    // The Supabase user (if created) will be linked on first confirmed login.
    const legacyData = await authFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password, captchaToken }),
        headers: Capacitor.isNativePlatform() ? { 'X-Riven-Client': 'capacitor' } : {},
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

export const login = async (email, password, options = {}) => {
    applyAuthPersistenceOption(options);

    // Try Supabase Auth first (new users and migrated users)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (!error && data.session) {
        setToken(data.session.access_token);
        const fallbackMfaState = {
            hasSession: true,
            enabled: false,
            factorId: null,
            currentLevel: null,
            nextLevel: null,
        };
        const userPromise = completeRegistration()
            .then((result) => result.user)
            .catch(() => getLocalMe());
        const mfaStatePromise = getSupabaseMfaState().catch(() => fallbackMfaState);
        const [user, mfaState] = await Promise.all([userPromise, mfaStatePromise]);

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

export const loginWithGoogle = async (credential, options = {}) => {
    applyAuthPersistenceOption(options);

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

export const startGoogleOAuth = async (options = {}) => {
    applyAuthPersistenceOption(options);

    if (Capacitor.isNativePlatform()) {
        throw new Error('Google sign-in is currently available only on web and PWA clients.');
    }

    clearGoogleOAuthBridgeToken();
    const redirectTo = buildAuthRedirectUrl('/account');
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: redirectTo ? { redirectTo } : undefined,
    });

    if (error) {
        throw new Error(error.message);
    }
};

const normalizeLegacyAppleUserPayload = (appleUser) => {
    const firstName = typeof appleUser?.name?.firstName === 'string'
        ? appleUser.name.firstName.trim()
        : (typeof appleUser?.givenName === 'string' ? appleUser.givenName.trim() : '');
    const lastName = typeof appleUser?.name?.lastName === 'string'
        ? appleUser.name.lastName.trim()
        : (typeof appleUser?.familyName === 'string' ? appleUser.familyName.trim() : '');

    if (!firstName && !lastName) {
        return null;
    }

    return {
        name: {
            ...(firstName ? { firstName } : {}),
            ...(lastName ? { lastName } : {}),
        },
    };
};

const persistAppleIdentityMetadata = async (appleUser) => {
    const givenName = typeof appleUser?.givenName === 'string' ? appleUser.givenName.trim() : '';
    const familyName = typeof appleUser?.familyName === 'string' ? appleUser.familyName.trim() : '';
    const fullName = typeof appleUser?.fullName === 'string'
        ? appleUser.fullName.trim()
        : [givenName, familyName].filter(Boolean).join(' ');

    if (!givenName && !familyName && !fullName) {
        return;
    }

    const { error } = await supabase.auth.updateUser({
        data: {
            ...(fullName ? { full_name: fullName } : {}),
            ...(givenName ? { given_name: givenName } : {}),
            ...(familyName ? { family_name: familyName } : {}),
        },
    });

    if (error) {
        throw error;
    }
};

export const loginWithApple = async (identityToken, rawNonce, appleUser, options = {}) => {
    applyAuthPersistenceOption(options);

    const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: identityToken,
        ...(rawNonce ? { nonce: rawNonce } : {}),
    });
    if (error) throw new Error(error.message);
    setToken(data.session.access_token);

    await persistAppleIdentityMetadata(appleUser).catch((metadataError) => {
        console.warn('[authApi] Apple metadata update failed:', metadataError);
    });

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
            body: JSON.stringify({
                identityToken,
                user: normalizeLegacyAppleUserPayload(appleUser),
            }),
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

/** When auth payloads omit onboarding fields (e.g. older edge responses), refetch profile so the gate stays accurate. */
export const hydrateUserIfOnboardingMissing = async (user) => {
    if (!user?.id || user.onboardingCompletedAt !== undefined) return user;
    try {
        const fresh = await getMe();
        return fresh?.id === user.id ? fresh : user;
    } catch {
        return user;
    }
};

export const restoreSessionUser = async () => {
    const refreshedSupabaseToken = await refreshSupabaseToken().catch(() => null);
    const token = getToken();
    if (!token) {
        clearGoogleOAuthBridgeToken();
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
            const session = await getActiveSupabaseSession().catch(() => null);
            const googleBridgeToken = getCachedGoogleOAuthBridgeToken()
                || cacheGoogleOAuthBridgeTokenFromSession(session);

            await supabase.auth.signOut().catch(() => {});
            setToken(null);
            clearGoogleOAuthBridgeToken();

            if (!isGoogleOAuthSession(session) || !googleBridgeToken) {
                return null;
            }

            try {
                const legacyData = await authFetch('/auth/oauth/google', {
                    method: 'POST',
                    body: JSON.stringify({ credential: googleBridgeToken }),
                });

                if (legacyData.require2FA) {
                    return {
                        ...legacyData,
                        provider: 'legacy',
                    };
                }

                if (legacyData.token) {
                    setToken(legacyData.token);
                } else if (legacyData.user) {
                    setToken('logged_in');
                }

                return legacyData.user || null;
            } catch (bridgeError) {
                console.warn('[authApi] Google OAuth legacy 2FA bridge failed:', bridgeError);
                return null;
            }
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

            if (mfaState.hasSession && result.user?.twoFAEnabled && !mfaState.enabled) {
                const session = await getActiveSupabaseSession().catch(() => null);
                const googleBridgeToken = getCachedGoogleOAuthBridgeToken()
                    || cacheGoogleOAuthBridgeTokenFromSession(session);

                await supabase.auth.signOut().catch(() => {});
                setToken(null);
                clearGoogleOAuthBridgeToken();

                if (!isGoogleOAuthSession(session) || !googleBridgeToken) {
                    return null;
                }

                try {
                    const legacyData = await authFetch('/auth/oauth/google', {
                        method: 'POST',
                        body: JSON.stringify({ credential: googleBridgeToken }),
                    });

                    if (legacyData.require2FA) {
                        return {
                            ...legacyData,
                            provider: 'legacy',
                        };
                    }

                    if (legacyData.token) {
                        setToken(legacyData.token);
                    } else if (legacyData.user) {
                        setToken('logged_in');
                    }

                    return legacyData.user || null;
                } catch (bridgeError) {
                    console.warn('[authApi] Google OAuth legacy 2FA bridge failed:', bridgeError);
                    return null;
                }
            }

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
    } finally {
        clearGoogleOAuthBridgeToken();
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
const refreshSupabaseToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    let accessToken = session?.access_token;
    if (!accessToken) {
        clearGoogleOAuthBridgeToken();
        const bridgedSession = await hydrateSupabaseSessionFromBridge().catch(() => null);
        return bridgedSession?.access_token || null;
    }

    cacheGoogleOAuthBridgeTokenFromSession(session);

    // If the cached access_token is expired or malformed, try refreshing
    // using the refresh_token instead of destroying the entire session.
    if (!isSupabaseAccessToken(accessToken) || isJwtExpired(accessToken)) {
        const { data: refreshed } = await supabase.auth.refreshSession()
            .catch(() => ({ data: {} }));

        if (refreshed?.session?.access_token
            && isSupabaseAccessToken(refreshed.session.access_token)
            && !isJwtExpired(refreshed.session.access_token)) {
            cacheGoogleOAuthBridgeTokenFromSession(refreshed.session);
            setToken(refreshed.session.access_token);
            return refreshed.session.access_token;
        }

        const bridgedSession = await hydrateSupabaseSessionFromBridge().catch(() => null);
        if (bridgedSession?.access_token) {
            return bridgedSession.access_token;
        }

        // Refresh truly failed — session is unrecoverable client-side
        await supabase.auth.signOut().catch(() => {});
        setToken(null);
        return null;
    }

    // Token is still valid — validate with server
    if (typeof supabase?.auth?.getUser === 'function') {
        const { data, error } = await supabase.auth.getUser(accessToken).catch(() => ({ data: { user: null }, error: new Error('Failed to validate session') }));
        if (error || !data?.user?.id) {
            const bridgedSession = await hydrateSupabaseSessionFromBridge().catch(() => null);
            if (bridgedSession?.access_token) {
                return bridgedSession.access_token;
            }

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
    'stripe_customer_id',
    'stripe_subscription_id',
    'simulate_free_tier',
    'email_verified',
    'onboarding_completed_at',
    'onboarding_step',
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

const normalizeWeeklySummaryTimeZone = (timeZone) => {
    const normalized = typeof timeZone === 'string' && timeZone.trim() ? timeZone.trim() : 'UTC';

    try {
        new Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
        return normalized;
    } catch {
        return 'UTC';
    }
};

const getDatePartsInTimeZone = (date, timeZone) => {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const parts = formatter.formatToParts(date);
    return {
        year: parts.find((part) => part.type === 'year')?.value || '1970',
        month: parts.find((part) => part.type === 'month')?.value || '01',
        day: parts.find((part) => part.type === 'day')?.value || '01',
    };
};

const getTimeZoneDateKey = (date, timeZone) => {
    const parts = getDatePartsInTimeZone(date, timeZone);
    return `${parts.year}-${parts.month}-${parts.day}`;
};

const buildWeeklyBreakdownTemplate = (timeZone, now = new Date()) => {
    const todayParts = getDatePartsInTimeZone(now, timeZone);
    const anchorDate = new Date(Date.UTC(
        Number(todayParts.year),
        Number(todayParts.month) - 1,
        Number(todayParts.day),
    ));

    return Array.from({ length: 7 }, (_, index) => {
        const date = new Date(anchorDate);
        date.setUTCDate(anchorDate.getUTCDate() - (6 - index));
        const isoDate = date.toISOString().slice(0, 10);

        return {
            date: isoDate,
            day: date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }),
            cards: 0,
            minutes: 0,
            studied: false,
            is_today: index === 6,
        };
    });
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

export const createClass = async (name, color, professor, room, zoom_link, subject) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('classes')
        .insert({
            user_id: userId,
            name,
            color: color || null,
            professor: professor || null,
            room: room || null,
            zoom_link: zoom_link || null,
            subject: subject || null
        })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const updateClass = async (id, name, color, professor, room, zoom_link, subject) => {
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (color !== undefined) updates.color = color;
    if (professor !== undefined) updates.professor = professor;
    if (room !== undefined) updates.room = room;
    if (zoom_link !== undefined) updates.zoom_link = zoom_link;
    if (subject !== undefined) updates.subject = subject;
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

// --- Calendar Sources (PostgREST) ---

export const getCalendarSources = async () => {
    const { data, error } = await supabase
        .from('calendar_sources')
        .select('*')
        .order('created_at', { ascending: true });
    if (error) _sbThrow(error);
    return data || [];
};

export const addCalendarSource = async ({ label, url, color, type = 'ical' }) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('calendar_sources')
        .insert({ user_id: userId, label, url, color, type, import_mode: 'url', file_name: null })
        .select()
        .single();
    if (error) _sbThrow(error);
    return data;
};

export const deleteCalendarSource = async (id) => {
    const { error } = await supabase.from('calendar_sources').delete().eq('id', id);
    if (error) _sbThrow(error);
};

export const syncCalendarSource = (sourceId) =>
    edgeFunctionFetch('calendar-source-sync', {
        method: 'POST',
        body: { sourceId },
    });

export const importCalendarSourceFile = ({ label, color, fileName, icsText }) =>
    edgeFunctionFetch('calendar-source-file-import', {
        method: 'POST',
        body: { label, color, fileName, icsText },
    });

export const replaceCalendarSourceFile = ({ sourceId, color, fileName, icsText }) =>
    edgeFunctionFetch('calendar-source-file-import', {
        method: 'POST',
        body: { sourceId, color, fileName, icsText, replaceExisting: true },
    });

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
export const setCanvasAutoSync = (enabled) => callCanvasLmsEndpoint({
    action: 'set-auto-sync',
    payload: { enabled },
});
export const getCanvasSettings = async () => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('users')
        .select('canvas_ical_url, canvas_auto_sync_enabled, last_canvas_sync_at, last_canvas_auto_sync_error')
        .eq('id', userId)
        .single();
    if (error) _sbThrow(error);

    return {
        isConnected: Boolean(data?.canvas_ical_url),
        canvasUrl: data?.canvas_ical_url || '',
        autoSyncEnabled: Boolean(data?.canvas_auto_sync_enabled),
        lastSyncAt: data?.last_canvas_sync_at || null,
        lastAutoSyncError: data?.last_canvas_auto_sync_error || '',
    };
};
export const syncCanvas = (adGranted = false) => callCanvasLmsEndpoint({
    action: 'sync',
    payload: { adGranted },
});
export const previewCanvasSemesterCleanup = () => callCanvasLmsEndpoint({
    action: 'preview-semester-cleanup',
});
export const archiveCanvasSemesterClasses = (classIds) => callCanvasLmsEndpoint({
    action: 'archive-semester-classes',
    payload: { classIds },
});
export const restoreArchivedClass = (classId) => callCanvasLmsEndpoint({
    action: 'restore-class',
    payload: { classId },
});

// --- AI Generation ---
export const getAILimits = () => edgeFunctionFetch('ai-limits', { method: 'GET' });

export const generateAiDeck = (notes, file, deckName, classId, className, subject) =>
    edgeFunctionFetch('generate-deck', { body: { notes, file, deckName, classId, className, subject } });

export const generateAiClass = (notes, file) =>
    edgeFunctionFetch('generate-class', { body: { notes, file } });

export const generateAiGuide = (notes, file, title, noteId, classId, className, replaceGuideId = null, coachConfig = null, subject = null) =>
    edgeFunctionFetch('generate-guide', { body: { notes, file, title, noteId, classId, className, replaceGuideId, coachConfig, subject } });

export const generateAiExam = (notes, file, title, sourceType, sourceId, classId, className, { examMode, weakTopics, subject } = {}) =>
    edgeFunctionFetch('generate-exam', { body: { notes, file, title, sourceType, sourceId, classId, className, examMode, weakTopics, subject } });

export const gradeShortAnswer = (question, studentAnswer, correctAnswer, gradingRubric) =>
    edgeFunctionFetch('grade-answer', { body: { question, studentAnswer, correctAnswer, gradingRubric } });

export const gradeTutorAnswer = (payload) =>
    edgeFunctionFetch('grade-tutor-answer', { body: payload });

export const generateFromYoutube = (youtubeUrl, type, { title, classId, deckName, className, subject } = {}) =>
    edgeFunctionFetch('generate-from-youtube', { body: { youtubeUrl, type, title, classId, deckName, className, subject } });

// --- AI Generation (Streaming) ---

const edgeFunctionStreamFetch = async (functionName, { body, allowBridgeRetry = true } = {}) => {
    const supabaseUrl = getSupabaseUrl();
    const anonKey = getSupabaseAnonKey();
    const accessToken = await resolveEdgeFunctionToken(supabaseUrl);
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
            ...(accessToken ? { [EDGE_FUNCTION_AUTH_HEADER]: accessToken } : {}),
        },
        body: JSON.stringify({ ...(body || {}), stream: true }),
    });

    if (!response.ok) {
        const contentType = response.headers.get('content-type') || '';
        let errorBody = {};
        if (contentType.includes('application/json')) {
            const text = await response.text().catch(() => '');
            errorBody = text ? JSON.parse(text) : {};
        } else {
            const text = await response.text().catch(() => '');
            errorBody = text ? { message: text } : {};
        }
        const message = errorBody.error || errorBody.message || 'Edge function request failed';
        const err = new Error(message);
        err.status = response.status;
        err.code = errorBody.code;
        err.body = errorBody;

        if (allowBridgeRetry && shouldForceReauthFromEdgeError(response.status, message)) {
            let bridgeAttemptFailed = false;
            const bridgedSession = await hydrateSupabaseSessionFromBridge().catch((bridgeError) => {
                if (shouldPreserveSessionOnBridgeFailure(bridgeError)) {
                    console.warn('[authApi] Supabase auth bridge unavailable during stream request; preserving current session state.', bridgeError);
                    return null;
                }
                bridgeAttemptFailed = true;
                return null;
            });
            if (bridgedSession?.access_token) {
                return edgeFunctionStreamFetch(functionName, { body, allowBridgeRetry: false });
            }

            if (canAttemptSupabaseSessionBridge() && !bridgeAttemptFailed) {
                throw err;
            }
        }

        if (shouldForceReauthFromEdgeError(response.status, message)) {
            await forceReauth();
            err.code = AUTH_SESSION_EXPIRED_CODE;
            err.message = 'Session expired. Please sign in again.';
        }

        throw err;
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
        },
        abort: () => {
            reader.cancel();
        },
    };
};

export const generateAiDeckStream = (notes, file, deckName, classId, className, subject) =>
    edgeFunctionStreamFetch('generate-deck', { body: { notes, file, deckName, classId, className, subject } });

export const generateAiGuideStream = (notes, file, title, noteId, classId, className, replaceGuideId = null, coachConfig = null, subject = null) =>
    edgeFunctionStreamFetch('generate-guide', { body: { notes, file, title, noteId, classId, className, replaceGuideId, coachConfig, subject } });

export const generateAiExamStream = (notes, file, title, sourceType, sourceId, classId, className, { examMode, weakTopics, subject } = {}) =>
    edgeFunctionStreamFetch('generate-exam', { body: { notes, file, title, sourceType, sourceId, classId, className, examMode, weakTopics, subject } });

export const generateFromYoutubeStream = (youtubeUrl, type, { title, classId, deckName, className, subject } = {}) =>
    edgeFunctionStreamFetch('generate-from-youtube', { body: { youtubeUrl, type, title, classId, deckName, className, subject } });

export const enhanceNoteWithAudioStream = (noteId, audioPath, userNotes, title, className, subject) =>
    edgeFunctionStreamFetch('enhance-notes', { body: { noteId, audioPath, userNotes, title, className, subject } });

export const createAiJob = (kind, payload = {}) =>
    edgeFunctionFetch('create-ai-job', { body: { kind, payload } });

export const getAiJob = async (jobId) => {
    const { data, error } = await supabase
        .from('ai_jobs')
        .select('*')
        .eq('id', jobId)
        .maybeSingle();

    if (error) _sbThrow(error);
    return data || null;
};

export const listAiJobs = async ({
    kind,
    status,
    statuses,
    targetType,
    targetId,
    sourceKey,
    limit,
} = {}) => {
    let query = supabase
        .from('ai_jobs')
        .select('*')
        .order('created_at', { ascending: false });

    if (kind) query = query.eq('kind', kind);
    if (Array.isArray(statuses) && statuses.length > 0) query = query.in('status', statuses);
    else if (status) query = query.eq('status', status);
    if (targetType) query = query.eq('target_type', targetType);
    if (targetId !== undefined && targetId !== null && targetId !== '') query = query.eq('target_id', String(targetId));
    if (sourceKey) query = query.eq('source_key', sourceKey);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) _sbThrow(error);
    return data || [];
};

export const subscribeToAiJob = (jobId, handlers = {}) => {
    const channel = supabase
        .channel(`ai_job_${jobId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ai_jobs',
            filter: `id=eq.${jobId}`,
        }, (payload) => {
            if (payload.eventType === 'DELETE') {
                handlers.onDelete?.(payload.old, payload);
                return;
            }

            handlers.onUpdate?.(payload.new, payload);

            if (payload?.new?.status === 'completed') {
                handlers.onComplete?.(payload.new, payload);
            }

            if (payload?.new?.status === 'failed' || payload?.new?.status === 'cancelled') {
                handlers.onError?.(payload.new, payload);
            }
        });

    channel.subscribe();
    return () => supabase.removeChannel(channel);
};

export const subscribeToAiJobsForUser = (handlers = {}) => {
    const channel = supabase
        .channel('ai_jobs_user')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'ai_jobs',
        }, (payload) => {
            if (payload.eventType === 'DELETE') {
                handlers.onDelete?.(payload.old, payload);
                return;
            }

            handlers.onUpdate?.(payload.new, payload);

            if (payload?.new?.status === 'completed') {
                handlers.onComplete?.(payload.new, payload);
            }

            if (payload?.new?.status === 'failed' || payload?.new?.status === 'cancelled') {
                handlers.onError?.(payload.new, payload);
            }
        });

    channel.subscribe();
    return () => supabase.removeChannel(channel);
};

// --- AI Warmup ---
export const warmupAiFunctions = (...functionNames) => {
    const supabaseUrl = getSupabaseUrl();
    for (const fn of functionNames) {
        fetch(`${supabaseUrl}/functions/v1/${fn}`, {
            method: 'POST',
            headers: { 'x-warmup': '1' },
        }).catch(() => {}); // fire-and-forget
    }
};

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
    let ext = 'webm';
    if (audioBlob.type === 'audio/aac') ext = 'aac';
    else if (audioBlob.type === 'audio/mp4' || audioBlob.type === 'audio/m4a' || audioBlob.type === 'audio/x-m4a') ext = 'm4a';
    else if (audioBlob.type === 'audio/ogg' || audioBlob.type === 'audio/ogg;codecs=opus') ext = 'ogg';

    const path = `${userId}/${noteId}.${ext}`;
    const contentType = audioBlob.type || 'audio/webm';

    const { error } = await supabase.storage
        .from('note-audio')
        .upload(path, audioBlob, {
            contentType: contentType,
            upsert: true,
        });
    if (error) _sbThrow(error);
    return { path };
};

export const deleteNoteAudio = async (audioPath) => {
    const normalizedPath = String(audioPath || '').trim();
    if (!normalizedPath) return { path: null };

    const { error } = await supabase.storage
        .from('note-audio')
        .remove([normalizedPath]);
    if (error) _sbThrow(error);
    return { path: normalizedPath };
};

export const enhanceNoteWithAudio = (noteId, audioPath, userNotes, title, className, subject) =>
    edgeFunctionFetch('enhance-notes', { body: { noteId, audioPath, userNotes, title, className, subject } });

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
    if (updates.guide_data !== undefined) payload.guide_data = updates.guide_data;
    if (updates.study_state !== undefined) payload.study_state = updates.study_state;
    if (updates.format_version !== undefined) payload.format_version = updates.format_version;
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

export const getStudyCoach = async () => authFetch('/study/coach');

export const completeStudyCoachSession = async (payload) => edgeFunctionFetch('study-session-complete', {
    method: 'POST',
    body: payload || {},
});

export const assistStudyCoach = async (payload) => authFetch('/study/assist', {
    method: 'POST',
    body: JSON.stringify(payload || {}),
});

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

export const createExamAttempt = async (
    examId,
    score,
    total,
    answers,
    {
        durationSeconds,
        topicBreakdown,
        examTitle = null,
        classId = null,
        examMode = 'standard',
    } = {},
) => {
    const userId = await getAppUserId();
    const insertData = {
        user_id: userId,
        exam_id: examId,
        exam_source_id: examId,
        score,
        total,
        answers: answers || [],
        exam_title: examTitle,
        class_id: classId,
        exam_mode: examMode || 'standard',
    };
    if (durationSeconds != null) insertData.duration_seconds = durationSeconds;
    if (topicBreakdown) insertData.topic_breakdown = topicBreakdown;
    const { data, error } = await supabase
        .from('exam_attempts')
        .insert(insertData)
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

// --- Topic Mastery (PostgREST) ---

export const getTopicMastery = async (classId) => {
    let query = supabase.from('topic_mastery').select('*').order('mastery_score', { ascending: true });
    if (classId) query = query.eq('class_id', classId);
    const { data, error } = await query;
    if (error) _sbThrow(error);
    return data || [];
};

export const upsertTopicMastery = async (classId, topicBreakdown) => {
    // topicBreakdown: { "Topic Name": { correct: 2, total: 3 }, ... }
    const userId = await getAppUserId();
    const results = [];

    for (const [topic, stats] of Object.entries(topicBreakdown)) {
        // Fetch existing mastery to compute EMA
        let query = supabase
            .from('topic_mastery')
            .select('id, mastery_score, total_seen, total_correct')
            .eq('user_id', userId)
            .eq('topic', topic);

        if (classId) {
            query = query.eq('class_id', classId);
        } else {
            query = query.is('class_id', null);
        }

        const { data: existing } = await query.maybeSingle();

        const oldMastery = existing?.mastery_score ?? 0.5;
        const sessionAccuracy = stats.total > 0 ? stats.correct / stats.total : 0;
        const newMastery = 0.7 * oldMastery + 0.3 * sessionAccuracy;

        const record = {
            total_seen: (existing?.total_seen || 0) + stats.total,
            total_correct: (existing?.total_correct || 0) + stats.correct,
            mastery_score: Math.round(newMastery * 1000) / 1000,
            last_tested: new Date().toISOString(),
        };

        if (existing?.id) {
            // Update existing
            const { data, error } = await supabase
                .from('topic_mastery')
                .update(record)
                .eq('id', existing.id)
                .select()
                .single();
            if (error) _sbThrow(error);
            if (data) results.push(data);
        } else {
            // Insert new
            const { data, error } = await supabase
                .from('topic_mastery')
                .insert({ ...record, user_id: userId, class_id: classId || null, topic })
                .select()
                .single();
            if (error) _sbThrow(error);
            if (data) results.push(data);
        }
    }

    return results;
};

const getAttemptPercentage = (attempt) => {
    const total = Number(attempt?.total || 0);
    if (total <= 0) return null;
    return Math.round((Number(attempt?.score || 0) / total) * 100);
};

const averageNumbers = (values) => {
    if (!Array.isArray(values) || values.length === 0) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const formatEvidencePercent = (value) => `${Math.round(value)}%`;

const getAttemptLiveExam = (attempt) => attempt?.mock_exams || null;
const getAttemptTitle = (attempt) => getAttemptLiveExam(attempt)?.title || attempt?.exam_title || 'Exam';
const getAttemptClassId = (attempt) => getAttemptLiveExam(attempt)?.class_id || attempt?.class_id || null;
const getAttemptExamMode = (attempt) => getAttemptLiveExam(attempt)?.exam_mode || attempt?.exam_mode || 'standard';
const getAttemptSourceExamId = (attempt) => attempt?.exam_source_id || attempt?.exam_id || getAttemptLiveExam(attempt)?.id || null;
const getAttemptLiveExamId = (attempt) => getAttemptLiveExam(attempt)?.id || null;

const buildExamPersona = ({
    totalAttempts,
    averageScore,
    averagePaceSeconds,
    trendDelta,
    retryRate,
    latestAttempt,
    paceTemperament,
}) => {
    const temperament = paceTemperament || null;
    const isRushingTemperament = temperament?.key === 'rushing'
        && (temperament.confidence === 'medium' || temperament.confidence === 'high');
    const isNaturalFast = temperament?.key === 'natural-fast'
        && (temperament.confidence === 'medium' || temperament.confidence === 'high');

    if (totalAttempts < MIN_HUB_INSIGHT_ATTEMPTS) {
        return {
            key: 'getting-started',
            label: 'Getting Started',
            description: 'You are still building a useful exam pattern. A few more attempts will reveal pace, pressure points, and score trends.',
            evidence: [
                `${totalAttempts} completed attempt${totalAttempts === 1 ? '' : 's'}`,
                `Need ${MIN_HUB_INSIGHT_ATTEMPTS}+ attempts for trend data`,
            ],
            improvements: [
                'Take another mock exam this week to establish a baseline.',
                'Keep your next attempt linked to a class so your stats stay organized by subject.',
            ],
            paceTemperament: temperament,
        };
    }

    const retakeWithoutLift = retryRate >= 0.5 && (trendDelta == null || trendDelta < 5);
    const rushingBand = isRushingTemperament
        && averageScore != null
        && averageScore >= 60
        && averageScore < 80;
    const shouldCrammingLoop = (averageScore != null && averageScore < 60)
        || (trendDelta != null && trendDelta <= -8)
        || retakeWithoutLift
        || rushingBand;

    if (shouldCrammingLoop) {
        const rushingDescription = isRushingTemperament
            ? 'You are finishing quickly, but harder questions and fast misses suggest you may be moving on before ideas fully land.'
            : 'You are putting attempts on the board, but the results suggest you may be repeating tests faster than you are closing knowledge gaps.';
        return {
            key: isRushingTemperament ? 'cramming-loop-rushing' : 'cramming-loop',
            label: 'Cramming Loop',
            description: rushingDescription,
            evidence: [
                averageScore != null ? `${formatEvidencePercent(averageScore)} average score` : 'Low recent performance',
                isRushingTemperament && temperament?.evidence?.[0]
                    ? temperament.evidence[0]
                    : retryRate > 0 ? `${formatEvidencePercent(retryRate * 100)} retake rate` : 'Trend slipping',
            ],
            improvements: [
                isRushingTemperament
                    ? 'Slow down on the next timed run and leave room for a short review pass.'
                    : 'Pause back-to-back retakes and switch to a fresh mock after reviewing one recent attempt.',
                latestAttempt?.mock_exams?.title
                    ? `Review the misses from ${latestAttempt.mock_exams.title} before taking it again.`
                    : 'Review one recent attempt before starting another full exam.',
            ],
            paceTemperament: temperament,
        };
    }

    if (
        isNaturalFast
        && averageScore != null
        && averageScore >= 80
        && averagePaceSeconds != null
        && averagePaceSeconds <= 75
    ) {
        return {
            key: 'fast-and-accurate',
            label: 'Fast & Accurate',
            description: 'You are exam-ready under time pressure — quick pacing with accuracy that holds on harder questions.',
            evidence: [
                `${formatEvidencePercent(averageScore)} average score`,
                `${Math.round(averagePaceSeconds)}s per question`,
                ...(temperament?.evidence?.filter((item) => item.includes('hard')) || []),
            ],
            strengths: [
                temperament?.label ? `${temperament.label} on recent timed mocks` : 'Strong pace with controlled accuracy',
                `${formatEvidencePercent(averageScore)} average with fast pacing`,
            ],
            improvements: [
                'Mix in a fresh exam from the same class so your fastest lane stays honest.',
                'Retake a recent exam only after reviewing mistakes once to keep practice challenging.',
            ],
            paceTemperament: temperament,
        };
    }

    if (totalAttempts >= 4 && trendDelta != null && trendDelta >= 8 && !isRushingTemperament) {
        return {
            key: 'steady-climber',
            label: 'Steady Climber',
            description: 'You are building momentum — recent mocks are meaningfully stronger than your early baseline.',
            evidence: [
                `Recent trend +${Math.round(trendDelta)} pts`,
                `${formatEvidencePercent(averageScore || 0)} average score`,
            ],
            strengths: [
                `+${Math.round(trendDelta)} pt lift on recent attempts`,
                `${formatEvidencePercent(averageScore || 0)} average score across your history`,
            ],
            improvements: [
                'Lock in the gains with one fresh mock exam before the signal cools off.',
                'Keep spacing attempts instead of bunching multiple retakes into one sitting.',
            ],
            paceTemperament: temperament,
        };
    }

    const isStrongDeliberate = averageScore != null
        && averageScore >= 80
        && !isRushingTemperament
        && (temperament?.key === 'deliberate' || temperament?.key === 'natural-fast');

    const deliberateDescription = isStrongDeliberate
        ? 'You are a strong, careful exam taker — your pacing stays controlled and your scores back it up.'
        : temperament?.key === 'deliberate'
            ? 'You take more time per question and keep accuracy reasonably controlled — a solid base for targeted improvement.'
            : temperament?.key === 'slow'
                ? 'Your pacing is slower and scores are still building. Extra review before timed runs can help accuracy catch up.'
                : 'Your exam results are stable and reasonably controlled, which is a good base for more targeted improvement.';

    const deliberateStrengths = isStrongDeliberate
        ? [
            `${formatEvidencePercent(averageScore)} average with deliberate pacing`,
            temperament?.label || 'Controlled pace on timed attempts',
        ]
        : [];

    return {
        key: 'deliberate-builder',
        label: 'Deliberate Builder',
        description: deliberateDescription,
        evidence: [
            `${formatEvidencePercent(averageScore || 0)} average score`,
            trendDelta == null ? 'Trend still forming' : `${trendDelta >= 0 ? '+' : ''}${Math.round(trendDelta)} pt trend`,
        ],
        strengths: deliberateStrengths,
        improvements: [
            isRushingTemperament
                ? 'Add a short review pass between questions on your next timed attempt.'
                : 'Add one fresh mock exam to pressure-test your next study block.',
            'Keep one full-length exam in the mix so your pacing stays realistic.',
        ],
        paceTemperament: temperament,
    };
};

const mapRecentExamAttempt = (attempt) => ({
    id: attempt.id,
    examId: getAttemptSourceExamId(attempt),
    completedAt: attempt.completed_at,
    durationSeconds: Number(attempt.duration_seconds || 0) || null,
    score: Number(attempt.score || 0),
    total: Number(attempt.total || 0),
    percentage: getAttemptPercentage(attempt),
    title: getAttemptTitle(attempt),
    classId: getAttemptClassId(attempt),
    examMode: getAttemptExamMode(attempt),
});

const buildExamRecommendedActions = ({
    sortedAttempts,
    classOptions,
    classId = null,
    retryRate = 0,
    paceTemperament = null,
}) => {
    const latestAttempt = sortedAttempts[0] || null;
    const recommendedActions = [];
    const standardActionClassId = classId || getAttemptClassId(latestAttempt) || null;
    const standardActionClass = classOptions.find((option) => option.id === standardActionClassId) || null;

    recommendedActions.push({
        id: 'generate-next-exam',
        kind: 'generate_standard',
        label: standardActionClass?.name ? `Build another ${standardActionClass.name} exam` : 'Build a fresh mock exam',
        description: retryRate >= 0.5
            ? 'Use a fresh exam to break the retake loop.'
            : 'Keep your signal clean with a new mock exam.',
        payload: {
            ...(standardActionClassId ? { classId: standardActionClassId } : {}),
            ...(standardActionClass?.name ? { title: `${standardActionClass.name} Mock Exam` } : {}),
        },
    });

    const isRushingTemperament = paceTemperament?.key === 'rushing'
        && (paceTemperament.confidence === 'medium' || paceTemperament.confidence === 'high');
    const latestSourceExamId = getAttemptSourceExamId(latestAttempt);
    const latestLiveExamId = getAttemptLiveExamId(latestAttempt);
    const latestExamRetakeCount = latestSourceExamId
        ? sortedAttempts.filter((attempt) => getAttemptSourceExamId(attempt) === latestSourceExamId).length
        : 0;
    const suppressRetake = isRushingTemperament && latestExamRetakeCount >= 1;

    if (latestLiveExamId && !suppressRetake) {
        const latestAttemptPct = getAttemptPercentage(latestAttempt);
        recommendedActions.push({
            id: 'retake-latest-exam',
            kind: 'retake_exam',
            examId: latestLiveExamId,
            label: `Retake ${getAttemptTitle(latestAttempt)}`,
            description: latestAttemptPct != null
                ? `Your latest result was ${latestAttemptPct}%. Try it again after a quick review.`
                : 'Run the latest exam again after reviewing your misses.',
        });
    }

    return recommendedActions;
};

const buildCollectingExamInsights = ({ sortedAttempts, classOptions, classId = null }) => {
    const totalAttempts = sortedAttempts.length;
    const remaining = MIN_HUB_INSIGHT_ATTEMPTS - totalAttempts;

    return {
        hubReady: false,
        minAttemptsRequired: MIN_HUB_INSIGHT_ATTEMPTS,
        summary: {
            totalAttempts,
            averageScore: null,
            bestScore: null,
            averagePaceSeconds: null,
            trendDelta: null,
        },
        persona: {
            key: 'getting-started',
            label: 'Getting Started',
            description: `Complete ${remaining} more mock exam${remaining === 1 ? '' : 's'} to unlock persona, pace, and trend insights.`,
            evidence: [
                `${totalAttempts} of ${MIN_HUB_INSIGHT_ATTEMPTS} completed attempts`,
                `Need ${MIN_HUB_INSIGHT_ATTEMPTS}+ attempts for reliable trend data`,
            ],
            improvements: [
                'Take another timed mock exam to build your profile.',
                'Link exams to a class so future recommendations stay organized by subject.',
            ],
            paceTemperament: null,
            strengths: [],
        },
        paceTemperament: null,
        strengthInsights: {
            level: 'forming',
            affirmation: `Complete ${remaining} more mock${remaining === 1 ? '' : 's'} for a full performance read.`,
            strengths: [],
        },
        habits: {
            retryRate: 0,
            strongestStudyDay: null,
            averageDurationMinutes: null,
        },
        recentAttempts: sortedAttempts.slice(0, 8).map(mapRecentExamAttempt),
        recommendedActions: buildExamRecommendedActions({ sortedAttempts, classOptions, classId }),
        classOptions,
    };
};

const createEmptyExamInsights = () => ({
    hubReady: false,
    minAttemptsRequired: MIN_HUB_INSIGHT_ATTEMPTS,
    summary: {
        totalAttempts: 0,
        averageScore: null,
        bestScore: null,
        averagePaceSeconds: null,
        trendDelta: null,
    },
    persona: {
        key: 'getting-started',
        label: 'Getting Started',
        description: 'Your mock exam hub will start filling in after three completed mock exams.',
        evidence: ['0 completed attempts', 'No trend yet'],
        improvements: [
            'Generate your first mock exam to start tracking your exam habits.',
            'Link the exam to a class so future insights stay organized by subject.',
        ],
        paceTemperament: null,
        strengths: [],
    },
    paceTemperament: null,
    strengthInsights: {
        level: 'forming',
        affirmation: 'Complete your first mock exams to see what is working.',
        strengths: [],
    },
    habits: {
        retryRate: 0,
        strongestStudyDay: null,
        averageDurationMinutes: null,
    },
    recentAttempts: [],
    recommendedActions: [
        {
            id: 'generate-first-exam',
            kind: 'generate_standard',
            label: 'Generate your first mock exam',
            description: 'Start with one practice run so the hub can learn your pattern.',
        },
    ],
    classOptions: [],
});

export const getAllExamAttempts = async (classId) => {
    let query = supabase
        .from('exam_attempts')
        .select('*, mock_exams(id, class_id, title, exam_mode)')
        .order('completed_at', { ascending: false });
    const { data, error } = await query;
    if (error) _sbThrow(error);
    const attempts = data || [];
    if (!classId) return attempts;
    return attempts.filter((attempt) => getAttemptClassId(attempt) === classId);
};

export const getExamInsights = async ({ classId = null } = {}) => {
    const [attempts, classes] = await Promise.all([
        getAllExamAttempts(),
        getClasses(),
    ]);

    const sortedAttempts = [...attempts].sort(
        (left, right) => new Date(right.completed_at) - new Date(left.completed_at),
    );

    const classAttemptCounts = attempts.reduce((counts, attempt) => {
        const attemptClassId = getAttemptClassId(attempt);
        if (!attemptClassId) return counts;
        counts.set(attemptClassId, (counts.get(attemptClassId) || 0) + 1);
        return counts;
    }, new Map());

    const classOptions = classes
        .filter((classItem) => classAttemptCounts.has(classItem.id))
        .map((classItem) => ({
            id: classItem.id,
            name: classItem.name,
            color: classItem.color,
            attemptCount: classAttemptCounts.get(classItem.id) || 0,
        }))
        .sort((left, right) => right.attemptCount - left.attemptCount || left.name.localeCompare(right.name));

    if (sortedAttempts.length === 0) {
        return {
            ...createEmptyExamInsights(),
            classOptions,
        };
    }

    if (sortedAttempts.length < MIN_HUB_INSIGHT_ATTEMPTS) {
        return buildCollectingExamInsights({ sortedAttempts, classOptions, classId });
    }

    const attemptsAscending = [...sortedAttempts].reverse();
    const scoredPercentages = sortedAttempts
        .map((attempt) => getAttemptPercentage(attempt))
        .filter((value) => value != null);
    const bestScore = scoredPercentages.length > 0 ? Math.max(...scoredPercentages) : null;
    const averageScore = averageNumbers(scoredPercentages);

    const durationAttempts = sortedAttempts.filter((attempt) => (
        Number(attempt?.duration_seconds || 0) > 0 && Number(attempt?.total || 0) > 0
    ));
    const totalDurationSeconds = durationAttempts.reduce((sum, attempt) => sum + Number(attempt.duration_seconds || 0), 0);
    const totalQuestionsTimed = durationAttempts.reduce((sum, attempt) => sum + Number(attempt.total || 0), 0);
    const averagePaceSeconds = totalQuestionsTimed > 0 ? totalDurationSeconds / totalQuestionsTimed : null;
    const averageDurationMinutes = durationAttempts.length > 0
        ? averageNumbers(durationAttempts.map((attempt) => Number(attempt.duration_seconds || 0) / 60))
        : null;

    const earliestThreeAverage = averageNumbers(
        attemptsAscending.slice(0, 3).map((attempt) => getAttemptPercentage(attempt)).filter((value) => value != null),
    );
    const recentThreeAverage = averageNumbers(
        sortedAttempts.slice(0, 3).map((attempt) => getAttemptPercentage(attempt)).filter((value) => value != null),
    );
    const trendDelta = earliestThreeAverage != null && recentThreeAverage != null
        ? recentThreeAverage - earliestThreeAverage
        : null;

    const uniqueExamIds = new Set();
    let retakeCount = 0;
    sortedAttempts.forEach((attempt) => {
        const examId = getAttemptSourceExamId(attempt);
        if (!examId) return;
        if (uniqueExamIds.has(examId)) {
            retakeCount += 1;
            return;
        }
        uniqueExamIds.add(examId);
    });
    const retryRate = sortedAttempts.length > 0 ? retakeCount / sortedAttempts.length : 0;

    const weekdayStats = sortedAttempts.reduce((map, attempt) => {
        const date = new Date(attempt.completed_at);
        if (Number.isNaN(date.getTime())) return map;

        const key = date.toLocaleDateString('en-US', { weekday: 'long' });
        const current = map.get(key) || { label: key, scores: [], attempts: 0 };
        const percentage = getAttemptPercentage(attempt);

        if (percentage != null) current.scores.push(percentage);
        current.attempts += 1;
        map.set(key, current);
        return map;
    }, new Map());

    const strongestStudyDay = [...weekdayStats.values()]
        .map((item) => ({
            day: item.label,
            averageScore: averageNumbers(item.scores),
            attempts: item.attempts,
        }))
        .sort((left, right) => {
            const scoreDiff = (right.averageScore ?? -1) - (left.averageScore ?? -1);
            if (scoreDiff !== 0) return scoreDiff;
            return right.attempts - left.attempts;
        })[0] || null;

    const latestAttempt = sortedAttempts[0] || null;
    const paceTemperament = buildAggregatePaceTemperament(sortedAttempts, averageScore);
    const persona = buildExamPersona({
        totalAttempts: sortedAttempts.length,
        averageScore,
        averagePaceSeconds,
        trendDelta,
        retryRate,
        latestAttempt,
        paceTemperament,
    });

    const strengthInsights = buildStrengthInsights({
        totalAttempts: sortedAttempts.length,
        averageScore,
        bestScore,
        trendDelta,
        personaKey: persona.key,
        paceTemperament,
        latestAttempt,
        personaStrengths: persona.strengths || [],
    });
    persona.strengthInsights = strengthInsights;

    const recommendedActions = buildExamRecommendedActions({
        sortedAttempts,
        classOptions,
        classId,
        retryRate,
        paceTemperament,
    });

    return {
        hubReady: true,
        minAttemptsRequired: MIN_HUB_INSIGHT_ATTEMPTS,
        summary: {
            totalAttempts: sortedAttempts.length,
            averageScore,
            bestScore,
            averagePaceSeconds,
            trendDelta,
        },
        paceTemperament,
        persona,
        strengthInsights,
        habits: {
            retryRate,
            strongestStudyDay,
            averageDurationMinutes,
        },
        recentAttempts: sortedAttempts.slice(0, 8).map(mapRecentExamAttempt),
        recommendedActions,
        classOptions,
    };
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

export const reviewCard = async (id, rating) => {
    const cardId = Number(id);
    const { data: card, error: cardError } = await supabase
        .from('cards')
        .select('*')
        .eq('id', cardId)
        .single();
    if (cardError) _sbThrow(cardError);

    const { scheduleCard } = await import('../utils/fsrs.js');
    const fsrsUpdates = scheduleCard(card, rating);

    const { data, error } = await supabase
        .from('cards')
        .update(fsrsUpdates)
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
            xp_earned: 0,
        })
        .select()
        .single();
    if (error) _sbThrow(error);

    const { error: deckError } = await supabase
        .from('decks')
        .update({ last_studied: new Date().toISOString() })
        .eq('id', numericDeckId);
    if (deckError) _sbThrow(deckError);

    clearWeeklySummaryCache();
    return data;
};

export const getWeeklySummary = async (timeZone) => {
    const normalizedTimeZone = normalizeWeeklySummaryTimeZone(timeZone);
    const cached = readWeeklySummaryCache(normalizedTimeZone);
    if (cached) {
        return cached;
    }

    const appUserId = await getAppUserId();
    const template = buildWeeklyBreakdownTemplate(normalizedTimeZone);

    const { data: deckRows, error: deckError } = await supabase
        .from('decks')
        .select('id')
        .eq('user_id', appUserId);
    if (deckError) _sbThrow(deckError);

    const ownedDeckIds = (deckRows || []).map((deck) => deck.id).filter(Boolean);
    if (ownedDeckIds.length === 0) {
        const emptySummary = {
            cards_studied: 0,
            accuracy: null,
            total_minutes: 0,
            daily_breakdown: template,
        };
        writeWeeklySummaryCache(normalizedTimeZone, emptySummary);
        return emptySummary;
    }

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - 8);

    const { data: sessionRows, error: sessionError } = await supabase
        .from('study_sessions')
        .select('cards_studied, cards_correct, duration_seconds, created_at')
        .in('deck_id', ownedDeckIds)
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: true });
    if (sessionError) _sbThrow(sessionError);

    const breakdown = template.map((day) => ({ ...day }));
    const breakdownByDate = new Map(breakdown.map((day) => [day.date, day]));

    let totalCards = 0;
    let totalCorrect = 0;
    let totalDurationSeconds = 0;

    for (const session of sessionRows || []) {
        const cardsStudiedCount = Number(session.cards_studied || 0);
        const cardsCorrectCount = Number(session.cards_correct || 0);
        const durationSecondsCount = Number(session.duration_seconds || 0);
        const createdAt = new Date(session.created_at);

        if (Number.isNaN(createdAt.getTime())) continue;

        const dateKey = getTimeZoneDateKey(createdAt, normalizedTimeZone);
        const dayBucket = breakdownByDate.get(dateKey);
        if (!dayBucket) continue;

        dayBucket.cards += cardsStudiedCount;
        dayBucket.minutes += Math.round(durationSecondsCount / 60);
        dayBucket.studied = dayBucket.studied || cardsStudiedCount > 0 || durationSecondsCount > 0;

        totalCards += cardsStudiedCount;
        totalCorrect += cardsCorrectCount;
        totalDurationSeconds += durationSecondsCount;
    }

    const summary = {
        cards_studied: totalCards,
        accuracy: totalCards > 0 ? totalCorrect / totalCards : null,
        total_minutes: Math.round(totalDurationSeconds / 60),
        daily_breakdown: breakdown,
    };

    writeWeeklySummaryCache(normalizedTimeZone, summary);
    return summary;
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
        new: cardRows.filter((card) => !card.card_state || card.card_state === 'new').length,
        learning: cardRows.filter((card) => card.card_state === 'learning' || card.card_state === 'relearning').length,
        familiar: cardRows.filter((card) => card.card_state === 'review' && (card.stability || 0) < 21).length,
        mastered: cardRows.filter((card) => card.card_state === 'review' && (card.stability || 0) >= 21).length,
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
    const sortThemes = (themes) => (themes || []).sort((left, right) => {
        const defaultDelta = Number(right.is_default) - Number(left.is_default);
        if (defaultDelta !== 0) return defaultDelta;
        return (left.name || '').localeCompare(right.name || '');
    });

    const selectThemes = async () => {
        const { data, error } = await supabase.from('themes').select('*');
        if (error) _sbThrow(error);
        return data || [];
    };

    const pruneDeprecatedDefaultThemes = async (themes) => {
        if (!getToken()) return false;

        const deprecatedThemeIds = (themes || [])
            .filter((theme) => theme.is_default && DEPRECATED_DEFAULT_THEME_NAMES.includes(theme.name))
            .map((theme) => theme.id)
            .filter(Boolean);

        if (deprecatedThemeIds.length === 0) return false;

        const { error } = await supabase
            .from('themes')
            .delete()
            .in('id', deprecatedThemeIds);
        if (error) _sbThrow(error);

        return true;
    };

    const syncDefaultThemes = async (themes) => {
        if (!getToken()) return false;

        const existingDefaults = new Map(
            (themes || [])
                .filter((theme) => theme.is_default)
                .map((theme) => [theme.name, theme])
        );
        const hasActiveTheme = (themes || []).some((theme) => theme.is_active);
        const userId = await getAppUserId();
        let didMutate = false;
        let shouldAssignActiveDefault = !hasActiveTheme;

        for (const preset of getDefaultThemes()) {
            const existing = existingDefaults.get(preset.name);

            if (!existing) {
                const payload = {
                    user_id: userId,
                    ...preset,
                    is_active: shouldAssignActiveDefault && preset.is_active ? 1 : 0,
                };
                const { error } = await supabase.from('themes').insert(payload);
                if (error) _sbThrow(error);
                if (payload.is_active) {
                    shouldAssignActiveDefault = false;
                }
                didMutate = true;
                continue;
            }

            const updates = {};
            for (const field of THEME_VISUAL_FIELDS) {
                const existingValue = Array.isArray(existing[field])
                    ? JSON.stringify(existing[field])
                    : (existing[field] || null);
                const presetValue = Array.isArray(preset[field])
                    ? JSON.stringify(preset[field])
                    : (preset[field] || null);

                if (existingValue !== presetValue) {
                    updates[field] = preset[field];
                }
            }

            if (!existing.is_default) {
                updates.is_default = 1;
            }

            if (shouldAssignActiveDefault && preset.is_active && !existing.is_active) {
                updates.is_active = 1;
                shouldAssignActiveDefault = false;
            }

            if (Object.keys(updates).length === 0) continue;

            const { error } = await supabase
                .from('themes')
                .update(updates)
                .eq('id', existing.id);
            if (error) _sbThrow(error);
            didMutate = true;
        }

        return didMutate;
    };

    let themes = await selectThemes();
    if (await pruneDeprecatedDefaultThemes(themes)) {
        themes = await selectThemes();
    }
    if (await syncDefaultThemes(themes)) {
        themes = await selectThemes();
    }

    return sortThemes(themes);
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
        effect_preset: themeData.effect_preset || 'none',
        effect_intensity: themeData.effect_intensity || 'soft',
        background_style: themeData.background_style || 'solid',
        gradient_colors: Array.isArray(themeData.gradient_colors) ? themeData.gradient_colors : [],
        gradient_angle: Number.isFinite(Number(themeData.gradient_angle)) ? Number(themeData.gradient_angle) : 135,
        gradient_intensity: themeData.gradient_intensity || 'medium',
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
    if (themeData.effect_preset !== undefined) updates.effect_preset = themeData.effect_preset;
    if (themeData.effect_intensity !== undefined) updates.effect_intensity = themeData.effect_intensity;
    if (themeData.background_style !== undefined) updates.background_style = themeData.background_style;
    if (themeData.gradient_colors !== undefined) updates.gradient_colors = Array.isArray(themeData.gradient_colors) ? themeData.gradient_colors : [];
    if (themeData.gradient_angle !== undefined) updates.gradient_angle = Number(themeData.gradient_angle);
    if (themeData.gradient_intensity !== undefined) updates.gradient_intensity = themeData.gradient_intensity;

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

const acceptSharedResourceViaLegacyRoute = async (messageId) => {
    const token = getToken();

    if (!token || token === 'logged_in') {
        return authFetch(`/messages/${messageId}/accept-share`, {
            method: 'POST',
        });
    }

    const response = await fetch(`${getApiBase()}/messages/${messageId}/accept-share`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        signal: AbortSignal.timeout(10000),
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
        throw error;
    }

    return data;
};

export const acceptSharedResource = async (messageId) => {
    try {
        return await edgeFunctionFetch('accept-shared-resource', {
            method: 'POST',
            body: { messageId },
        });
    } catch (error) {
        if (error?.status === 404) {
            return acceptSharedResourceViaLegacyRoute(messageId);
        }
        throw error;
    }
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
    const baseTier = row.subscription_tier || 'free';
    const hasStripeBilling = Boolean(row.stripe_customer_id || row.stripe_subscription_id);
    let premiumAccessSource = 'free';

    if (role === 'owner' && !row.simulate_free_tier) {
        premiumAccessSource = 'owner_included';
    } else if (role === 'admin' && !row.simulate_free_tier) {
        premiumAccessSource = 'admin_included';
    } else if (role === 'friends') {
        premiumAccessSource = 'friends_included';
    } else if (baseTier === 'lifetime') {
        premiumAccessSource = 'lifetime';
    } else if (baseTier === 'supporter') {
        premiumAccessSource = 'subscription';
    }

    const effectiveTier = premiumAccessSource === 'subscription'
        ? 'supporter'
        : premiumAccessSource === 'free'
            ? 'free'
            : 'lifetime';
    const hasManageableSubscription = premiumAccessSource === 'subscription'
        && (Capacitor.isNativePlatform() || hasStripeBilling);

    const base = {
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
        base_subscription_tier: baseTier,
        subscription_tier: effectiveTier,
        stripe_customer_id: row.stripe_customer_id || null,
        stripe_subscription_id: row.stripe_subscription_id || null,
        premium_access_source: premiumAccessSource,
        has_manageable_subscription: hasManageableSubscription,
        simulate_free_tier: Boolean(row.simulate_free_tier),
        email_verified: Boolean(row.email_verified),
    };

    return {
        ...base,
        onboardingCompletedAt: row.onboarding_completed_at != null && row.onboarding_completed_at !== ''
            ? row.onboarding_completed_at
            : null,
        onboardingStep: Number(row.onboarding_step) || 0,
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

export const updateOnboardingProgress = async ({ nextStep, markComplete } = {}) => {
    const userId = await getAppUserId();
    const patch = {};
    if (typeof nextStep === 'number') patch.onboarding_step = nextStep;
    if (markComplete) patch.onboarding_completed_at = new Date().toISOString();
    if (!Object.keys(patch).length) {
        return mapOwnUserRow(await loadCurrentUserRow());
    }

    const { data, error } = await supabase
        .from('users')
        .update(patch)
        .eq('id', userId)
        .select(SELF_PROFILE_SELECT)
        .single();
    if (error) _sbThrow(error);
    return mapOwnUserRow(data);
};

export const syncRevenueCat = (overrides = {}) => edgeFunctionFetch('sync-revenuecat', { method: 'POST', body: overrides });

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

const mapMessageRow = (row, currentUser) => {
    const sharedResource = normalizeSharedPayload(parseJsonish(row.deck_data), row.message_type || 'text');

    return {
        id: row.id,
        senderId: row.sender_id,
        receiverId: row.receiver_id,
        senderUsername: row.sender_id === currentUser.id ? currentUser.username || null : null,
        senderAvatar: row.sender_id === currentUser.id ? currentUser.avatar || null : null,
        content: row.content,
        messageType: row.message_type || 'text',
        sharedResource,
        deckData: sharedResource,
        imageUrl: row.image_url || null,
        isEdited: Boolean(row.is_edited),
        isRead: Boolean(row.is_read),
        createdAt: row.created_at,
        isMine: row.sender_id === currentUser.id,
    };
};

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
    sharedData = null,
    imageUrl = null,
    currentUserOverride = null
) => {
    if (!receiverId) {
        const error = new Error('Receiver ID is required');
        error.status = 400;
        throw error;
    }
    if (!content && !imageUrl && !sharedData) {
        const error = new Error('Message content, image or shared resource is required');
        error.status = 400;
        throw error;
    }
    if (content && typeof content === 'string' && content.trim().length === 0 && !imageUrl && !sharedData) {
        const error = new Error('Message content cannot be empty');
        error.status = 400;
        throw error;
    }
    if (content && content.length > 5000) {
        const error = new Error('Message content must be under 5000 characters');
        error.status = 400;
        throw error;
    }

    const normalizedSharedData = sharedData && isSharedMessageType(messageType)
        ? serializeSharedPayload({
            kind: messageType,
            ...sharedData,
            sourceId: sharedData.sourceId ?? sharedData.id,
        })
        : null;

    if (isSharedMessageType(messageType) && !normalizedSharedData) {
        const error = new Error('Shared resource data is required');
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
            deck_data: normalizedSharedData ? JSON.stringify(normalizedSharedData) : null,
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

    channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            handlers.onSubscribed?.();
        }
    });
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

const normalizeDateValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString().slice(0, 10);
};

const normalizeTimestampValue = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
};

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

// Group scheduling hub
export const getGroupScheduleCalendar = async (groupId, rangeStart, rangeEnd) => {
    const data = await callGroupRpc('get_group_schedule_calendar', {
        target_group_id: groupId,
        range_start: normalizeDateValue(rangeStart),
        range_end: normalizeDateValue(rangeEnd),
    });

    return data || {
        members: [],
        schedule_slots: [],
        meetups: [],
    };
};

export const getGroupScheduleShare = async (groupId) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('group_schedule_shares')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .maybeSingle();

    if (error) _sbThrow(error);
    return data || null;
};

export const setGroupScheduleShare = async (groupId, visibilityMode) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('group_schedule_shares')
        .upsert({
            group_id: groupId,
            user_id: userId,
            visibility_mode: visibilityMode,
        })
        .select()
        .single();

    if (error) _sbThrow(error);
    return data;
};

export const createGroupMeetup = async (groupId, meetup) => {
    const data = await callGroupRpc('create_group_meetup', {
        target_group_id: groupId,
        target_topic: meetup?.topic,
        target_start_at: normalizeTimestampValue(meetup?.start_at),
        target_end_at: normalizeTimestampValue(meetup?.end_at),
        target_timezone: meetup?.timezone,
        target_location_label: meetup?.location_label ?? null,
        target_location_url: meetup?.location_url ?? null,
    });

    return data;
};

export const updateGroupMeetup = async (meetupId, updates) => {
    const normalizedUpdates = {
        ...updates,
    };

    if (Object.prototype.hasOwnProperty.call(updates ?? {}, 'start_at')) {
        normalizedUpdates.start_at = updates.start_at === null
            ? null
            : normalizeTimestampValue(updates.start_at);
    }

    if (Object.prototype.hasOwnProperty.call(updates ?? {}, 'end_at')) {
        normalizedUpdates.end_at = updates.end_at === null
            ? null
            : normalizeTimestampValue(updates.end_at);
    }

    const { data, error } = await supabase
        .from('group_meetups')
        .update(normalizedUpdates)
        .eq('id', meetupId)
        .select()
        .single();

    if (error) _sbThrow(error);
    return data;
};

export const cancelGroupMeetup = async (meetupId) => {
    const data = await callGroupRpc('cancel_group_meetup', {
        target_meetup_id: meetupId,
    });
    return data;
};

export const joinGroupMeetup = async (meetupId) => {
    const data = await callGroupRpc('join_group_meetup', {
        target_meetup_id: meetupId,
    });
    return data;
};

export const leaveGroupMeetup = async (meetupId) => {
    const data = await callGroupRpc('leave_group_meetup', {
        target_meetup_id: meetupId,
    });
    return data;
};

export const listJoinedGroupMeetups = async (rangeStart = null, rangeEnd = null) => safeFetchArray((async () => {
    const data = await callGroupRpc('list_joined_group_meetups', {
        range_start: normalizeTimestampValue(rangeStart),
        range_end: normalizeTimestampValue(rangeEnd),
    });

    return data || [];
})());

export const subscribeToGroupMeetupEvents = (groupId, handlers = {}) => {
    const channel = supabase
        .channel(`group_meetups_${groupId}`)
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'group_meetups',
            filter: `group_id=eq.${groupId}`,
        }, (payload) => {
            if (payload?.eventType === 'INSERT') {
                handlers.onMeetupCreated?.(payload.new, payload);
            }

            if (payload?.eventType === 'UPDATE') {
                handlers.onMeetupUpdated?.(payload.new, payload.old, payload);
            }

            if (payload?.eventType === 'DELETE') {
                handlers.onMeetupDeleted?.(payload.old, payload);
            }

            handlers.onChanged?.(payload);
        })
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'group_meetup_attendees',
            filter: `group_id=eq.${groupId}`,
        }, (payload) => {
            handlers.onAttendanceChanged?.(payload);
            handlers.onChanged?.(payload);
        });

    channel.subscribe();
    return () => supabase.removeChannel(channel);
};

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

// ============ GROUP CHAT ============

const mapGroupMessageRow = (row, currentUserId) => ({
    id: row.id,
    groupId: row.group_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username || null,
    senderAvatar: row.sender_avatar || null,
    content: row.content,
    isEdited: Boolean(row.is_edited),
    createdAt: row.created_at,
    isMine: Number(row.sender_id) === Number(currentUserId),
});

const sortGroupMessagesChronologically = (messages = []) => (
    [...messages].sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        if (leftTime !== rightTime) return leftTime - rightTime;
        return String(left.id).localeCompare(String(right.id));
    })
);

export const getGroupMessages = async (groupId, { before, limit = 50 } = {}) => {
    const currentUserId = await getAppUserId();
    const data = await callGroupRpc('list_group_messages', {
        target_group_id: groupId,
        before_id: before || null,
        page_limit: Math.min(limit, 100),
    });
    return sortGroupMessagesChronologically((data || []).map((row) => mapGroupMessageRow(row, currentUserId)));
};

export const sendGroupMessage = async (groupId, content) => {
    const currentUserId = await getAppUserId();
    const { data, error } = await supabase
        .from('group_messages')
        .insert({ group_id: groupId, sender_id: currentUserId, content: content.trim() })
        .select()
        .single();
    if (error) _sbThrow(error);
    return mapGroupMessageRow(
        { ...data, sender_username: null, sender_avatar: null },
        currentUserId
    );
};

export const editGroupMessage = async (groupId, messageId, content) => {
    const currentUserId = await getAppUserId();
    const { data, error } = await supabase
        .from('group_messages')
        .update({ content: content.trim(), is_edited: true, updated_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('group_id', groupId)
        .eq('sender_id', currentUserId)
        .select()
        .single();
    if (error) _sbThrow(error);
    return mapGroupMessageRow(
        { ...data, sender_username: null, sender_avatar: null },
        currentUserId
    );
};

export const deleteGroupMessage = async (groupId, messageId) => {
    const currentUserId = await getAppUserId();
    const { error } = await supabase
        .from('group_messages')
        .delete()
        .eq('id', messageId)
        .eq('group_id', groupId)
        .eq('sender_id', currentUserId);
    if (error) _sbThrow(error);
};

export const subscribeToGroupMessages = (groupId, currentUserId, handlers = {}) => {
    const channel = supabase
        .channel(`group_messages_${groupId}`)
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${groupId}`,
        }, (payload) => {
            handlers.onInsert?.(mapGroupMessageRow(
                { ...payload.new, sender_username: null, sender_avatar: null },
                currentUserId
            ));
        })
        .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${groupId}`,
        }, (payload) => {
            handlers.onUpdate?.(mapGroupMessageRow(
                { ...payload.new, sender_username: null, sender_avatar: null },
                currentUserId
            ));
        })
        .on('postgres_changes', {
            event: 'DELETE',
            schema: 'public',
            table: 'group_messages',
            filter: `group_id=eq.${groupId}`,
        }, (payload) => {
            handlers.onDelete?.(payload.old.id);
        });

    channel.subscribe();
    return () => supabase.removeChannel(channel);
};

export const subscribeToGroupTypingPresence = (groupId, currentUserId, handlers = {}) => {
    const normalizedCurrentUserId = Number(currentUserId);

    if (!groupId || !Number.isInteger(normalizedCurrentUserId)) {
        return {
            startTyping: () => Promise.resolve(),
            stopTyping: () => Promise.resolve(),
            unsubscribe: () => {},
        };
    }

    const channel = supabase.channel(`group_typing_${groupId}`, {
        config: {
            presence: {
                key: `user-${normalizedCurrentUserId}`,
            },
        },
    });

    const syncTypingState = () => {
        const state = channel.presenceState?.() || {};
        const typingUserIds = [...new Set(
            Object.values(state)
                .flat()
                .filter((presence) => (
                    Number(presence?.userId) !== normalizedCurrentUserId
                    && presence?.isTyping === true
                ))
                .map((presence) => Number(presence.userId))
                .filter(Number.isInteger)
        )];

        handlers.onTypingUsersChange?.(typingUserIds);
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

export const adminGetFeedback = async () => {
    const data = await callAdminEndpoint({
        method: 'GET',
        action: 'feedback',
    });
    if (!Array.isArray(data)) {
        throw new Error('Unexpected admin feedback payload');
    }
    return data;
};
export const adminToggleFeedbackFavorite = (feedbackId, isFavorited) => callAdminEndpoint({
    method: 'PUT',
    action: 'feedback-favorite',
    body: { feedbackId, isFavorited },
});
export const adminDeleteFeedback = (feedbackId) => callAdminEndpoint({
    method: 'DELETE',
    action: 'feedback-delete',
    body: { feedbackId },
});
export const adminThankFeedback = (feedbackId) => callAdminEndpoint({
    method: 'POST',
    action: 'feedback-thank',
    body: { feedbackId },
});

export const submitFeedback = async (content) => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('feedback_submissions')
        .insert({
            user_id: userId,
            content,
        })
        .select('id, user_id, content, is_favorited, considering_notified_at, considering_notified_by, created_at')
        .single();

    if (error) _sbThrow(error);

    return {
        id: Number(data.id),
        userId: Number(data.user_id),
        content: String(data.content ?? ''),
        isFavorited: Boolean(data.is_favorited),
        consideringNotifiedAt: data.considering_notified_at ?? null,
        consideringNotifiedBy: data.considering_notified_by ?? null,
        createdAt: data.created_at ?? null,
    };
};

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

export const getUserNotifications = async () => safeFetchArray((async () => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('user_notifications')
        .select('id, user_id, kind, title, content, metadata, created_at, dismissed_at')
        .eq('user_id', userId)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false });

    if (error) _sbThrow(error);

    return (data || []).map((notification) => ({
        id: Number(notification.id),
        userId: Number(notification.user_id),
        kind: String(notification.kind ?? 'info'),
        title: String(notification.title ?? ''),
        content: String(notification.content ?? ''),
        metadata: notification.metadata && typeof notification.metadata === 'object' ? notification.metadata : {},
        createdAt: notification.created_at ?? null,
        dismissedAt: notification.dismissed_at ?? null,
    }));
})());

export const dismissUserNotification = async (id) => {
    const userId = await getAppUserId();
    const { error } = await supabase
        .from('user_notifications')
        .update({
            dismissed_at: new Date().toISOString(),
        })
        .eq('id', Number(id))
        .eq('user_id', userId)
        .is('dismissed_at', null);

    if (error) _sbThrow(error);
    return { message: 'Notification dismissed' };
};

export const getPushPreferences = async () => {
    const userId = await getAppUserId();
    const { data, error } = await supabase
        .from('user_push_preferences')
        .select('messages_enabled, streak_enabled, reengagement_enabled')
        .eq('user_id', userId)
        .maybeSingle();

    if (error && error.code !== 'PGRST116') _sbThrow(error);
    return normalizePushPreferences(data);
};

export const updatePushPreferences = async (preferences) => {
    const userId = await getAppUserId();
    const normalized = normalizePushPreferences(preferences);
    const { data, error } = await supabase
        .from('user_push_preferences')
        .upsert({
            user_id: userId,
            messages_enabled: normalized.messagesEnabled,
            streak_enabled: normalized.streakEnabled,
            reengagement_enabled: normalized.reengagementEnabled,
        }, {
            onConflict: 'user_id',
        })
        .select('messages_enabled, streak_enabled, reengagement_enabled')
        .single();

    if (error) _sbThrow(error);
    return normalizePushPreferences(data);
};

export const upsertPushDevice = async ({
    installationId,
    platform = 'ios',
    pushToken,
}) => {
    const normalizedInstallationId = String(installationId || '').trim();
    const normalizedPlatform = String(platform || '').trim().toLowerCase() || 'ios';
    const normalizedPushToken = String(pushToken || '').trim();

    if (!normalizedInstallationId) {
        throw new Error('installationId is required');
    }

    if (!normalizedPushToken) {
        throw new Error('pushToken is required');
    }

    const { error } = await supabase.rpc('upsert_user_push_device', {
        installation_id_param: normalizedInstallationId,
        platform_param: normalizedPlatform,
        push_token_param: normalizedPushToken,
    });

    if (error) _sbThrow(error);
    return { message: 'Push device registered' };
};

export const deactivatePushDevice = async (installationId) => {
    const normalizedInstallationId = String(installationId || '').trim();
    if (!normalizedInstallationId) {
        return { message: 'No push installation to deactivate' };
    }

    const { error } = await supabase.rpc('deactivate_user_push_device', {
        installation_id_param: normalizedInstallationId,
    });

    if (error) _sbThrow(error);
    return { message: 'Push device deactivated' };
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

export const login2FA = async (challengeOrTempToken, token, options = {}) => {
    applyAuthPersistenceOption(options);

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
    edgeFunctionFetch('forgot-password', { method: 'POST', body: { email }, skipForceReauth: true });

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
        skipForceReauth: true,
    });
};

// ============ HEARTS API ============
export const getHeartsStatus = () =>
    edgeFunctionFetch('hearts', { method: 'POST', body: { action: 'status' } });

export const getSessionHearts = (deckId) =>
    edgeFunctionFetch('hearts', { method: 'POST', body: { action: 'session', deckId } });

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

// ============ STRIPE API ============
export const createStripeCheckoutSession = ({ priceId, isSubscription }) =>
    edgeFunctionFetch('create-checkout', { method: 'POST', body: { priceId, isSubscription } });

export const createStripePortalSession = () =>
    edgeFunctionFetch('create-portal', { method: 'POST' });
