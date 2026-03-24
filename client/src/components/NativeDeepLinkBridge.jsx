import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { consumePendingPushRoute } from '../utils/pushNotifications.js';

export function getNoteRouteFromUrl(url) {
    if (!url) return null;

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'riven:') {
            return null;
        }

        let noteId = null;

        if (parsed.hostname === 'note') {
            noteId = parsed.pathname.split('/').filter(Boolean)[0] || null;
        } else {
            const segments = parsed.pathname.split('/').filter(Boolean);
            if (segments[0] === 'note') {
                noteId = segments[1] || null;
            }
        }

        return noteId ? `/note/${decodeURIComponent(noteId)}` : null;
    } catch {
        return null;
    }
}

export function NativeDeepLinkBridge() {
    const navigate = useNavigate();
    const { isLoggedIn, loading } = useAuth();

    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return undefined;

        let disposed = false;

        const navigateToUrl = (url) => {
            const route = getNoteRouteFromUrl(url);
            if (route) {
                navigate(route, { replace: true });
            }
        };

        const listener = App.addListener('appUrlOpen', ({ url }) => {
            if (!disposed) {
                navigateToUrl(url);
            }
        });

        App.getLaunchUrl()
            .then((launchUrl) => {
                if (!disposed && launchUrl?.url) {
                    navigateToUrl(launchUrl.url);
                }
            })
            .catch(() => {
                // Ignore launch URL lookup failures.
            });

        return () => {
            disposed = true;
            listener.then((subscription) => subscription.remove());
        };
    }, [navigate]);

    useEffect(() => {
        if (loading || !isLoggedIn) return;

        const pendingRoute = consumePendingPushRoute();
        if (pendingRoute) {
            navigate(pendingRoute, { replace: true });
        }
    }, [isLoggedIn, loading, navigate]);

    return null;
}

export default NativeDeepLinkBridge;
