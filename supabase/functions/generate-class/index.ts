import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { Buffer } from 'node:buffer';
import mammoth from 'npm:mammoth@1.11.0';

import { consumeAiQuota, generateClassPreview } from '../_shared/aiCore.mjs';
import { createAiClient, contentsToMessages } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
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

    await consumeAiQuota({
      user,
      persistUsage: async ({ count, lastReset }: PersistUsagePayload) => {
        const { error: updateError } = await admin
          .from('users')
          .update({
            ai_generations_count: count,
            last_ai_generation_reset: lastReset.toISOString(),
          })
          .eq('id', authUser.id);

        if (updateError) throw updateError;
      },
    });

    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';

    const result = await generateClassPreview({
      notes: body.notes,
      file: body.file,
      apiKey,
      parseDocx: async (buffer: Buffer) => {
        const parsed = await mammoth.extractRawText({ buffer });
        return parsed.value;
      },
      generateContent: async ({ model, contents }: { model: string; contents: Array<Record<string, unknown>> }) => {
        const ai = createAiClient(apiKey);
        return ai.generateContent({
          model,
          messages: contentsToMessages(contents),
          responseFormat: 'json_object',
        });
      },
      onParseError: (error: unknown) => {
        console.error('Failed to parse document text:', error);
      },
    });

    return jsonResponse(result, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[generate-class edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const body: Record<string, unknown> = {
      error: typeof requestError.status === 'number'
        ? requestError.message
        : `An error occurred: ${requestError.message || 'Unknown server error'}`,
    };

    if (typeof requestError.canWatchAd === 'boolean') {
      body.canWatchAd = requestError.canWatchAd;
    }

    return jsonResponse(body, { status }, request);
  }
});
