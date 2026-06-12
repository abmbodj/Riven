import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    const attemptId = typeof body.attemptId === 'string' ? body.attemptId.trim() : '';
    if (!attemptId) {
      return jsonResponse({ error: 'attemptId is required' }, { status: 400 }, request);
    }

    const [rl, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const admin = getSupabaseAdmin();
    const { data: awardResult, error: awardError } = await admin.rpc('award_exam_attempt_xp', {
      target_attempt_id: attemptId,
      target_user_id: authUser.id,
    });
    if (awardError) throw awardError;
    if (awardResult?.notFound) {
      return jsonResponse({ error: 'Exam attempt not found' }, { status: 404 }, request);
    }

    return jsonResponse(awardResult, { status: 200 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[exam-complete edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    return jsonResponse({ error: requestError.message || 'Failed to award exam XP' }, { status }, request);
  }
});
