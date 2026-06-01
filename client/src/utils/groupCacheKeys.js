/**
 * Shared cache-key builders for the study-groups feature, so `api.js` and the
 * group pages agree on the exact key strings used for seeding/invalidation.
 */

/** Stable YYYY-MM-DD key segment for schedule ranges. */
export const isoDate = (value) => {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
};

export const groupKeys = {
    groups: () => 'groups',
    info: (id) => `group-info:${id}`,
    members: (id) => `group-members:${id}`,
    decks: (id) => `group-decks:${id}`,
    folders: (id) => `group-folders:${id}`,
    files: (id, folderId) => `group-files:${id}:${folderId ?? 'root'}`,
    schedule: (id, start, end) => `group-schedule:${id}:${isoDate(start)}:${isoDate(end)}`,
    share: (id) => `group-share:${id}`,
    sessions: (id) => `group-sessions:${id}`,
    joinedMeetups: (start, end) => `joined-meetups:${isoDate(start)}:${isoDate(end)}`,

    // Prefixes for bulk invalidation via cache.deletePrefix(...)
    filesPrefix: (id) => `group-files:${id}:`,
    schedulePrefix: (id) => `group-schedule:${id}:`,
    allSchedulesPrefix: () => 'group-schedule:',
    joinedMeetupsPrefix: () => 'joined-meetups:',
};
