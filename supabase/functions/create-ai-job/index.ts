import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { consumeAiQuota } from '../_shared/aiCore.mjs';
import { getYoutubeSourceKey, isAiJobKind } from '../_shared/aiJobs.ts';
import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { assertUserOwnedAudioPath } from '../_shared/notePersistence.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

// Bump deployment artifact so hosted config/runtime definitely rotates.
const getFunctionBaseUrl = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL is required');
  }
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1`;
};

const triggerRunAiJob = (jobId: string) => {
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const runnerSecret = Deno.env.get('AI_JOB_RUNNER_SECRET');

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
  }

  const task = fetch(`${getFunctionBaseUrl()}/run-ai-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(runnerSecret ? { 'x-ai-job-secret': runnerSecret } : {}),
    },
    body: JSON.stringify({ jobId }),
  }).catch((error) => {
    console.error('[create-ai-job] failed to invoke run-ai-job', error);
  });

  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
  }
};

const shouldConsumeQuotaForKind = (kind: string) => (
  kind === 'note_enhancement'
);

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
    const kind = body.kind;
    const payload = body.payload && typeof body.payload === 'object' ? body.payload : {};

    if (!isAiJobKind(kind)) {
      return jsonResponse({ error: 'Invalid AI job kind.' }, { status: 400 }, request);
    }

    const [rateLimitResponse, authUser] = await Promise.all([
      checkRateLimit(request, 'default'),
      resolveSupabaseUser(request),
    ]);
    if (rateLimitResponse) return rateLimitResponse;

    const admin = getSupabaseAdmin();
    let sourceKey: string | null = null;
    let targetType: string | null = null;
    let targetId: string | null = null;

    if (kind === 'note_enhancement') {
      // Audio enhancement needs an audioPath; text-only enhancement needs typed notes.
      const hasUserNotes = typeof payload.userNotesSnapshot === 'string' && payload.userNotesSnapshot.trim().length > 0;
      if (!payload.noteId || (!payload.audioPath && !hasUserNotes)) {
        return jsonResponse({ error: 'noteId and either audioPath or notes are required.' }, { status: 400 }, request);
      }
      targetType = 'note';
      targetId = String(payload.noteId);

      if (payload.audioPath) {
        assertUserOwnedAudioPath(payload.audioPath, authUser.id);
      }

      const { data: note, error: noteError } = await admin
        .from('notes')
        .select('id')
        .eq('id', targetId)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (noteError) throw noteError;
      if (!note) {
        return jsonResponse({ error: 'Note not found.' }, { status: 404 }, request);
      }

      const { data: existingJob } = await admin
        .from('ai_jobs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('kind', 'note_enhancement')
        .eq('target_type', 'note')
        .eq('target_id', targetId)
        .in('status', ['queued', 'running', 'streaming', 'saving'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingJob) {
        return jsonResponse({
          jobId: existingJob.id,
          status: existingJob.status,
          phase: existingJob.phase,
          reused: true,
        }, { status: 200 }, request);
      }
    }

    if (kind === 'youtube_source') {
      if (!payload.youtubeUrl) {
        return jsonResponse({ error: 'youtubeUrl is required.' }, { status: 400 }, request);
      }
      sourceKey = getYoutubeSourceKey(String(payload.youtubeUrl));
      targetType = 'youtube_source';
      targetId = sourceKey;

      const { data: existingSourceJob } = await admin
        .from('ai_jobs')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('kind', 'youtube_source')
        .eq('source_key', sourceKey)
        .in('status', ['queued', 'running', 'streaming', 'saving', 'completed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingSourceJob) {
        // Re-trigger queued jobs that may have missed their initial trigger
        if (existingSourceJob.status === 'queued') {
          triggerRunAiJob(existingSourceJob.id);
        }
        return jsonResponse({
          jobId: existingSourceJob.id,
          status: existingSourceJob.status,
          phase: existingSourceJob.phase,
          sourceKey,
          reused: true,
        }, { status: 200 }, request);
      }
    }

    if (kind.startsWith('youtube_') && kind !== 'youtube_source') {
      if (!payload.sourceJobId || !payload.sourceKey) {
        return jsonResponse({ error: 'sourceJobId and sourceKey are required for YouTube derived jobs.' }, { status: 400 }, request);
      }
      sourceKey = String(payload.sourceKey);
      targetType = kind.replace('youtube_', '');
    }

    if (shouldConsumeQuotaForKind(kind)) {
      const { data: user, error: userError } = await admin
        .from('users')
        .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
        .eq('id', authUser.id)
        .maybeSingle();

      if (userError) throw userError;
      if (!user) {
        return jsonResponse({ error: 'User not found' }, { status: 401 }, request);
      }

      await consumeAiQuota({
        user,
        persistUsage: async ({ count, lastReset }: { count: number; lastReset: Date }) => {
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
    }

    const { data: job, error } = await admin
      .from('ai_jobs')
      .insert({
        user_id: authUser.id,
        kind,
        status: 'queued',
        phase: 'accepted',
        progress_percent: 0,
        progress_message: 'Accepted AI job',
        input_payload: payload,
        source_key: sourceKey,
        target_type: targetType,
        target_id: targetId,
      })
      .select('*')
      .single();

    if (error) throw error;

    triggerRunAiJob(job.id);

    return jsonResponse({
      jobId: job.id,
      status: job.status,
      phase: job.phase,
      sourceKey,
    }, { status: 202 }, request);
  } catch (error) {
    const requestError = normalizeRequestError(error);
    return jsonResponse({
      error: requestError.message || 'Failed to create AI job.',
    }, { status: requestError.status || 500 }, request);
  }
});
