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
});
