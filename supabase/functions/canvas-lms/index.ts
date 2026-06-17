import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import {
  applyCanvasSyncQuota,
  buildCanvasSemesterArchiveAssignmentUpdates,
  buildCanvasSemesterCleanupPreview,
  buildCanvasSemesterRestoreAssignmentUpdates,
  validateCanvasFeedUrl,
} from '../_shared/canvasLmsCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { syncCanvasCalendarForUser, parseCanvasCalendar } from '../_shared/canvasLmsSync.ts';
import {
  canvasAutoSyncSchema,
  canvasConnectSchema,
  canvasSemesterArchiveSchema,
  canvasSemesterRestoreSchema,
} from '../_shared/validation.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action;
    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();

    if (action === 'connect') {
      const parsed = canvasConnectSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(
          { error: parsed.error.errors[0]?.message ?? 'Invalid Canvas link' },
          { status: 400 },
          request
        );
      }
      const icalUrl = validateCanvasFeedUrl(parsed.data.icalUrl);

      try {
        const parsed = await parseCanvasCalendar(icalUrl);
        if (!parsed) {
          return jsonResponse({ error: 'Failed to parse calendar feed. Try again.' }, { status: 400 }, request);
        }
      } catch {
        return jsonResponse({ error: 'Could not reach Canvas Calendar Feed. Check the link.' }, { status: 400 }, request);
      }

      const { error } = await admin
        .from('users')
        .update({
          canvas_ical_url: icalUrl,
          canvas_api_url: null,
          canvas_api_token: null,
          canvas_auto_sync_enabled: true,
          last_canvas_auto_sync_error: null,
        })
        .eq('id', authUser.id);

      if (error) throw error;

      return jsonResponse({ message: 'Canvas connected successfully.' }, {}, request);
    }

    if (action === 'disconnect') {
      const { error } = await admin
        .from('users')
        .update({
          canvas_ical_url: null,
          canvas_auto_sync_enabled: false,
          last_canvas_sync_at: null,
          last_canvas_auto_sync_attempt_at: null,
          last_canvas_auto_sync_error: null,
        })
        .eq('id', authUser.id);

      if (error) throw error;

      return jsonResponse({ message: 'Canvas disconnected.' }, {}, request);
    }

    if (action === 'set-auto-sync') {
      const parsed = canvasAutoSyncSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(
          { error: parsed.error.errors[0]?.message ?? 'Invalid auto-sync setting' },
          { status: 400 },
          request,
        );
      }

      const { data: user, error: userError } = await admin
        .from('users')
        .select('canvas_ical_url')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userError) throw userError;
      if (!user?.canvas_ical_url) {
        return jsonResponse(
          { error: 'Canvas is not connected. Add your Canvas Calendar Link first.' },
          { status: 400 },
          request,
        );
      }

      const { error } = await admin
        .from('users')
        .update({ canvas_auto_sync_enabled: parsed.data.enabled })
        .eq('id', authUser.id);

      if (error) throw error;

      return jsonResponse({
        message: parsed.data.enabled
          ? 'Canvas auto-sync enabled.'
          : 'Canvas auto-sync disabled.',
        autoSyncEnabled: parsed.data.enabled,
      }, {}, request);
    }

    if (action === 'preview-semester-cleanup') {
      const { data: classes, error: classesError } = await admin
        .from('classes')
        .select('id, name, color, created_at, canvas_course_id, is_archived, archived_at, canvas_last_seen_at, canvas_last_assignment_due_at')
        .eq('user_id', authUser.id)
        .or('is_archived.is.false,is_archived.is.null')
        .order('created_at', { ascending: false });

      if (classesError) throw classesError;

      const classIds = (classes || []).map((klass: { id: string }) => klass.id);
      let assignments: Array<Record<string, unknown>> = [];

      if (classIds.length > 0) {
        const { data: assignmentRows, error: assignmentsError } = await admin
          .from('assignments')
          .select('id, class_id, status, due_date')
          .eq('user_id', authUser.id)
          .in('class_id', classIds);

        if (assignmentsError) throw assignmentsError;
        assignments = assignmentRows || [];
      }

      return jsonResponse(buildCanvasSemesterCleanupPreview({
        classes: classes || [],
        assignments,
      }), {}, request);
    }

    if (action === 'archive-semester-classes') {
      const parsed = canvasSemesterArchiveSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(
          { error: parsed.error.errors[0]?.message ?? 'Select at least one class to archive.' },
          { status: 400 },
          request,
        );
      }

      const { data: classesToArchive, error: classesError } = await admin
        .from('classes')
        .select('id')
        .eq('user_id', authUser.id)
        .or('is_archived.is.false,is_archived.is.null')
        .in('id', parsed.data.classIds);

      if (classesError) throw classesError;

      const classIds = (classesToArchive || []).map((klass: { id: string }) => klass.id);
      if (classIds.length === 0) {
        return jsonResponse({
          classesArchived: 0,
          assignmentsArchived: 0,
        }, {}, request);
      }

      const archivedAt = new Date().toISOString();
      const { error: archiveClassError } = await admin
        .from('classes')
        .update({
          is_archived: true,
          archived_at: archivedAt,
          archive_source: 'canvas_semester_cleanup',
        })
        .eq('user_id', authUser.id)
        .in('id', classIds);

      if (archiveClassError) throw archiveClassError;

      const { data: assignments, error: assignmentsError } = await admin
        .from('assignments')
        .select('id, status')
        .eq('user_id', authUser.id)
        .in('class_id', classIds);

      if (assignmentsError) throw assignmentsError;

      const assignmentUpdates = buildCanvasSemesterArchiveAssignmentUpdates({
        assignments: assignments || [],
        now: new Date(archivedAt),
      });

      for (const assignment of assignmentUpdates) {
        const { error: updateAssignmentError } = await admin
          .from('assignments')
          .update({
            status: assignment.status,
            class_cleanup_archived_at: assignment.class_cleanup_archived_at,
            class_cleanup_previous_status: assignment.class_cleanup_previous_status,
          })
          .eq('user_id', authUser.id)
          .eq('id', assignment.id);

        if (updateAssignmentError) throw updateAssignmentError;
      }

      return jsonResponse({
        classesArchived: classIds.length,
        assignmentsArchived: assignmentUpdates.length,
      }, {}, request);
    }

    if (action === 'restore-class') {
      const parsed = canvasSemesterRestoreSchema.safeParse(body);
      if (!parsed.success) {
        return jsonResponse(
          { error: parsed.error.errors[0]?.message ?? 'Invalid class id.' },
          { status: 400 },
          request,
        );
      }

      const { data: restoredClass, error: restoreClassError } = await admin
        .from('classes')
        .update({
          is_archived: false,
          archived_at: null,
          archive_source: null,
        })
        .eq('user_id', authUser.id)
        .eq('id', parsed.data.classId)
        .select('id')
        .maybeSingle();

      if (restoreClassError) {
        if (typeof restoreClassError === 'object' && restoreClassError && 'code' in restoreClassError && restoreClassError.code === '23505') {
          return jsonResponse(
            { error: 'A current Canvas class already uses this course. Archive that class before restoring this one.' },
            { status: 409 },
            request,
          );
        }
        throw restoreClassError;
      }

      if (!restoredClass) {
        return jsonResponse({ error: 'Class not found.' }, { status: 404 }, request);
      }

      const { data: assignments, error: assignmentsError } = await admin
        .from('assignments')
        .select('id, status, class_cleanup_archived_at, class_cleanup_previous_status')
        .eq('user_id', authUser.id)
        .eq('class_id', parsed.data.classId)
        .eq('status', 'Archived')
        .not('class_cleanup_archived_at', 'is', null);

      if (assignmentsError) throw assignmentsError;

      const restoreUpdates = buildCanvasSemesterRestoreAssignmentUpdates({
        assignments: assignments || [],
      });

      for (const assignment of restoreUpdates) {
        const { error: updateAssignmentError } = await admin
          .from('assignments')
          .update({
            status: assignment.status,
            class_cleanup_archived_at: assignment.class_cleanup_archived_at,
            class_cleanup_previous_status: assignment.class_cleanup_previous_status,
          })
          .eq('user_id', authUser.id)
          .eq('id', assignment.id);

        if (updateAssignmentError) throw updateAssignmentError;
      }

      return jsonResponse({
        classRestored: true,
        assignmentsRestored: restoreUpdates.length,
      }, {}, request);
    }

    if (action === 'sync') {
      const { data: user, error: userError } = await admin
        .from('users')
        .select('canvas_ical_url, subscription_tier, subscription_expires_at, role, simulate_free_tier, lms_sync_count, lms_sync_reset_at')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userError) throw userError;

      if (!user?.canvas_ical_url) {
        return jsonResponse({ error: 'Canvas is not connected. Add your Canvas Calendar Link first.' }, { status: 400 }, request);
      }

      await applyCanvasSyncQuota({
        user,
        adGranted: body.adGranted === true,
        resetSyncState: async (now: Date) => {
          const { error } = await admin
            .from('users')
            .update({
              lms_sync_count: 0,
              lms_sync_reset_at: now.toISOString(),
            })
            .eq('id', authUser.id);

          if (error) throw error;
        },
        incrementSyncCount: async (nextCount: number) => {
          const { error } = await admin
            .from('users')
            .update({ lms_sync_count: nextCount })
            .eq('id', authUser.id);

          if (error) throw error;
        },
      });

      try {
        const result = await syncCanvasCalendarForUser({
          admin,
          userId: authUser.id,
          icalUrl: user.canvas_ical_url,
        });

        const syncedAt = new Date().toISOString();
        const { error: updateError } = await admin
          .from('users')
          .update({
            last_canvas_sync_at: syncedAt,
            last_canvas_auto_sync_error: null,
          })
          .eq('id', authUser.id);

        if (updateError) throw updateError;

        return jsonResponse(result, {}, request);
      } catch (error) {
        if (typeof error === 'object' && error && 'isCanvasFeedError' in error) {
          return jsonResponse({ error: 'Failed to reach Canvas Calendar. Check your link.' }, { status: 502 }, request);
        }

        throw error;
      }
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[canvas-lms edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    if (status >= 500) {
      await reportEdgeException(requestError, { request, functionName: 'canvas-lms' });
    }
    const body: Record<string, unknown> = { error: requestError.message || 'Internal server error' };

    if (typeof requestError.canWatchAd === 'boolean') {
      body.canWatchAd = requestError.canWatchAd;
    }

    return jsonResponse(body, { status }, request);
  }
});
