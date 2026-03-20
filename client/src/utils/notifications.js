import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export async function requestNotificationPermissions() {
    if (!Capacitor.isNativePlatform()) return false;
    
    try {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
    } catch (error) {
        console.error('Error requesting notification permissions:', error);
        return false;
    }
}

export async function checkNotificationPermissions() {
    if (!Capacitor.isNativePlatform()) return false;
    
    try {
        const result = await LocalNotifications.checkPermissions();
        return result.display === 'granted';
    } catch (error) {
        return false;
    }
}

export async function scheduleAssignmentNotifications(assignments, notificationsEnabled) {
    if (!Capacitor.isNativePlatform() || !notificationsEnabled) {
        // Cancel all if not enabled or not native
        if (Capacitor.isNativePlatform()) {
            try {
                const pending = await LocalNotifications.getPending();
                if (pending.notifications.length > 0) {
                    await LocalNotifications.cancel({ notifications: pending.notifications });
                }
            } catch (e) {
                console.error('Failed to cancel notifications', e);
            }
        }
        return;
    }

    try {
        const hasPermission = await checkNotificationPermissions();
        if (!hasPermission) return;

        // First, get all pending assignment notifications to cancel them and reschedule
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
            await LocalNotifications.cancel({ notifications: pending.notifications });
        }

        const now = new Date();
        const notificationsToSchedule = [];
        let idCounter = 1;

        // Keep track of assignments we process to avoid overflowing if there are many
        const futureAssignments = assignments.filter(assignment => {
            if (assignment.status === 'Done' || assignment.status === 'Archived' || !assignment.due_date) return false;
            const dueDate = new Date(assignment.due_date);
            return !Number.isNaN(dueDate.getTime()) && dueDate > now;
        });

        for (const assignment of futureAssignments) {
            const dueDate = new Date(assignment.due_date);
            const title = assignment.title || assignment.name || assignment.assignment_title || 'Untitled Assignment';

            // Schedule for 24 hours before
            const hours24Before = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
            if (hours24Before > now) {
                notificationsToSchedule.push({
                    id: idCounter++,
                    title: 'Upcoming Assignment',
                    body: `${title} is due tomorrow.`,
                    schedule: { at: hours24Before },
                    smallIcon: 'ic_stat_icon_config_sample',
                    iconColor: '#488AFF'
                });
            }

            // Schedule for 3 hours before
            const hours3Before = new Date(dueDate.getTime() - 3 * 60 * 60 * 1000);
            if (hours3Before > now) {
                notificationsToSchedule.push({
                    id: idCounter++,
                    title: 'Assignment Due Soon',
                    body: `${title} is due in 3 hours!`,
                    schedule: { at: hours3Before },
                    smallIcon: 'ic_stat_icon_config_sample',
                    iconColor: '#FF3B30'
                });
            }
            
            // Limit to 50 active localized notifications to be safe with iOS bounds
            if (notificationsToSchedule.length >= 50) break;
        }

        if (notificationsToSchedule.length > 0) {
            await LocalNotifications.schedule({
                notifications: notificationsToSchedule
            });
        }
    } catch (error) {
        console.error('Error scheduling notifications:', error);
    }
}
