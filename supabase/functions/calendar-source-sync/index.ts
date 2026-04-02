import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import nodeIcal from 'npm:node-ical@0.25.4';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { reportEdgeException } from '../_shared/sentry.ts';

const EXAM_PATTERN = /\b(test|quiz|exam|midterm|final|assessment)\b/i;

const ical = nodeIcal as typeof nodeIcal & {
  async?: {
    parseICS?: (data: string) => Promise<Record<string, unknown>>;
  };
};

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
    let events: Record<string, unknown>;
    try {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      events = (await ical.async?.parseICS?.(text)) ?? {};
    } catch (fetchErr) {
      return jsonResponse(
        { error: 'Could not reach the calendar URL. Check the link and try again.' },
        { status: 502 },
        request
      );
    }

    // Load existing events from this source to avoid re-inserting
    const { data: existingRows } = await admin
      .from('assignments')
      .select('canvas_assignment_id')
      .eq('user_id', authUser.id)
      .eq('calendar_source_id', sourceId)
      .not('canvas_assignment_id', 'is', null);

    const existingUids = new Set(
      (existingRows || []).map((r: { canvas_assignment_id: string }) => r.canvas_assignment_id)
    );

    const now = new Date();
    const toInsert: Array<Record<string, unknown>> = [];

    for (const k in events) {
      const ev = events[k] as Record<string, unknown>;
      if (ev.type !== 'VEVENT') continue;

      const uid = ev.uid as string | undefined;
      if (!uid || existingUids.has(uid)) continue;

      const summary = (ev.summary as string | undefined) ?? 'Untitled Event';
      const description = (ev.description as string | undefined) ?? '';
      const rawDue = (ev.end ?? ev.start) as Date | string | undefined;
      if (!rawDue) continue;

      const parsedDue = rawDue instanceof Date ? rawDue : new Date(String(rawDue));
      if (isNaN(parsedDue.getTime())) continue;

      const daysPastDue = (now.getTime() - parsedDue.getTime()) / (1000 * 60 * 60 * 24);
      const status = daysPastDue > 7 ? 'Archived' : 'Todo';
      const assignmentType = EXAM_PATTERN.test(summary) ? 'exam' : 'assignment';

      toInsert.push({
        user_id: authUser.id,
        title: summary,
        description,
        due_date: parsedDue.toISOString(),
        status,
        assignment_type: assignmentType,
        calendar_source_id: sourceId,
        canvas_assignment_id: uid,
      });

      existingUids.add(uid);
    }

    let eventsAdded = 0;
    if (toInsert.length > 0) {
      const { error: insertError } = await admin
        .from('assignments')
        .insert(toInsert);

      if (insertError && insertError.code !== '23505') throw insertError;
      eventsAdded = toInsert.length;
    }

    // Update last_synced_at
    await admin
      .from('calendar_sources')
      .update({ last_synced_at: now.toISOString() })
      .eq('id', sourceId);

    return jsonResponse({ message: 'Sync complete.', eventsAdded }, {}, request);
  } catch (error) {
    reportEdgeException(error);
    console.error('Calendar source sync error:', error);
    return jsonResponse({ error: 'Sync failed. Please try again.' }, { status: 500 }, request);
  }
});
