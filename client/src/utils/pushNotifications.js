import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const INSTALLATION_ID_KEY = 'riven_push_installation_id';
const PENDING_ROUTE_KEY = 'riven_push_pending_route';
const ALLOWED_PUSH_ROUTE_PATTERNS = [
    /^\/dashboard$/,
    /^\/garden$/,
    /^\/messages\/\d+$/,
];

const getSafeStorage = () => {
    if (typeof window === 'undefined') return null;

    try {
        return window.localStorage;
    } catch {
        return null;
    }
};

const normalizePushRoute = (route) => {
    const normalized = String(route || '').trim();
    if (!normalized) return null;

    return ALLOWED_PUSH_ROUTE_PATTERNS.some((pattern) => pattern.test(normalized))
        ? normalized
        : null;
};

export const isNativeIos = () => (
    Capacitor.isNativePlatform()
    && typeof Capacitor.getPlatform === 'function'
    && Capacitor.getPlatform() === 'ios'
);

export const getStoredPushInstallationId = () => {
    const storage = getSafeStorage();
    return storage?.getItem(INSTALLATION_ID_KEY) || null;
};

export const getOrCreatePushInstallationId = () => {
    const existing = getStoredPushInstallationId();
    if (existing) return existing;

    const storage = getSafeStorage();
    if (!storage) return null;

    const nextId = typeof crypto?.randomUUID === 'function'
        ? crypto.randomUUID()
        : `push-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    storage.setItem(INSTALLATION_ID_KEY, nextId);
    return nextId;
};

export async function requestPushPermissions() {
    if (!isNativeIos()) return false;

    try {
        const current = await PushNotifications.checkPermissions();
        if (current.receive === 'granted') return true;

        const next = await PushNotifications.requestPermissions();
        return next.receive === 'granted';
    } catch (error) {
        console.error('Error requesting push notification permissions:', error);
        return false;
    }
}

export async function checkPushPermissions() {
    if (!isNativeIos()) return false;

    try {
        const result = await PushNotifications.checkPermissions();
        return result.receive === 'granted';
    } catch {
        return false;
    }
}

export async function registerPushNotifications() {
    if (!isNativeIos()) return false;

    try {
        await PushNotifications.register();
        return true;
    } catch (error) {
        console.error('Error registering for push notifications:', error);
        return false;
    }
}

export const extractPushRouteFromData = (data) => {
    const directRoute = normalizePushRoute(data?.route);
    if (directRoute) return directRoute;

    if (String(data?.kind || '').trim() === 'message') {
        const senderId = Number(data?.senderId ?? data?.sender_id);
        if (Number.isInteger(senderId) && senderId > 0) {
            return `/messages/${senderId}`;
        }
    }

    return null;
};

export const extractPushRouteFromNotification = (notification) => (
    extractPushRouteFromData(notification?.notification?.data || notification?.data || {})
);

export const storePendingPushRoute = (route) => {
    const normalized = normalizePushRoute(route);
    if (!normalized) return null;

    const storage = getSafeStorage();
    storage?.setItem(PENDING_ROUTE_KEY, normalized);
    return normalized;
};

export const consumePendingPushRoute = () => {
    const storage = getSafeStorage();
    if (!storage) return null;

    const route = normalizePushRoute(storage.getItem(PENDING_ROUTE_KEY));
    storage.removeItem(PENDING_ROUTE_KEY);
    return route;
};
