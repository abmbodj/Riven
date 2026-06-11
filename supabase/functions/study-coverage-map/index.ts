import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { buildCoverageMap } from '../_shared/studyGuideCore.mjs';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const classId = typeof body.classId === 'string' && body.classId.trim() ? body.classId.trim() : null;

    // Parallel: rate limit + auth (read-only aggregation, no quota consumed).
    const [rl, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const admin = getSupabaseAdmin();
    let query = admin
      .from('study_guides')
      .select('id, title, class_id, guide_data, study_state')
      .eq('user_id', authUser.id);
    if (classId) {
      query = query.eq('class_id', classId);
    }

    const { data: guides, error } = await query;
    if (error) throw error;

    const coverage = buildCoverageMap({ guides: guides || [] });

    return jsonResponse(coverage, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[study-coverage-map edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse(
      { error: requestError.message || 'Failed to build coverage map' },
      { status },
      request,
    );
  }
});
