import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import nodeIcal from 'npm:node-ical@0.25.4';

import {
  applyCanvasSyncQuota,
  syncCanvasCalendar,
  validateCanvasFeedUrl,
} from '../_shared/canvasLmsCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { canvasConnectSchema } from '../_shared/validation.ts';

type CanvasAssignment = {
  title: string;
  description: string;
  dueDateIso: string | null;
  status: string;
  uid: string;
};

const ical = nodeIcal as typeof nodeIcal & {
  async?: {
    parseICS?: (data: string) => Promise<Record<string, unknown>>;
  };
};

const parseCanvasCalendar = async (icalUrl: string) => {
  const response = await fetch(icalUrl);
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  return await ical.async?.parseICS?.(text);
};

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
        })
        .eq('id', authUser.id);

      if (error) throw error;

      return jsonResponse({ message: 'Canvas connected successfully.' }, {}, request);
    }

    if (action === 'disconnect') {
      const { error } = await admin
        .from('users')
        .update({ canvas_ical_url: null })
        .eq('id', authUser.id);

      if (error) throw error;

      return jsonResponse({ message: 'Canvas disconnected.' }, {}, request);
    }

    if (action === 'sync') {
      const { data: user, error: userError } = await admin
        .from('users')
        .select('canvas_ical_url, subscription_tier, role, simulate_free_tier, lms_sync_count, lms_sync_reset_at')
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

      let events;
      try {
        events = await parseCanvasCalendar(user.canvas_ical_url);
      } catch {
        return jsonResponse({ error: 'Failed to reach Canvas Calendar. Check your link.' }, { status: 502 }, request);
      }

      const [
        { data: existingClasses, error: classesError },
        { data: existingAssignments, error: assignmentsError },
      ] = await Promise.all([
        admin
          .from('classes')
          .select('id, name')
          .eq('user_id', authUser.id),
        admin
          .from('assignments')
          .select('canvas_assignment_id')
          .eq('user_id', authUser.id)
          .not('canvas_assignment_id', 'is', null),
      ]);

      if (classesError) throw classesError;
      if (assignmentsError) throw assignmentsError;

      const syncedAssignments = (existingAssignments || []) as Array<{
        canvas_assignment_id: string | null;
      }>;

      const result = await syncCanvasCalendar({
        userId: authUser.id,
        events: events || {},
        existingClasses: existingClasses || [],
        existingAssignmentIds: syncedAssignments.map((assignment) => assignment.canvas_assignment_id),
        createClass: async (userId: number, courseName: string) => {
          const { data, error } = await admin
            .from('classes')
            .insert({
              user_id: userId,
              name: courseName,
              color: '#4f46e5',
            })
            .select('id')
            .single();

          if (error) throw error;
          return data;
        },
        createAssignment: async (
          userId: number,
          classId: number | string,
          assignment: CanvasAssignment,
        ) => {
          const { error } = await admin
            .from('assignments')
            .insert({
              user_id: userId,
              class_id: classId,
              title: assignment.title,
              description: assignment.description,
              due_date: assignment.dueDateIso,
              status: assignment.status,
              canvas_assignment_id: assignment.uid,
            });

          if (error) throw error;
        },
      });

      return jsonResponse(result, {}, request);
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[canvas-lms edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const body: Record<string, unknown> = { error: requestError.message || 'Internal server error' };

    if (typeof requestError.canWatchAd === 'boolean') {
      body.canWatchAd = requestError.canWatchAd;
    }

    return jsonResponse(body, { status }, request);
  }
});
