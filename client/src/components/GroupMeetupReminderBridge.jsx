import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import * as authApi from '../api/authApi';

const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;
const REMINDER_WINDOW_IN_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_TIMEOUT_IN_MS = 2_147_483_647;

const REMINDER_VARIANTS = [
    {
        key: 'soon',
        leadTimeMs: THIRTY_MINUTES_IN_MS,
        label: 'starts in 30 min',
    },
    {
        key: 'now',
        leadTimeMs: 0,
        label: 'is starting now',
    },
];

function formatMeetupTime(value) {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return 'soon';

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function buildReminderToast(meetup, variant) {
    const pieces = [
        meetup?.group_name || 'Study Group',
        variant.label,
        meetup?.topic || 'Study session',
        formatMeetupTime(meetup?.start_at),
    ];

    if (meetup?.location_label) {
        pieces.push(meetup.location_label);
    }

    return pieces.join(' · ');
}

function buildNewMeetupToast(groupName, meetup) {
    const pieces = [
        `New session in ${groupName}`,
        meetup?.topic || 'Study session',
        formatMeetupTime(meetup?.start_at),
    ];

    if (meetup?.location_label) {
        pieces.push(meetup.location_label);
    }

    return pieces.join(' · ');
}

export default function GroupMeetupReminderBridge() {
    const { isLoggedIn, loading, user } = useAuth();
    const toast = useToast();
    const timeoutIdsRef = useRef([]);
    const subscriptionsRef = useRef([]);
    const firedReminderKeysRef = useRef(new Set());

    const clearTimeouts = useCallback(() => {
        timeoutIdsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
        timeoutIdsRef.current = [];
    }, []);

    const clearSubscriptions = useCallback(() => {
        subscriptionsRef.current.forEach((unsubscribe) => {
            try {
                unsubscribe?.();
            } catch {
                // noop
            }
        });
        subscriptionsRef.current = [];
    }, []);

    const showReminderToast = useCallback((meetup, variant) => {
        const key = `${variant.key}:${meetup?.meetup_id || meetup?.id}`;
        if (firedReminderKeysRef.current.has(key)) return;
        firedReminderKeysRef.current.add(key);
        toast.show(buildReminderToast(meetup, variant));
    }, [toast]);

    const scheduleReminderTimeout = useCallback((delay, callback) => {
        const targetTime = Date.now() + delay;

        const scheduleNext = () => {
            const remainingDelay = targetTime - Date.now();

            if (remainingDelay <= 0) {
                callback();
                return;
            }

            const timeoutId = window.setTimeout(scheduleNext, Math.min(remainingDelay, MAX_TIMEOUT_IN_MS));
            timeoutIdsRef.current.push(timeoutId);
        };

        scheduleNext();
    }, []);

    const syncMeetupReminders = useCallback(async () => {
        if (Capacitor.isNativePlatform() || loading || !isLoggedIn) return;

        clearTimeouts();

        const now = Date.now();
        let meetups;

        try {
            meetups = await api.listJoinedGroupMeetups(
                new Date(now - THIRTY_MINUTES_IN_MS),
                new Date(now + REMINDER_WINDOW_IN_MS),
            );
        } catch (error) {
            console.error('GroupMeetupReminderBridge.syncMeetupReminders failed', error);
            return;
        }

        meetups.forEach((meetup) => {
            const startAt = new Date(meetup?.start_at ?? '');
            if (Number.isNaN(startAt.getTime())) return;

            REMINDER_VARIANTS.forEach((variant) => {
                const fireAt = startAt.getTime() - variant.leadTimeMs;
                const delay = fireAt - now;

                if (delay <= 0 && delay > -60_000) {
                    showReminderToast(meetup, variant);
                    return;
                }

                if (delay <= 0) return;

                scheduleReminderTimeout(delay, () => {
                    showReminderToast(meetup, variant);
                });
            });
        });
    }, [clearTimeouts, isLoggedIn, loading, scheduleReminderTimeout, showReminderToast]);

    useEffect(() => {
        if (Capacitor.isNativePlatform() || loading || !isLoggedIn) {
            clearTimeouts();
            clearSubscriptions();
            return undefined;
        }

        let cancelled = false;

        const setup = async () => {
            try {
                await syncMeetupReminders();
                const groups = await api.getGroups();
                if (cancelled) return;

                clearSubscriptions();
                subscriptionsRef.current = groups.map((group) => authApi.subscribeToGroupMeetupEvents(group.id, {
                    onMeetupCreated: (meetup) => {
                        if (meetup?.created_by && meetup.created_by === user?.id) return;
                        toast.show(buildNewMeetupToast(group.name, meetup));
                    },
                    onChanged: () => {
                        void syncMeetupReminders();
                    },
                }));
            } catch (error) {
                console.error('Failed to initialize desktop meetup reminders', error);
            }
        };

        void setup();

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                void syncMeetupReminders();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            cancelled = true;
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            clearTimeouts();
            clearSubscriptions();
        };
    }, [
        clearSubscriptions,
        clearTimeouts,
        isLoggedIn,
        loading,
        syncMeetupReminders,
        toast,
        user?.id,
    ]);

    return null;
}
