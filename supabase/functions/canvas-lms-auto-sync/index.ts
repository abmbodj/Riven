import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { runCanvasAutoSyncBatch, requireCanvasAutoSyncAuth } from '../_shared/canvasLmsAutoSyncCore.mjs';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { syncCanvasCalendarForUser } from '../_shared/canvasLmsSync.ts';

const DEFAULT_QUERY_LIMIT = 100;
const DEFAULT_BATCH_SIZE = 25;

const readPositiveIntEnv = (key: string, fallback: number) => {
  const raw = Number.parseInt(Deno.env.get(key) || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    requireCanvasAutoSyncAuth({
      authorizationHeader: request.headers.get('authorization') ?? '',
      expectedSecret: Deno.env.get('CANVAS_AUTO_SYNC_SECRET')?.trim(),
    });

    const admin = getSupabaseAdmin();
    const queryLimit = readPositiveIntEnv('CANVAS_AUTO_SYNC_QUERY_LIMIT', DEFAULT_QUERY_LIMIT);
    const batchSize = readPositiveIntEnv('CANVAS_AUTO_SYNC_BATCH_SIZE', DEFAULT_BATCH_SIZE);
    const now = new Date();

    const { data: users, error } = await admin
      .from('users')
      .select([
        'id',
        'canvas_ical_url',
        'canvas_auto_sync_enabled',
        'subscription_tier',
        'subscription_expires_at',
        'role',
        'simulate_free_tier',
        'last_canvas_sync_at',
        'last_canvas_auto_sync_attempt_at',
      ].join(', '))
      .not('canvas_ical_url', 'is', null)
      .eq('canvas_auto_sync_enabled', true)
      .order('last_canvas_sync_at', { ascending: true })
      .limit(queryLimit);

    if (error) throw error;

    const result = await runCanvasAutoSyncBatch({
      users: users || [],
      now,
      batchSize,
      updateUserState: async (userId: number, updates: Record<string, string | null>) => {
        const { error: updateError } = await admin
          .from('users')
          .update(updates)
          .eq('id', userId);

        if (updateError) throw updateError;
      },
      syncUser: async (user: { id: number; canvas_ical_url: string }) => await syncCanvasCalendarForUser({
        admin,
        userId: user.id,
        icalUrl: user.canvas_ical_url,
        now,
      }),
      reportError: async (error: unknown, user: { id: number; canvas_ical_url: string }) => {
        await reportEdgeException(error, {
          request,
          functionName: 'canvas-lms-auto-sync',
          tags: {
            user_id: user.id,
          },
          extras: {
            canvasIcalUrl: user.canvas_ical_url,
          },
        });
      },
    });

    return jsonResponse({
      ok: true,
      ...result,
    }, { status: 200 }, request);
  } catch (error) {
    const requestError = normalizeRequestError(error);
    console.error('[canvas-lms-auto-sync] failed', requestError);

    if (requestError.status !== 401) {
      await reportEdgeException(requestError, {
        request,
        functionName: 'canvas-lms-auto-sync',
      });
    }

    return jsonResponse({
      error: requestError.message || 'Failed to auto-sync Canvas assignments.',
    }, { status: requestError.status || 500 }, request);
  }
});
