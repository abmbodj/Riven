/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
const originalSessionStorage = Object.getOwnPropertyDescriptor(window, 'sessionStorage');

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => false,
    },
}));

vi.mock('../lib/supabaseClient', () => ({
    supabase: {
        auth: {
            signOut: vi.fn().mockResolvedValue({ error: null }),
        },
    },
}));

function installThrowingStorage() {
    const throwSecurityError = () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
    };

    Object.defineProperty(window, 'localStorage', {
        configurable: true,
        get: throwSecurityError,
    });

    Object.defineProperty(window, 'sessionStorage', {
        configurable: true,
        get: throwSecurityError,
    });
}

function restoreStorage() {
    Object.defineProperty(window, 'localStorage', originalLocalStorage);
    Object.defineProperty(window, 'sessionStorage', originalSessionStorage);
}

describe('authApi storage safety', () => {
    beforeEach(() => {
        vi.resetModules();
        restoreStorage();
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        restoreStorage();
    });

    it('falls back to memory storage when browser storage access is blocked', async () => {
        installThrowingStorage();

        const authApi = await import('./authApi');

        authApi.setToken('memory-token');
        expect(authApi.getToken()).toBe('memory-token');

        authApi.setToken(null);
        expect(authApi.getToken()).toBeNull();
    });

    it('stores tokens durably when keep-signed-in is enabled', async () => {
        const authApi = await import('./authApi');
        const { setAuthPersistenceMode } = await import('../lib/authPersistence');

        setAuthPersistenceMode(true);
        authApi.setToken('durable-token');

        expect(localStorage.getItem('riven_auth_token')).toBe('durable-token');
        expect(sessionStorage.getItem('riven_auth_token')).toBeNull();
    });

    it('stores tokens in session storage when keep-signed-in is disabled', async () => {
        const authApi = await import('./authApi');
        const { setAuthPersistenceMode } = await import('../lib/authPersistence');

        setAuthPersistenceMode(false);
        authApi.setToken('session-token');

        expect(sessionStorage.getItem('riven_auth_token')).toBe('session-token');
        expect(localStorage.getItem('riven_auth_token')).toBeNull();
    });

    it('clears tokens from durable and session storage together', async () => {
        const authApi = await import('./authApi');

        localStorage.setItem('riven_auth_token', 'durable-token');
        sessionStorage.setItem('riven_auth_token', 'session-token');
        localStorage.setItem('riven_google_oauth_bridge_token', 'durable-google-token');
        sessionStorage.setItem('riven_google_oauth_bridge_token', 'session-google-token');

        authApi.setToken(null);

        expect(localStorage.getItem('riven_auth_token')).toBeNull();
        expect(sessionStorage.getItem('riven_auth_token')).toBeNull();
        expect(localStorage.getItem('riven_google_oauth_bridge_token')).toBeNull();
        expect(sessionStorage.getItem('riven_google_oauth_bridge_token')).toBeNull();
    });
});
