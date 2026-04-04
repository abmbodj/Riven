import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const HOUR_IN_MS = 60 * 60 * 1000;
const MINUTE_IN_MS = 60 * 1000;
const MAX_ACTIVE_ASSIGNMENT_NOTIFICATIONS = 50;
const DEFAULT_SMALL_ICON = 'ic_stat_icon_config_sample';

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
