import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { useNavigate } from 'react-router-dom';
import { useAuthStatus } from '../hooks/useAuth';
import * as authApi from '../api/authApi';
import {
    extractPushRouteFromNotification,
    getOrCreatePushInstallationId,
    getStoredPushInstallationId,
    isNativeIos,
    registerPushNotifications,
    requestPushPermissions,
    storePendingPushRoute,
} from '../utils/pushNotifications.js';

export default function PushNotificationBridge() {
    const navigate = useNavigate();
    const { isLoggedIn, loading } = useAuthStatus();
    const authStateRef = useRef({ isLoggedIn, loading });
    const latestTokenRef = useRef(null);
    const syncPromiseRef = useRef(null);

    useEffect(() => {
        authStateRef.current = { isLoggedIn, loading };
    }, [isLoggedIn, loading]);

    useEffect(() => {
        if (!isNativeIos()) return undefined;

        const syncRegistration = async () => {
            const currentAuthState = authStateRef.current;
            if (currentAuthState.loading || !currentAuthState.isLoggedIn) {
                return;
            }

            if (syncPromiseRef.current) {
                await syncPromiseRef.current;
                return;
            }

            syncPromiseRef.current = (async () => {
                const installationId = getStoredPushInstallationId();
                const hasPermission = await requestPushPermissions();

                if (!hasPermission) {
                    if (installationId) {
                        await authApi.deactivatePushDevice(installationId).catch(() => {});
                    }
                    return;
                }

                await registerPushNotifications();

                if (latestTokenRef.current) {
                    await authApi.upsertPushDevice({
                        installationId: getOrCreatePushInstallationId(),
                        platform: 'ios',
                        pushToken: latestTokenRef.current,
                    }).catch((error) => {
                        console.warn('[PushNotificationBridge] Failed to upsert device registration:', error);
                    });
                }
            })().finally(() => {
                syncPromiseRef.current = null;
            });

            await syncPromiseRef.current;
        };

        const listenerHandles = [
            PushNotifications.addListener('registration', (token) => {
                latestTokenRef.current = token?.value || null;

                if (!authStateRef.current.loading && authStateRef.current.isLoggedIn && latestTokenRef.current) {
                    void authApi.upsertPushDevice({
                        installationId: getOrCreatePushInstallationId(),
                        platform: 'ios',
                        pushToken: latestTokenRef.current,
                    }).catch((error) => {
                        console.warn('[PushNotificationBridge] Failed to save push token:', error);
                    });
                }
            }),
            PushNotifications.addListener('registrationError', (error) => {
                console.error('[PushNotificationBridge] Registration error:', error);
            }),
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                const route = extractPushRouteFromNotification(notification);
                if (!route) return;

                if (!authStateRef.current.loading && authStateRef.current.isLoggedIn) {
                    navigate(route, { replace: true });
                    return;
                }

                storePendingPushRoute(route);
            }),
            App.addListener('appStateChange', ({ isActive }) => {
                if (isActive) {
                    void syncRegistration();
                }
            }),
        ];

        void syncRegistration();

        return () => {
            listenerHandles.forEach((handlePromise) => {
                handlePromise
                    .then((handle) => handle.remove())
                    .catch(() => {});
            });
        };
    }, [navigate]);

    useEffect(() => {
        if (!isNativeIos() || loading || !isLoggedIn) return;

        const syncLoggedInRegistration = async () => {
            const hasPermission = await requestPushPermissions();
            if (!hasPermission) {
                const installationId = getStoredPushInstallationId();
                if (installationId) {
                    await authApi.deactivatePushDevice(installationId).catch(() => {});
                }
                return;
            }

            if (latestTokenRef.current) {
                await authApi.upsertPushDevice({
                    installationId: getOrCreatePushInstallationId(),
                    platform: 'ios',
                    pushToken: latestTokenRef.current,
                }).catch((error) => {
                    console.warn('[PushNotificationBridge] Failed to refresh active device heartbeat:', error);
                });
                return;
            }

            await registerPushNotifications();
        };

        void syncLoggedInRegistration();
    }, [isLoggedIn, loading]);

    return null;
}
