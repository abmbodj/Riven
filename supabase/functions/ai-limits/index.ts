import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getAiLimitStatus } from '../_shared/aiCore.mjs';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const authUser = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();
    const { data: user, error } = await admin
      .from('users')
      .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) throw error;
    if (!user) {
      return jsonResponse({ error: 'User not found' }, { status: 401 }, request);
    }

    const { remaining, max, characterLimit, flashcardRange, canWatchAd } = getAiLimitStatus({ user });

    return jsonResponse({
      remaining,
      max,
      characterLimit,
      flashcardRange,
      canWatchAd,
    }, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[ai-limits edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    return jsonResponse(
      { error: requestError.message || 'Failed to fetch AI limits' },
      { status },
      request,
    );
  }
});
