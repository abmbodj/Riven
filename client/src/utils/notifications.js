import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const HOUR_IN_MS = 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;
const MAX_ACTIVE_ASSIGNMENT_NOTIFICATIONS = 50;
const DEFAULT_SMALL_ICON = 'ic_stat_icon_config_sample';
const ASSIGNMENT_NOTIFICATION_ID_START = 1;
const ASSIGNMENT_NOTIFICATION_ID_END = 49_999;
const MEETUP_NOTIFICATION_ID_START = 50_000;
const MEETUP_NOTIFICATION_ID_END = 99_999;
const MAX_ACTIVE_MEETUP_NOTIFICATIONS = 50;

// Pattern to detect exams, quizzes, and tests by title
const EXAM_PATTERN = /\b(test|quiz|exam|midterm|final|assessment)\b/i;

const ASSIGNMENT_REMINDER_CONFIGS = [
    {
        leadTimeMs: 24 * HOUR_IN_MS,
        title: 'Upcoming Assignment',
        body: (assignmentTitle) => `${assignmentTitle} is due tomorrow.`,
        iconColor: '#488AFF',
    },
    {
        leadTimeMs: 12 * HOUR_IN_MS,
        title: 'Upcoming Assignment',
        body: (assignmentTitle) => `${assignmentTitle} is due in 12 hours.`,
        iconColor: '#488AFF',
    },
    {
        leadTimeMs: 3 * HOUR_IN_MS,
        title: 'Assignment Due Soon',
        body: (assignmentTitle) => `${assignmentTitle} is due in 3 hours.`,
        iconColor: '#FF3B30',
    },
    {
        leadTimeMs: 1 * HOUR_IN_MS,
        title: 'Assignment Due Soon',
        body: (assignmentTitle) => `${assignmentTitle} is due in 1 hour.`,
        iconColor: '#FF3B30',
    },
    {
        leadTimeMs: 30 * MINUTE_IN_MS,
        title: 'Assignment Due Soon',
        body: (assignmentTitle) => `${assignmentTitle} is due in 30 minutes.`,
        iconColor: '#FF3B30',
    },
];

// Extra 48h lead reminder for exams/quizzes/tests
const EXAM_EXTRA_REMINDER = {
    leadTimeMs: 48 * HOUR_IN_MS,
    title: 'Exam in 2 Days',
    body: (assignmentTitle) => `${assignmentTitle} is in 2 days — start preparing!`,
    iconColor: '#FF9500',
};

const ADAPTIVE_CRAM_REMINDER = {
    leadTimeMs: 36 * HOUR_IN_MS,
    title: 'Cram Mode Recommended',
    body: (assignmentTitle, weakTopicCount) => {
        const weakTopicLabel = weakTopicCount === 1 ? '1 weak topic' : `${weakTopicCount} weak topics`;
        return `${assignmentTitle} is coming up. Focus on ${weakTopicLabel} now.`;
    },
    iconColor: '#F97316',
};

const MEETUP_REMINDER_CONFIGS = [
    {
        leadTimeMs: 30 * MINUTE_IN_MS,
        title: (groupName) => `${groupName} starts in 30 minutes`,
        iconColor: '#DEB96A',
    },
    {
        leadTimeMs: 0,
        title: (groupName) => `${groupName} is starting now`,
        iconColor: '#DEB96A',
    },
];

function shouldScheduleAdaptiveCramReminder(assignment, dueDate, now) {
    const weakTopicCount = Number(assignment?.study_recommendation?.weak_topic_count || 0);
    const shouldCram = Boolean(assignment?.study_recommendation?.should_cram);
    const dueInMs = dueDate.getTime() - now.getTime();

    return shouldCram && weakTopicCount > 0 && dueInMs <= (72 * HOUR_IN_MS);
}

function buildAssignmentReminderNotifications(assignment, dueDate, now, startingId) {
    const assignmentTitle = assignment.title || assignment.name || assignment.assignment_title || 'Untitled Assignment';
    let nextId = startingId;

    const isExam =
        EXAM_PATTERN.test(assignmentTitle) ||
        (assignment.assignment_type && assignment.assignment_type !== 'assignment');

    const configs = isExam
        ? [EXAM_EXTRA_REMINDER, ...ASSIGNMENT_REMINDER_CONFIGS]
        : ASSIGNMENT_REMINDER_CONFIGS;

    const scheduledNotifications = configs.flatMap((reminder) => {
        const scheduledAt = new Date(dueDate.getTime() - reminder.leadTimeMs);
        if (scheduledAt <= now) {
            return [];
        }

        return [{
            id: nextId++,
            title: reminder.title,
            body: reminder.body(assignmentTitle),
            schedule: { at: scheduledAt },
            smallIcon: DEFAULT_SMALL_ICON,
            iconColor: reminder.iconColor,
        }];
    });

    if (shouldScheduleAdaptiveCramReminder(assignment, dueDate, now)) {
        const scheduledAt = new Date(Math.max(
            now.getTime() + (15 * MINUTE_IN_MS),
            dueDate.getTime() - ADAPTIVE_CRAM_REMINDER.leadTimeMs,
        ));

        if (scheduledAt < dueDate) {
            scheduledNotifications.unshift({
                id: nextId++,
                title: ADAPTIVE_CRAM_REMINDER.title,
                body: ADAPTIVE_CRAM_REMINDER.body(
                    assignmentTitle,
                    Number(assignment?.study_recommendation?.weak_topic_count || 0),
                ),
                schedule: { at: scheduledAt },
                smallIcon: DEFAULT_SMALL_ICON,
                iconColor: ADAPTIVE_CRAM_REMINDER.iconColor,
            });
        }
    }

    return scheduledNotifications;
}

function isNotificationIdInRange(id, rangeStart, rangeEnd) {
    return Number.isInteger(id) && id >= rangeStart && id <= rangeEnd;
}

async function getPendingNotificationsInRange(rangeStart, rangeEnd) {
    const pending = await LocalNotifications.getPending();
    return pending.notifications.filter((notification) =>
        isNotificationIdInRange(notification.id, rangeStart, rangeEnd)
    );
}

async function cancelNotificationRange(rangeStart, rangeEnd) {
    const notifications = await getPendingNotificationsInRange(rangeStart, rangeEnd);
    if (notifications.length > 0) {
        await LocalNotifications.cancel({ notifications });
    }
}

function formatMeetupNotificationTime(startAt) {
    const date = startAt instanceof Date ? startAt : new Date(startAt);
    if (Number.isNaN(date.getTime())) return 'soon';

    return new Intl.DateTimeFormat(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    }).format(date);
}

function buildMeetupNotificationBody(meetup, startAt) {
    const pieces = [
        meetup?.topic || 'Study session',
        formatMeetupNotificationTime(startAt),
    ];

    if (meetup?.location_label) {
        pieces.push(meetup.location_label);
    } else if (meetup?.location_url) {
        pieces.push('Open link');
    }

    return pieces.join(' · ');
}

function buildMeetupReminderNotifications(meetup, now, startingId) {
    const startAt = new Date(meetup?.start_at ?? '');
    if (Number.isNaN(startAt.getTime()) || startAt <= now) {
        return [];
    }

    const groupName = meetup?.group_name || 'Study Group';
    let nextId = startingId;

    return MEETUP_REMINDER_CONFIGS.flatMap((reminder) => {
        const scheduledAt = new Date(startAt.getTime() - reminder.leadTimeMs);
        if (scheduledAt <= now) {
            return [];
        }

        return [{
            id: nextId++,
            title: reminder.title(groupName),
            body: buildMeetupNotificationBody(meetup, startAt),
            schedule: { at: scheduledAt },
            smallIcon: DEFAULT_SMALL_ICON,
            iconColor: reminder.iconColor,
        }];
    });
}

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
    } catch {
        return false;
    }
}

export async function scheduleAssignmentNotifications(assignments, notificationsEnabled) {
    if (!Capacitor.isNativePlatform() || !notificationsEnabled) {
        if (Capacitor.isNativePlatform()) {
            try {
                await cancelNotificationRange(ASSIGNMENT_NOTIFICATION_ID_START, ASSIGNMENT_NOTIFICATION_ID_END);
            } catch (e) {
                console.error('Failed to cancel notifications', e);
            }
        }
        return;
    }

    try {
        const hasPermission = await checkNotificationPermissions();
        if (!hasPermission) return;

        await cancelNotificationRange(ASSIGNMENT_NOTIFICATION_ID_START, ASSIGNMENT_NOTIFICATION_ID_END);

        const now = new Date();
        const notificationsToSchedule = [];
        let idCounter = ASSIGNMENT_NOTIFICATION_ID_START;
        const assignmentList = Array.isArray(assignments) ? assignments : [];

        const futureAssignments = assignmentList
            .map((assignment) => ({
                assignment,
                dueDate: new Date(assignment.due_date ?? ''),
            }))
            .filter(({ assignment, dueDate }) => {
                if (assignment.status === 'Done' || assignment.status === 'Archived' || !assignment.due_date) return false;
                return !Number.isNaN(dueDate.getTime()) && dueDate > now;
            })
            .sort((left, right) => left.dueDate.getTime() - right.dueDate.getTime());

        for (const { assignment, dueDate } of futureAssignments) {
            const remindersForAssignment = buildAssignmentReminderNotifications(assignment, dueDate, now, idCounter);
            if (remindersForAssignment.length === 0) continue;

            // Keep the full reminder bundle for the soonest due assignments first.
            if (notificationsToSchedule.length + remindersForAssignment.length > MAX_ACTIVE_ASSIGNMENT_NOTIFICATIONS) {
                break;
            }

            notificationsToSchedule.push(...remindersForAssignment);
            idCounter += remindersForAssignment.length;
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

export async function scheduleMeetupNotifications(meetups, notificationsEnabled) {
    if (!Capacitor.isNativePlatform() || !notificationsEnabled) {
        if (Capacitor.isNativePlatform()) {
            try {
                await cancelNotificationRange(MEETUP_NOTIFICATION_ID_START, MEETUP_NOTIFICATION_ID_END);
            } catch (error) {
                console.error('Failed to cancel meetup notifications', error);
            }
        }
        return;
    }

    try {
        const hasPermission = await checkNotificationPermissions();
        if (!hasPermission) return;

        await cancelNotificationRange(MEETUP_NOTIFICATION_ID_START, MEETUP_NOTIFICATION_ID_END);

        const now = new Date();
        const notificationsToSchedule = [];
        let idCounter = MEETUP_NOTIFICATION_ID_START;
        const meetupList = Array.isArray(meetups) ? meetups : [];

        const upcomingMeetups = meetupList
            .filter((meetup) => meetup?.status !== 'cancelled')
            .map((meetup) => ({
                meetup,
                startAt: new Date(meetup?.start_at ?? ''),
            }))
            .filter(({ startAt }) => !Number.isNaN(startAt.getTime()) && startAt > now)
            .sort((left, right) => left.startAt.getTime() - right.startAt.getTime());

        for (const { meetup } of upcomingMeetups) {
            const remindersForMeetup = buildMeetupReminderNotifications(meetup, now, idCounter);
            if (remindersForMeetup.length === 0) continue;

            if (notificationsToSchedule.length + remindersForMeetup.length > MAX_ACTIVE_MEETUP_NOTIFICATIONS) {
                break;
            }

            notificationsToSchedule.push(...remindersForMeetup);
            idCounter += remindersForMeetup.length;
        }

        if (notificationsToSchedule.length > 0) {
            await LocalNotifications.schedule({
                notifications: notificationsToSchedule,
            });
        }
    } catch (error) {
        console.error('Error scheduling meetup notifications:', error);
    }
}
