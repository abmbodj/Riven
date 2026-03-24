import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    capacitorState,
    checkPermissionsMock,
    requestPermissionsMock,
    registerMock,
} = vi.hoisted(() => ({
    capacitorState: {
        native: true,
        platform: 'ios',
    },
    checkPermissionsMock: vi.fn(),
    requestPermissionsMock: vi.fn(),
    registerMock: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
    Capacitor: {
        isNativePlatform: () => capacitorState.native,
        getPlatform: () => capacitorState.platform,
    },
}));

vi.mock('@capacitor/push-notifications', () => ({
    PushNotifications: {
        checkPermissions: checkPermissionsMock,
        requestPermissions: requestPermissionsMock,
        register: registerMock,
    },
}));

import {
    checkPushPermissions,
    consumePendingPushRoute,
    extractPushRouteFromData,
    extractPushRouteFromNotification,
    getOrCreatePushInstallationId,
    getStoredPushInstallationId,
    requestPushPermissions,
    storePendingPushRoute,
} from './pushNotifications.js';

describe('pushNotifications utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        capacitorState.native = true;
        capacitorState.platform = 'ios';
        checkPermissionsMock.mockResolvedValue({ receive: 'prompt' });
        requestPermissionsMock.mockResolvedValue({ receive: 'granted' });
        registerMock.mockResolvedValue(undefined);
    });

    it('creates and reuses a stable installation id', () => {
        const first = getOrCreatePushInstallationId();
        const second = getOrCreatePushInstallationId();

        expect(first).toBeTruthy();
        expect(second).toBe(first);
        expect(getStoredPushInstallationId()).toBe(first);
    });

    it('requests push permissions only when needed', async () => {
        const granted = await requestPushPermissions();

        expect(checkPermissionsMock).toHaveBeenCalledTimes(1);
        expect(requestPermissionsMock).toHaveBeenCalledTimes(1);
        expect(granted).toBe(true);
    });

    it('reads push permission status without prompting', async () => {
        checkPermissionsMock.mockResolvedValue({ receive: 'granted' });

        await expect(checkPushPermissions()).resolves.toBe(true);
        expect(requestPermissionsMock).not.toHaveBeenCalled();
    });

    it('extracts a valid route from explicit notification data', () => {
        expect(extractPushRouteFromData({ route: '/garden' })).toBe('/garden');
        expect(extractPushRouteFromData({ route: '/messages/not-valid' })).toBe(null);
        expect(extractPushRouteFromData({ kind: 'message', senderId: 42 })).toBe('/messages/42');
    });

    it('stores and consumes pending push routes safely', () => {
        storePendingPushRoute('/dashboard');

        expect(consumePendingPushRoute()).toBe('/dashboard');
        expect(consumePendingPushRoute()).toBe(null);
    });

    it('extracts routes from Capacitor notification action payloads', () => {
        expect(extractPushRouteFromNotification({
            notification: {
                data: {
                    kind: 'message',
                    senderId: '12',
                },
            },
        })).toBe('/messages/12');
    });
});
