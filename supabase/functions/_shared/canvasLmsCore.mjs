const DAY_MS = 24 * 60 * 60 * 1000;
export const CANVAS_AUTO_SYNC_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const CANVAS_AUTO_SYNC_ATTEMPT_COOLDOWN_MS = 60 * 60 * 1000;

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

const isPrivilegedUser = (user) => (
  (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier
);

const toValidDate = (value) => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const isPremiumCanvasUser = (user) => (
  Boolean(
    isPrivilegedUser(user)
    || user?.subscription_tier === 'supporter'
    || user?.subscription_tier === 'lifetime'
  )
);

export const validateCanvasFeedUrl = (icalUrl) => {
  if (!icalUrl || typeof icalUrl !== 'string') {
    throw createHttpError('Canvas Calendar Link is required.', 400);
  }

  const trimmedUrl = icalUrl.trim();
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
  if (isPremiumCanvasUser(user)) {
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

  if (!isPremiumCanvasUser(user)) {
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
  createAssignment,
  now = new Date(),
}) => {
  let syncedClassesCount = 0;
  let syncedAssignmentsCount = 0;
  const classById = new Map();
  const classByCanvasCourseId = new Map();
  const legacyClassByName = new Map();

  const removeClassFromIndexes = (classId) => {
    for (const [courseId, klass] of classByCanvasCourseId.entries()) {
      if (String(klass?.id) === String(classId)) {
        classByCanvasCourseId.delete(courseId);
      }
    }

    for (const [className, klass] of legacyClassByName.entries()) {
      if (String(klass?.id) === String(classId)) {
        legacyClassByName.delete(className);
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

    removeClassFromIndexes(mergedClass.id);
    classById.set(mergedClass.id, {
      ...mergedClass,
      canvas_course_id: normalizedCourseId,
      name: normalizedName ?? mergedClass.name,
    });

    const cachedClass = classById.get(mergedClass.id);

    if (normalizedCourseId) {
      classByCanvasCourseId.set(normalizedCourseId, cachedClass);
    } else if (normalizedName) {
      legacyClassByName.set(normalizedName, cachedClass);
    }

    return cachedClass;
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
    if (canvasCourseId && inferredClass && !inferredClassByCanvasCourseId.has(canvasCourseId)) {
      inferredClassByCanvasCourseId.set(canvasCourseId, inferredClass);
    }
  }

  const ensureCanvasCourseLink = async (klass, canvasCourseId) => {
    const normalizedCourseId = toComparableText(canvasCourseId);
    if (!klass || !normalizedCourseId) {
      return cacheClass(klass);
    }

    const existingExactMatch = classByCanvasCourseId.get(normalizedCourseId);
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

    const exactMatch = canvasCourseId ? classByCanvasCourseId.get(canvasCourseId) : null;
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

    const legacyMatch = courseName ? legacyClassByName.get(courseName) : null;
    if (legacyMatch) {
      return await ensureCanvasCourseLink(legacyMatch, canvasCourseId);
    }

    const createdClass = await createClass(userId, assignment.courseName, canvasCourseId);
    const cachedCreatedClass = cacheClass({
      name: assignment.courseName,
      canvas_course_id: canvasCourseId,
      ...createdClass,
    });
    if (createdClass?.created !== false) {
      syncedClassesCount += 1;
    }
    return cachedCreatedClass;
  };

  for (const assignment of parsedAssignments) {
    if (assignmentIds.has(assignment.uid)) {
      continue;
    }

    const resolvedClass = await resolveClassForAssignment(assignment);
    const classId = resolvedClass?.id;

    const createAssignmentResult = await createAssignment(userId, classId, assignment);
    const inserted = createAssignmentResult === false
      ? false
      : createAssignmentResult?.inserted !== false;

    assignmentIds.add(assignment.uid);
    if (inserted) {
      syncedAssignmentsCount += 1;
    }
  }

  return {
    message: 'Canvas sync complete!',
    classesAdded: syncedClassesCount,
    assignmentsAdded: syncedAssignmentsCount,
  };
};
