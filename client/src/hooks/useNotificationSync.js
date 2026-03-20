import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { api } from '../api';
import { scheduleAssignmentNotifications } from '../utils/notifications';

export function useNotificationSync() {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const sync = async () => {
            try {
                const assignments = await api.getAssignments();
                const saved = localStorage.getItem('notifications_enabled');
                const notificationsEnabled = saved === null ? true : saved === 'true';
                await scheduleAssignmentNotifications(assignments, notificationsEnabled);
            } catch (error) {
                console.error('Failed to sync notifications on app state change', error);
            }
        };

        const handleStateChange = (state) => {
            if (state.isActive) {
                sync();
            }
        };

        const listener = App.addListener('appStateChange', handleStateChange);
        
        // Initial sync
        sync();

        return () => {
            listener.then(l => l.remove());
        };
    }, []);
}
