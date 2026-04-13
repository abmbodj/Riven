import { useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { api } from '../api';
import {
    scheduleAssignmentNotifications,
    scheduleMeetupNotifications,
} from '../utils/notifications';

export function useNotificationSync() {
    useEffect(() => {
        if (!Capacitor.isNativePlatform()) return;

        const sync = async () => {
            try {
                const [assignments, meetups] = await Promise.all([
                    api.getAssignments(),
                    api.listJoinedGroupMeetups(new Date(), new Date(Date.now() + (30 * 24 * 60 * 60 * 1000))),
                ]);
                const saved = localStorage.getItem('notifications_enabled');
                const notificationsEnabled = saved === null ? true : saved === 'true';
                await Promise.all([
                    scheduleAssignmentNotifications(assignments, notificationsEnabled),
                    scheduleMeetupNotifications(meetups, notificationsEnabled),
                ]);
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
