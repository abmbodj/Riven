import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { requestDeepgramTemporaryToken } from '../_shared/transcriptionTokenCore.mjs';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  const rateLimitResponse = await checkRateLimit(request, 'default');
  if (rateLimitResponse) return rateLimitResponse;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    await resolveSupabaseUser(request);
    const result = await requestDeepgramTemporaryToken({
      apiKey: Deno.env.get('DEEPGRAM_API_KEY') || '',
      fetchFn: fetch,
    });

    return jsonResponse({
      token: result.token,
      expires_in: result.expiresIn,
    }, {
      headers: { 'Cache-Control': 'no-store, private' },
    }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    const status = requestError.status || requestError.statusCode || 500;
    if (status >= 500) {
      await reportEdgeException(error, { request, functionName: 'transcription-token' });
    }
    console.error('[transcription-token] request failed', requestError.message);
    return jsonResponse({
      error: status >= 500 ? 'Transcription is temporarily unavailable' : requestError.message,
    }, { status }, request);
  }
});
