import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { importCalendarSourceEvents } from '../_shared/calendarSourceImport.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { reportEdgeException } from '../_shared/sentry.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { sourceId } = body;

    if (!sourceId) {
      return jsonResponse({ error: 'sourceId is required.' }, { status: 400 }, request);
    }

    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();

    // Load the calendar source, scoped to this user
    const { data: source, error: sourceError } = await admin
      .from('calendar_sources')
      .select('*')
      .eq('id', sourceId)
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (sourceError) throw sourceError;
    if (!source) {
      return jsonResponse({ error: 'Calendar source not found.' }, { status: 404 }, request);
    }
    if (!source.url) {
      return jsonResponse({ error: 'No URL configured for this source.' }, { status: 400 }, request);
    }

    // Fetch and parse the iCal feed
    let icsText = '';
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      icsText = await response.text();
    } catch (fetchErr) {
      return jsonResponse(
        { error: 'Could not reach the calendar URL. Check the link and try again.' },
        { status: 502 },
        request
      );
    }

    const now = new Date();
    const { eventsAdded } = await importCalendarSourceEvents({
      admin,
      userId: authUser.id,
      sourceId,
      icsText,
      now,
    });

    return jsonResponse({ message: 'Sync complete.', eventsAdded }, {}, request);
  } catch (error) {
    await reportEdgeException(error, {
      request,
      functionName: 'calendar-source-sync',
    });
    console.error('Calendar source sync error:', error);
    return jsonResponse({ error: 'Sync failed. Please try again.' }, { status: 500 }, request);
  }
});
