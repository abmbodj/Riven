// Pure, dependency-free helpers extracted from authApi.js (RIV-025, step 1).
// These have no coupling to the shared auth/token/csrf state, so they are safe to live
// on their own. The remaining domain split is tracked in docs/reviews/2026-06-remediation.md.

export const DEFAULT_PUSH_PREFERENCES = Object.freeze({
    messagesEnabled: true,
    streakEnabled: true,
    reengagementEnabled: true,
});

export const normalizePushPreferenceFlag = (value, fallback) => {
    if (typeof value === 'boolean') return value;
    if (value == null) return fallback;
    return Boolean(value);
};

export const normalizePushPreferences = (value) => ({
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

export const decodeJwtPayload = (token) => {
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

export const isSupabaseAccessToken = (token) => {
    if (!token || token === 'logged_in') return false;
    const payload = decodeJwtPayload(token);
    if (!payload) return false;

    const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    return audience.includes('authenticated') && typeof payload.sub === 'string' && payload.sub.length > 0;
};

export const isJwtExpired = (token) => {
    const payload = decodeJwtPayload(token);
    if (!payload || typeof payload.exp !== 'number') return false;
    const nowInSeconds = Math.floor(Date.now() / 1000);
    return payload.exp <= nowInSeconds;
};
