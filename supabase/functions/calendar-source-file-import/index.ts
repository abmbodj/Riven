import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { importCalendarSourceEvents } from '../_shared/calendarSourceImport.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const {
      sourceId,
      label,
      color,
      fileName,
      icsText,
      replaceExisting = false,
    } = body ?? {};

    if (!icsText || typeof icsText !== 'string') {
      return jsonResponse({ error: 'icsText is required.' }, { status: 400 }, request);
    }

    if (!fileName || typeof fileName !== 'string') {
      return jsonResponse({ error: 'fileName is required.' }, { status: 400 }, request);
    }

    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();
    const now = new Date();

    let resolvedSourceId = sourceId as string | undefined;

    if (replaceExisting) {
      if (!resolvedSourceId) {
        return jsonResponse({ error: 'sourceId is required to replace a file source.' }, { status: 400 }, request);
      }

      const { data: existingSource, error: sourceError } = await admin
        .from('calendar_sources')
        .select('id, import_mode')
        .eq('id', resolvedSourceId)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (sourceError) throw sourceError;
      if (!existingSource) {
        return jsonResponse({ error: 'Calendar source not found.' }, { status: 404 }, request);
      }
      if (existingSource.import_mode !== 'file') {
        return jsonResponse({ error: 'Only uploaded file sources can be replaced.' }, { status: 400 }, request);
      }

      const { error: updateError } = await admin
        .from('calendar_sources')
        .update({
          file_name: fileName,
          color: color ?? undefined,
          last_synced_at: now.toISOString(),
        })
        .eq('id', resolvedSourceId)
        .eq('user_id', authUser.id);

      if (updateError) throw updateError;
    } else {
      if (!label || typeof label !== 'string') {
        return jsonResponse({ error: 'label is required.' }, { status: 400 }, request);
      }

      const { data: createdSource, error: createError } = await admin
        .from('calendar_sources')
        .insert({
          user_id: authUser.id,
          type: 'ical',
          label,
          color: color ?? null,
          url: null,
          import_mode: 'file',
          file_name: fileName,
          last_synced_at: now.toISOString(),
        })
        .select('id')
        .single();

      if (createError) throw createError;
      resolvedSourceId = createdSource.id;
    }

    const { eventsAdded } = await importCalendarSourceEvents({
      admin,
      userId: authUser.id,
      sourceId: resolvedSourceId!,
      icsText,
      replaceExisting: true,
      now,
    });

    return jsonResponse({
      message: replaceExisting ? 'Calendar file replaced.' : 'Calendar file imported.',
      sourceId: resolvedSourceId,
      eventsAdded,
    }, {}, request);
  } catch (error) {
    await reportEdgeException(error, {
      request,
      functionName: 'calendar-source-file-import',
    });
    console.error('Calendar source file import error:', error);
    return jsonResponse({ error: 'Calendar file import failed. Please try again.' }, { status: 500 }, request);
  }
});
