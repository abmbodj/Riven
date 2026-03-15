const DAY_MS = 24 * 60 * 60 * 1000;

const createHttpError = (message, status, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const isPrivilegedUser = (user) => (
  (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier
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
  const isPremium = isPrivilegedUser(user)
    || user.subscription_tier === 'supporter'
    || user.subscription_tier === 'lifetime';

  if (isPremium) {
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
    title: assignmentTitle,
    description,
    dueDateIso: parsedDue.toISOString(),
    status: daysPastDue > 7 ? 'Archived' : 'Todo',
  };
};

export const syncCanvasCalendar = async ({
  userId,
  events,
  existingClasses,
  existingAssignmentIds,
  createClass,
  createAssignment,
  now = new Date(),
}) => {
  let syncedClassesCount = 0;
  let syncedAssignmentsCount = 0;
  const classMap = new Map((existingClasses || []).map((klass) => [klass.name, klass.id]));
  const assignmentIds = new Set(existingAssignmentIds || []);

  for (const event of Object.values(events || {})) {
    const assignment = deriveCanvasAssignment(event, now);
    if (!assignment) {
      continue;
    }

    if (assignmentIds.has(assignment.uid)) {
      continue;
    }

    let classId = classMap.get(assignment.courseName);
    if (!classId) {
      const createdClass = await createClass(userId, assignment.courseName);
      classId = createdClass.id;
      classMap.set(assignment.courseName, classId);
      syncedClassesCount += 1;
    }

    await createAssignment(userId, classId, assignment);
    assignmentIds.add(assignment.uid);
    syncedAssignmentsCount += 1;
  }

  return {
    message: 'Canvas sync complete!',
    classesAdded: syncedClassesCount,
    assignmentsAdded: syncedAssignmentsCount,
  };
};
