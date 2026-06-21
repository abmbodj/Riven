import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { Buffer } from 'node:buffer';
import mammoth from 'npm:mammoth@1.11.0';

import {
  consumeAiQuota,
  prepareAiSource,
  buildBlueprintContents,
  ensureApiKey,
  parseAiJsonResponse,
  createHttpError,
  aiModelMap,
} from '../_shared/aiCore.mjs';
import { createAiClient, contentsToMessages } from '../_shared/aiClient.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

type PersistUsagePayload = {
  count: number;
  lastReset: Date;
};

// Analyze an uploaded past exam (photo/scan via vision, or .docx/.txt/pasted text) into a
// reusable, class-linked "style profile" that later shapes generated mock exams.
serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.headers.get('x-warmup') === '1') {
    return new Response('ok', { status: 200, headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));

    const [rl, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rl) return rl;

    const admin = getSupabaseAdmin();
    const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
    ensureApiKey(apiKey);

    const { data: user, error } = await admin
      .from('users')
      .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier, subscription_expires_at')
      .eq('id', authUser.id)
      .maybeSingle();
    if (error) throw error;
    if (!user) {
      return jsonResponse({ error: 'User not found' }, { status: 401 }, request);
    }

    const aiLimitsContext = await consumeAiQuota({
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
    void aiLimitsContext;

    const source = await prepareAiSource({
      notes: body.notes,
      file: body.file,
      parseDocx: async (buffer: Buffer) => {
        const parsed = await mammoth.extractRawText({ buffer });
        return parsed.value;
      },
      onParseError: (err: unknown) => console.error('Failed to parse document text:', err),
    });

    if (!source.hasProcessedNotes && !source.keepFile) {
      throw createHttpError('Upload a photo of your exam, or a .docx / .txt file, to build a blueprint.', 400);
    }

    const contents = buildBlueprintContents({
      processedNotes: source.processedNotes,
      hasProcessedNotes: source.hasProcessedNotes,
      keepFile: source.keepFile,
      file: body.file,
    });

    const ai = createAiClient(apiKey);
    const raw = await ai.generateContent({
      model: aiModelMap.blueprint,
      messages: contentsToMessages(contents),
      maxTokens: 1500,
    });

    const profile = parseAiJsonResponse(
      raw,
      'Could not read that exam. Try a clearer photo, or upload a .docx / .txt.',
    );
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)) {
      throw createHttpError('Could not extract a blueprint from that file.', 422);
    }

    const name = typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : (typeof body.sourceExamTitle === 'string' && body.sourceExamTitle.trim()) || 'Exam blueprint';

    const { data: blueprint, error: insertError } = await admin
      .from('exam_blueprints')
      .insert({
        user_id: authUser.id,
        class_id: body.classId || null,
        name,
        profile,
        source_exam_title: body.sourceExamTitle || null,
      })
      .select('*')
      .single();
    if (insertError) throw insertError;

    return jsonResponse({ blueprint }, { status: 201 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    console.error('[extract-exam-blueprint edge function] error', requestError);
    await reportEdgeException(requestError, { request, functionName: 'extract-exam-blueprint' });
    const status = typeof requestError.status === 'number' ? requestError.status : 500;
    const responseBody: Record<string, unknown> = {
      error: typeof requestError.status === 'number'
        ? requestError.message
        : 'An unexpected error occurred while reading the exam.',
    };
    if (typeof requestError.canWatchAd === 'boolean') {
      responseBody.canWatchAd = requestError.canWatchAd;
    }
    return jsonResponse(responseBody, { status }, request);
  }
});
