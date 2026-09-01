import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { buildStudyCoachSnapshot } from '../_shared/studyCoachCore.mjs';

const getBearerToken = (request: Request) => {
  const custom = request.headers.get('x-supabase-auth')?.trim();
  if (custom) return custom;
  const authorization = request.headers.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    const error = new Error('Missing auth token') as Error & { status?: number };
    error.status = 401;
    throw error;
  }
  return authorization.slice('Bearer '.length);
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const rateLimited = await checkRateLimit(request, 'default');
    if (rateLimited) return rateLimited;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !anonKey) throw new Error('Supabase environment is not configured');

    const token = getBearerToken(request);
    const client = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    // The gateway verifies the JWT (verify_jwt remains enabled) and this client
    // carries it into PostgREST, so every query below is constrained by RLS.
    const { data: profile, error: profileError } = await client
      .from('users')
      .select('id')
      .single();
    if (profileError || !profile?.id) {
      const error = new Error('Account setup required') as Error & { status?: number };
      error.status = 401;
      throw error;
    }

    const userId = profile.id;
    const [guidesResult, assignmentsResult, notesResult, classesResult, statsResult, achievementsResult] = await Promise.all([
      client
        .from('study_guides')
        .select('id, title, class_id, note_id, format_version, guide_data, study_state, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      client
        .from('assignments')
        .select('id, title, class_id, assignment_type, type, due_date, status')
        .eq('user_id', userId)
        .order('due_date', { ascending: true, nullsFirst: false }),
      client
        .from('notes')
        .select('id, title, class_id, updated_at')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false }),
      client
        .from('classes')
        .select('id, name')
        .eq('user_id', userId),
      client
        .from('study_user_stats')
        .select('xp_total, level, sessions_completed, topics_mastered')
        .eq('user_id', userId)
        .maybeSingle(),
      client
        .from('study_achievements')
        .select('achievement_key, unlocked_at, metadata')
        .eq('user_id', userId)
        .order('unlocked_at', { ascending: false }),
    ]);

    const firstError = [
      guidesResult.error,
      assignmentsResult.error,
      notesResult.error,
      classesResult.error,
      statsResult.error,
      achievementsResult.error,
    ].find(Boolean);
    if (firstError) throw firstError;

    return jsonResponse(buildStudyCoachSnapshot({
      guides: guidesResult.data || [],
      assignments: assignmentsResult.data || [],
      notes: notesResult.data || [],
      classes: classesResult.data || [],
      statsRow: statsResult.data || null,
      achievements: achievementsResult.data || [],
    }), { status: 200 }, request);
  } catch (error: unknown) {
    await reportEdgeException(error, { request, functionName: 'study-coach' });
    const normalized = normalizeRequestError(error);
    return jsonResponse(
      { error: normalized.status === 401 ? normalized.message : 'Failed to load study recommendations' },
      { status: normalized.status || 500 },
      request,
    );
  }
});
