/**
 * Shared cache-key builders for the personal-calendar surfaces (assignments,
 * weekly schedule, external calendar sources, exams), mirroring
 * `groupCacheKeys.js` so `api.js` and the calendar data hook agree on the exact
 * key strings used for instant seeding (`cache.peek`) and invalidation
 * (`cache.delete` / `cache.deletePrefix`).
 */

export const calendarKeys = {
    // Assignments are read both globally (`getAssignments()`) and per-class
    // (`getAssignments(classId)`), so key by class to let each seed
    // independently — and clear them together via `assignmentsPrefix`.
    assignments: (classId) => `assignments:${classId ?? 'all'}`,
    assignmentsPrefix: () => 'assignments:',
    // Matches the legacy `cacheKey('classes')` string already used by api.js so a
    // single key seeds the calendar's class colours/filters.
    classes: () => 'classes',
    schedule: () => 'schedule',
    calendarSources: () => 'calendar-sources',
    exams: () => 'exams',
};
