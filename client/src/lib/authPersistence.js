import { Capacitor } from '@capacitor/core';

export const AUTH_PERSISTENCE_KEY = 'riven_auth_persistence';
export const AUTH_PERSISTENCE_LOCAL = 'local';
export const AUTH_PERSISTENCE_SESSION = 'session';

const memoryStore = (() => {
    const store = new Map();
    return {
        getItem(key) {
            return store.has(key) ? store.get(key) : null;
        },
        setItem(key, value) {
            store.set(key, String(value));
        },
        removeItem(key) {
            store.delete(key);
        },
    };
})();

export const getSafeStorage = (kind) => {
    if (typeof window === 'undefined') return null;

    try {
        const storage = window[kind];
        const probeKey = '__riven_storage_probe__';
        storage.getItem(probeKey);
        return storage;
    } catch {
        return null;
    }
};

const getNamedStorage = (mode) => {
    if (mode === AUTH_PERSISTENCE_LOCAL) return getSafeStorage('localStorage');
    if (mode === AUTH_PERSISTENCE_SESSION) return getSafeStorage('sessionStorage');
    return null;
};

export const getAuthPersistenceMode = () => {
    const localValue = getSafeStorage('localStorage')?.getItem(AUTH_PERSISTENCE_KEY);
    if (localValue === AUTH_PERSISTENCE_LOCAL || localValue === AUTH_PERSISTENCE_SESSION) {
        return localValue;
    }

    const sessionValue = getSafeStorage('sessionStorage')?.getItem(AUTH_PERSISTENCE_KEY);
    if (sessionValue === AUTH_PERSISTENCE_LOCAL || sessionValue === AUTH_PERSISTENCE_SESSION) {
        return sessionValue;
    }

    return null;
};

export const setAuthPersistenceMode = (keepSignedIn) => {
    if (typeof keepSignedIn !== 'boolean') return;

    const localStorage = getSafeStorage('localStorage');
    const sessionStorage = getSafeStorage('sessionStorage');

    if (keepSignedIn) {
        localStorage?.setItem(AUTH_PERSISTENCE_KEY, AUTH_PERSISTENCE_LOCAL);
        sessionStorage?.removeItem(AUTH_PERSISTENCE_KEY);
    } else {
        sessionStorage?.setItem(AUTH_PERSISTENCE_KEY, AUTH_PERSISTENCE_SESSION);
        localStorage?.removeItem(AUTH_PERSISTENCE_KEY);
    }
};

export const getAuthStorage = ({ defaultMode = AUTH_PERSISTENCE_SESSION } = {}) => {
    const mode = getAuthPersistenceMode() || defaultMode;
    return getNamedStorage(mode) || memoryStore;
};

export const getRivenTokenStorage = () => getAuthStorage({
    defaultMode: Capacitor.isNativePlatform() ? AUTH_PERSISTENCE_LOCAL : AUTH_PERSISTENCE_SESSION,
});

export const forEachAuthStorage = (callback) => {
    const storages = [
        getRivenTokenStorage(),
        getSafeStorage('localStorage'),
        getSafeStorage('sessionStorage'),
        memoryStore,
    ].filter(Boolean);

    const seen = new Set();
    storages.forEach((storage) => {
        if (seen.has(storage)) return;
        seen.add(storage);
        callback(storage);
    });
};

export const supabaseAuthStorage = {
    getItem(key) {
        const preferred = getAuthStorage({ defaultMode: AUTH_PERSISTENCE_LOCAL });
        const value = preferred.getItem(key);
        if (value != null) return value;

        let fallbackValue = null;
        forEachAuthStorage((storage) => {
            if (fallbackValue != null || storage === preferred) return;
            fallbackValue = storage.getItem(key);
        });
        return fallbackValue;
    },
    setItem(key, value) {
        getAuthStorage({ defaultMode: AUTH_PERSISTENCE_LOCAL }).setItem(key, value);
    },
    removeItem(key) {
        forEachAuthStorage((storage) => storage.removeItem(key));
    },
};
