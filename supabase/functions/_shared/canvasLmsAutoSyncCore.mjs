import { selectCanvasAutoSyncUsers } from './canvasLmsCore.mjs';

const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const requireCanvasAutoSyncAuth = ({ authorizationHeader, expectedSecret }) => {
  if (!expectedSecret) {
    throw createHttpError('Canvas auto-sync is not configured.', 503);
  }

  const token = authorizationHeader?.startsWith('Bearer ')
    ? authorizationHeader.slice('Bearer '.length).trim()
    : '';

  if (!token || token !== expectedSecret) {
    throw createHttpError('Unauthorized', 401);
  }
};

export const runCanvasAutoSyncBatch = async ({
  users,
  updateUserState,
  syncUser,
  reportError,
  now = new Date(),
  batchSize = 25,
}) => {
  const candidates = selectCanvasAutoSyncUsers({
    users,
    now,
    batchSize,
  });

  let syncedUsers = 0;
  let failedUsers = 0;
  let classesAdded = 0;
  let assignmentsAdded = 0;
  const attemptedAt = now.toISOString();

  for (const user of candidates) {
    try {
      await updateUserState(user.id, {
        last_canvas_auto_sync_attempt_at: attemptedAt,
      });

      const result = await syncUser(user, now);

      await updateUserState(user.id, {
        last_canvas_sync_at: attemptedAt,
        last_canvas_auto_sync_attempt_at: attemptedAt,
        last_canvas_auto_sync_error: null,
      });

      syncedUsers += 1;
      classesAdded += Number(result?.classesAdded || 0);
      assignmentsAdded += Number(result?.assignmentsAdded || 0);
    } catch (error) {
      failedUsers += 1;
      const message = error instanceof Error ? error.message : 'Canvas auto-sync failed.';

      try {
        await updateUserState(user.id, {
          last_canvas_auto_sync_attempt_at: attemptedAt,
          last_canvas_auto_sync_error: message,
        });
      } catch {
        // Continue processing the batch even if we cannot persist the failure state.
      }

      if (reportError) {
        try {
          await reportError(error, user);
        } catch {
          // Reporting should never abort the remaining user batch.
        }
      }
    }
  }

  return {
    scannedUsers: Array.isArray(users) ? users.length : 0,
    attemptedUsers: candidates.length,
    syncedUsers,
    failedUsers,
    classesAdded,
    assignmentsAdded,
  };
};
