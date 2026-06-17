import { isPremiumActive } from './premiumAccess.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
export const CANVAS_AUTO_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const CANVAS_AUTO_SYNC_ATTEMPT_COOLDOWN_MS = 60 * 60 * 1000;
const CLEANUP_RESTORABLE_STATUSES = new Set(['Todo', 'Doing']);

const toComparableText = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const toComparableDateValue = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
};

const toIsoDateOrNull = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const isArchivedClass = (klass) => (
  klass?.is_archived === true
  || klass?.is_archived === 'true'
  || klass?.archived_at != null
);

export const isCanvasCleanupActiveAssignment = (assignment) => {
  const status = typeof assignment?.status === 'string' ? assignment.status : 'Todo';
  return !['Done', 'Archived'].includes(status);
};

const sortClassesForMatching = (classes = []) => [...classes].sort((leftClass, rightClass) => {
  const createdAtDiff = toComparableDateValue(leftClass?.created_at) - toComparableDateValue(rightClass?.created_at);
  if (createdAtDiff !== 0) {
    return createdAtDiff;
  }

  return String(leftClass?.id ?? '').localeCompare(String(rightClass?.id ?? ''));
});

const createHttpError = (message, status, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const toValidDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isPremiumCanvasUser = (user, now = new Date()) => isPremiumActive(user, now);

// RIV-002: structural SSRF guard. Synchronous (no DNS) so it stays portable across the
// Deno edge runtime and the Node test runner; DNS-rebinding is a documented residual risk.
const PRIVATE_IPV4_PATTERNS = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
];

const isDisallowedCanvasHost = (hostname) => {
  const host = (hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (host === 'metadata.google.internal') return true;
  if (host === '::1' || host === '::' || host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('::ffff:')) return true;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) && PRIVATE_IPV4_PATTERNS.some((re) => re.test(host))) return true;
  return false;
};

export const validateCanvasFeedUrl = (icalUrl) => {
  if (!icalUrl || typeof icalUrl !== 'string') {
    throw createHttpError('Canvas Calendar Link is required.', 400);
  }

  const trimmedUrl = icalUrl.trim();

  let parsed;
  try {
    parsed = new URL(trimmedUrl);
  } catch {
    throw createHttpError('Invalid Canvas Calendar link.', 400);
  }

  if (parsed.protocol !== 'https:') {
    throw createHttpError('Canvas Calendar link must use https.', 400);
  }
  if (isDisallowedCanvasHost(parsed.hostname)) {
    throw createHttpError('Canvas Calendar link is not allowed.', 400);
  }

  if (!trimmedUrl.includes('/feeds/calendars/')) {
    throw createHttpError('Invalid link. Be sure it comes from your Canvas Calendar Feed.', 400);
  }

  return trimmedUrl;
};

export const applyCanvasSyncQuota = async ({
  user,
  adGranted,
  now = new Date(),
  resetSyncState,
  incrementSyncCount,
}) => {
  if (isPremiumCanvasUser(user, now)) {
    return;
  }

  let syncCount = Number(user.lms_sync_count ?? 0);
  const resetAt = user.lms_sync_reset_at ? new Date(user.lms_sync_reset_at) : null;

  if (!resetAt || (now - resetAt > DAY_MS)) {
    syncCount = 0;
    await resetSyncState(now);
  }

  if (syncCount >= 1 && !adGranted) {
    throw createHttpError(
      'Free sync limit reached for today. Watch an ad or upgrade for more syncs.',
      429,
      { canWatchAd: true },
    );
  }

  await incrementSyncCount(syncCount + 1);
};

export const isCanvasAutoSyncDue = ({
  user,
  now = new Date(),
  syncIntervalMs = CANVAS_AUTO_SYNC_INTERVAL_MS,
  attemptCooldownMs = CANVAS_AUTO_SYNC_ATTEMPT_COOLDOWN_MS,
}) => {
  if (!user?.canvas_ical_url || user?.canvas_auto_sync_enabled !== true) {
    return false;
  }

  if (user?.simulate_free_tier) {
    return false;
  }

  if (!isPremiumCanvasUser(user, now)) {
    return false;
  }

  const lastAttemptAt = toValidDate(user.last_canvas_auto_sync_attempt_at);
  if (lastAttemptAt && (now - lastAttemptAt) < attemptCooldownMs) {
    return false;
  }

  const lastSyncAt = toValidDate(user.last_canvas_sync_at);
  return !lastSyncAt || (now - lastSyncAt) >= syncIntervalMs;
};

export const selectCanvasAutoSyncUsers = ({
  users,
  now = new Date(),
  batchSize = 25,
  syncIntervalMs = CANVAS_AUTO_SYNC_INTERVAL_MS,
  attemptCooldownMs = CANVAS_AUTO_SYNC_ATTEMPT_COOLDOWN_MS,
}) => (users || [])
  .filter((user) => isCanvasAutoSyncDue({
    user,
    now,
    syncIntervalMs,
    attemptCooldownMs,
  }))
  .sort((leftUser, rightUser) => {
    const leftSyncAt = toValidDate(leftUser.last_canvas_sync_at)?.getTime() ?? 0;
    const rightSyncAt = toValidDate(rightUser.last_canvas_sync_at)?.getTime() ?? 0;
    return leftSyncAt - rightSyncAt;
  })
  .slice(0, batchSize);

const deriveCanvasAssignment = (event, now) => {
  if (event.type !== 'VEVENT') {
    return null;
  }

  const summary = event.summary || 'Untitled Event';
  const description = event.description || '';
  const uid = event.uid;
  const dueDate = event.end || event.start;

  if (!dueDate) {
    return null;
  }

  let courseName = 'Canvas Activities';
  let assignmentTitle = summary;
  const courseMatch = summary.match(/\[(.*?)\]$/);

  if (courseMatch?.[1]) {
    courseName = courseMatch[1].trim();
    assignmentTitle = summary.replace(/\[.*?\]$/, '').trim();
  }

  const parsedDue = new Date(dueDate);
  const daysPastDue = (now - parsedDue) / DAY_MS;

  return {
    uid,
    courseName,
    canvasCourseId: courseName,
    title: assignmentTitle,
    description,
    dueDateIso: parsedDue.toISOString(),
    status: daysPastDue > 7 ? 'Archived' : 'Todo',
  };
};

/**
 * @param {{
 *   userId: number | string,
 *   events: Record<string, unknown>,
 *   existingClasses: Array<Record<string, unknown>>,
 *   existingAssignments?: Array<{ canvas_assignment_id?: string | null, class_id?: number | string | null }>,
 *   existingAssignmentIds?: string[],
 *   createClass: (userId: number | string, courseName: string, canvasCourseId: string | null) => Promise<Record<string, unknown>>,
 *   linkClassToCanvasCourse?: ((classId: number | string, canvasCourseId: string) => Promise<Record<string, unknown> | null>) | null,
 *   updateClassCanvasMetadata?: ((classId: number | string, metadata: { canvasLastSeenAtIso: string, canvasLastAssignmentDueAtIso: string | null }) => Promise<unknown>) | null,
 *   createAssignment: (
 *     userId: number | string,
 *     classId: number | string,
 *     assignment: any,
 *   ) => Promise<unknown>,
 *   now?: Date,
 * }} params
 */
export const syncCanvasCalendar = async ({
  userId,
  events,
  existingClasses,
  existingAssignments = [],
  existingAssignmentIds = [],
  createClass,
  linkClassToCanvasCourse = null,
  updateClassCanvasMetadata = null,
  createAssignment,
  now = new Date(),
}) => {
  let syncedClassesCount = 0;
  let syncedAssignmentsCount = 0;
  const classById = new Map();
  const activeClassByCanvasCourseId = new Map();
  const activeLegacyClassByName = new Map();
  const classMetadataById = new Map();

  const removeClassFromIndexes = (classId) => {
    for (const [courseId, klass] of activeClassByCanvasCourseId.entries()) {
      if (String(klass?.id) === String(classId)) {
        activeClassByCanvasCourseId.delete(courseId);
      }
    }

    for (const [className, klass] of activeLegacyClassByName.entries()) {
      if (String(klass?.id) === String(classId)) {
        activeLegacyClassByName.delete(className);
      }
    }
  };

  const cacheClass = (klass) => {
    if (!klass?.id) {
      return null;
    }

    const previous = classById.get(klass.id) || {};
    const mergedClass = { ...previous, ...klass };
    const normalizedCourseId = toComparableText(mergedClass.canvas_course_id);
    const normalizedName = toComparableText(mergedClass.name);
    const archived = isArchivedClass(mergedClass);

    removeClassFromIndexes(mergedClass.id);
    classById.set(mergedClass.id, {
      ...mergedClass,
      canvas_course_id: normalizedCourseId,
      name: normalizedName ?? mergedClass.name,
      is_archived: archived,
    });

    const cachedClass = classById.get(mergedClass.id);

    if (!archived && normalizedCourseId) {
      activeClassByCanvasCourseId.set(normalizedCourseId, cachedClass);
    } else if (!archived && normalizedName) {
      activeLegacyClassByName.set(normalizedName, cachedClass);
    }

    return cachedClass;
  };

  const markClassSeen = (classId, assignment) => {
    if (!classId) {
      return;
    }

    const previous = classMetadataById.get(classId) || {
      classId,
      canvasLastSeenAtIso: now.toISOString(),
      canvasLastAssignmentDueAtIso: null,
    };
    const dueDateIso = toIsoDateOrNull(assignment?.dueDateIso);
    const previousDueValue = toComparableDateValue(previous.canvasLastAssignmentDueAtIso);
    const nextDueValue = toComparableDateValue(dueDateIso);

    classMetadataById.set(classId, {
      classId,
      canvasLastSeenAtIso: now.toISOString(),
      canvasLastAssignmentDueAtIso: nextDueValue > previousDueValue
        ? dueDateIso
        : previous.canvasLastAssignmentDueAtIso,
    });
  };

  for (const klass of sortClassesForMatching(existingClasses || [])) {
    cacheClass(klass);
  }

  const assignmentIds = new Set();
  const assignmentClassByUid = new Map();

  for (const assignment of existingAssignments || []) {
    const assignmentUid = toComparableText(assignment?.canvas_assignment_id);
    if (!assignmentUid) {
      continue;
    }

    assignmentIds.add(assignmentUid);
    if (assignment?.class_id) {
      assignmentClassByUid.set(assignmentUid, assignment.class_id);
    }
  }

  for (const assignmentUid of existingAssignmentIds || []) {
    const normalizedAssignmentUid = toComparableText(assignmentUid);
    if (normalizedAssignmentUid) {
      assignmentIds.add(normalizedAssignmentUid);
    }
  }

  const parsedAssignments = Object.values(events || [])
    .map((event) => deriveCanvasAssignment(event, now))
    .filter(Boolean);

  const inferredClassByCanvasCourseId = new Map();
  for (const assignment of parsedAssignments) {
    const inferredClassId = assignmentClassByUid.get(assignment.uid);
    const inferredClass = inferredClassId ? classById.get(inferredClassId) : null;
    const canvasCourseId = toComparableText(assignment.canvasCourseId);
    if (canvasCourseId && inferredClass && !isArchivedClass(inferredClass) && !inferredClassByCanvasCourseId.has(canvasCourseId)) {
      inferredClassByCanvasCourseId.set(canvasCourseId, inferredClass);
    }
  }

  const ensureCanvasCourseLink = async (klass, canvasCourseId) => {
    const normalizedCourseId = toComparableText(canvasCourseId);
    if (!klass || !normalizedCourseId) {
      return cacheClass(klass);
    }

    const existingExactMatch = activeClassByCanvasCourseId.get(normalizedCourseId);
    if (existingExactMatch) {
      return existingExactMatch;
    }

    if (toComparableText(klass.canvas_course_id) === normalizedCourseId) {
      return cacheClass(klass);
    }

    if (!linkClassToCanvasCourse) {
      return cacheClass({
        ...klass,
        canvas_course_id: normalizedCourseId,
      });
    }

    const linkedClass = await linkClassToCanvasCourse(klass.id, normalizedCourseId);
    return cacheClass(linkedClass || {
      ...klass,
      canvas_course_id: normalizedCourseId,
    });
  };

  const resolveClassForAssignment = async (assignment) => {
    const canvasCourseId = toComparableText(assignment.canvasCourseId);
    const courseName = toComparableText(assignment.courseName);

    const exactMatch = canvasCourseId ? activeClassByCanvasCourseId.get(canvasCourseId) : null;
    if (exactMatch) {
      return exactMatch;
    }

    const inferredMatch = canvasCourseId ? inferredClassByCanvasCourseId.get(canvasCourseId) : null;
    if (inferredMatch) {
      const linkedClass = await ensureCanvasCourseLink(inferredMatch, canvasCourseId);
      if (canvasCourseId) {
        inferredClassByCanvasCourseId.set(canvasCourseId, linkedClass);
      }
      return linkedClass;
    }

    const legacyMatch = courseName ? activeLegacyClassByName.get(courseName) : null;
    if (legacyMatch) {
      return await ensureCanvasCourseLink(legacyMatch, canvasCourseId);
    }

    const createdClass = await createClass(userId, assignment.courseName, canvasCourseId);
    const cachedCreatedClass = cacheClass({
      name: assignment.courseName,
      canvas_course_id: canvasCourseId,
      is_archived: false,
      ...createdClass,
    });
    if (createdClass?.created !== false) {
      syncedClassesCount += 1;
    }
    return cachedCreatedClass;
  };

  for (const assignment of parsedAssignments) {
    if (assignmentIds.has(assignment.uid)) {
      const existingClassId = assignmentClassByUid.get(assignment.uid);
      const existingClass = existingClassId ? classById.get(existingClassId) : null;
      if (existingClass && !isArchivedClass(existingClass)) {
        markClassSeen(existingClass.id, assignment);
      }
      continue;
    }

    const resolvedClass = await resolveClassForAssignment(assignment);
    const classId = resolvedClass?.id;

    const createAssignmentResult = await createAssignment(userId, classId, assignment);
    const inserted = createAssignmentResult === false
      ? false
      : createAssignmentResult?.inserted !== false;

    assignmentIds.add(assignment.uid);
    markClassSeen(classId, assignment);
    if (inserted) {
      syncedAssignmentsCount += 1;
    }
  }

  if (updateClassCanvasMetadata) {
    for (const metadata of classMetadataById.values()) {
      await updateClassCanvasMetadata(metadata.classId, {
        canvasLastSeenAtIso: metadata.canvasLastSeenAtIso,
        canvasLastAssignmentDueAtIso: metadata.canvasLastAssignmentDueAtIso,
      });
    }
  }

  return {
    message: 'Canvas sync complete!',
    classesAdded: syncedClassesCount,
    assignmentsAdded: syncedAssignmentsCount,
  };
};

export const buildCanvasSemesterCleanupPreview = ({
  classes = [],
  assignments = [],
} = {}) => {
  const assignmentStatsByClassId = new Map();

  for (const assignment of assignments || []) {
    if (!assignment?.class_id) {
      continue;
    }

    const classId = String(assignment.class_id);
    const current = assignmentStatsByClassId.get(classId) || {
      totalAssignmentCount: 0,
      activeAssignmentCount: 0,
      lastAssignmentDueAt: null,
    };
    const dueDateIso = toIsoDateOrNull(assignment.due_date || assignment.dueDateIso);
    const previousDueValue = toComparableDateValue(current.lastAssignmentDueAt);
    const nextDueValue = toComparableDateValue(dueDateIso);

    assignmentStatsByClassId.set(classId, {
      totalAssignmentCount: current.totalAssignmentCount + 1,
      activeAssignmentCount: current.activeAssignmentCount + (isCanvasCleanupActiveAssignment(assignment) ? 1 : 0),
      lastAssignmentDueAt: nextDueValue > previousDueValue
        ? dueDateIso
        : current.lastAssignmentDueAt,
    });
  }

  const cleanupClasses = (classes || [])
    .filter((klass) => !isArchivedClass(klass))
    .map((klass) => {
      const stats = assignmentStatsByClassId.get(String(klass.id)) || {
        totalAssignmentCount: 0,
        activeAssignmentCount: 0,
        lastAssignmentDueAt: null,
      };

      return {
        id: klass.id,
        name: klass.name,
        color: klass.color || null,
        canvasCourseId: klass.canvas_course_id,
        createdAt: klass.created_at || null,
        lastSeenAt: klass.canvas_last_seen_at || null,
        lastAssignmentDueAt: klass.canvas_last_assignment_due_at || stats.lastAssignmentDueAt,
        totalAssignmentCount: stats.totalAssignmentCount,
        activeAssignmentCount: stats.activeAssignmentCount,
        suggested: true,
        selected: true,
      };
    })
    .sort((left, right) => {
      const leftSeen = toComparableDateValue(left.lastSeenAt || left.lastAssignmentDueAt || left.createdAt);
      const rightSeen = toComparableDateValue(right.lastSeenAt || right.lastAssignmentDueAt || right.createdAt);
      if (rightSeen !== leftSeen) {
        return rightSeen - leftSeen;
      }
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

  return {
    classes: cleanupClasses,
    suggestedClassIds: cleanupClasses.map((klass) => klass.id),
  };
};

export const buildCanvasSemesterArchiveAssignmentUpdates = ({
  assignments = [],
  now = new Date(),
} = {}) => {
  const archivedAt = now.toISOString();

  return (assignments || [])
    .filter(isCanvasCleanupActiveAssignment)
    .map((assignment) => ({
      id: assignment.id,
      status: 'Archived',
      class_cleanup_archived_at: archivedAt,
      class_cleanup_previous_status: typeof assignment.status === 'string' && assignment.status.trim()
        ? assignment.status
        : 'Todo',
    }));
};

export const buildCanvasSemesterRestoreAssignmentUpdates = ({
  assignments = [],
} = {}) => (assignments || [])
  .filter((assignment) => assignment?.status === 'Archived')
  .filter((assignment) => assignment?.class_cleanup_archived_at)
  .filter((assignment) => CLEANUP_RESTORABLE_STATUSES.has(assignment?.class_cleanup_previous_status))
  .map((assignment) => ({
    id: assignment.id,
    status: assignment.class_cleanup_previous_status,
    class_cleanup_archived_at: null,
    class_cleanup_previous_status: null,
  }));
