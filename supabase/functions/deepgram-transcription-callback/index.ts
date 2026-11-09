import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { normalizeDeepgramCallback } from '../_shared/deepgramCallbackCore.mjs';
import { isCallbackTokenValid } from '../_shared/audioJobRecoveryCore.mjs';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const MAX_CALLBACK_BYTES = 25 * 1024 * 1024;

const readBoundedJson = async (request: Request, maxBytes: number) => {
  if (!request.body) return {};
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > maxBytes) {
      await reader.cancel();
      const error = new Error('Callback payload is too large');
      (error as Error & { status?: number }).status = 413;
      throw error;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return JSON.parse(new TextDecoder().decode(bytes));
};

const triggerRunJob = (jobId: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.replace(/\/+$/, '');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const runnerSecret = Deno.env.get('AI_JOB_RUNNER_SECRET');
  if (!supabaseUrl || !serviceRoleKey) return;
  const task = fetch(`${supabaseUrl}/functions/v1/run-ai-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(runnerSecret ? { 'x-ai-job-secret': runnerSecret } : {}),
    },
    body: JSON.stringify({ jobId }),
  }).catch(() => undefined);
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  edgeRuntime?.waitUntil?.(task);
};

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(request) });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);

  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId') || '';
  const callbackToken = url.searchParams.get('token') || '';
  let checkpointStage = '';
  let checkpointAttempt = 0;
  let callbackSessionId = '';
  try {
    const contentLength = Number(request.headers.get('content-length') || 0);
    if (contentLength > MAX_CALLBACK_BYTES) {
      return jsonResponse({ error: 'Callback payload is too large' }, { status: 413 }, request);
    }
    if (!jobId || !callbackToken) {
      return jsonResponse({ error: 'Invalid callback credentials' }, { status: 401 }, request);
    }

    const admin = getSupabaseAdmin();
    const { data: job, error: jobError } = await admin
      .from('ai_jobs')
      .select('*')
      .eq('id', jobId)
      .eq('kind', 'note_enhancement')
      .maybeSingle();
    if (jobError) throw jobError;
    if (!job) return jsonResponse({ error: 'Job not found' }, { status: 404 }, request);

    const resultPayload = job.result_payload && typeof job.result_payload === 'object' ? job.result_payload : {};
    const recovery = resultPayload.recovery && typeof resultPayload.recovery === 'object'
      ? resultPayload.recovery as Record<string, unknown>
      : {};
    checkpointStage = String(recovery.stage || '');
    checkpointAttempt = Number(recovery.submission_attempt || 0);
    const tokenValid = await isCallbackTokenValid(
      callbackToken,
      recovery.callback_token_hash,
      recovery.callback_deadline_at,
    );
    if (!tokenValid) return jsonResponse({ error: 'Invalid or expired callback credentials' }, { status: 401 }, request);

    if (recovery.stage === 'transcript_ready' || job.status === 'completed') {
      return jsonResponse({ ok: true, duplicate: true }, {}, request);
    }

    const payload = await readBoundedJson(request, MAX_CALLBACK_BYTES);
    const normalized = normalizeDeepgramCallback(payload);
    const expectedRequestId = String(recovery.provider_request_id || '');
    if (expectedRequestId && normalized.requestId && expectedRequestId !== normalized.requestId) {
      return jsonResponse({ error: 'Provider request mismatch' }, { status: 409 }, request);
    }
    if (!normalized.segments.length) {
      const now = new Date().toISOString();
      await admin.from('ai_jobs').update({
        status: 'queued',
        phase: 'accepted',
        progress_message: 'Transcript was empty — retrying saved audio',
        next_attempt_at: now,
        result_payload: {
          ...resultPayload,
          recovery: { ...recovery, stage: 'verifying', heartbeat_at: now },
        },
        error_payload: { code: 'DEEPGRAM_EMPTY_TRANSCRIPT', retry_scheduled: true },
      }).eq('id', job.id).eq('status', job.status);
      triggerRunJob(job.id);
      return jsonResponse({ ok: true, retryScheduled: true }, {}, request);
    }

    const input = job.input_payload && typeof job.input_payload === 'object' ? job.input_payload : {};
    const inputSessionId = String(input.sessionId || '');
    const checkpointSessionId = String(recovery.session_id || '');
    if (inputSessionId && checkpointSessionId && inputSessionId !== checkpointSessionId) {
      return jsonResponse({ error: 'Recording session mismatch' }, { status: 409 }, request);
    }
    const sessionId = inputSessionId || checkpointSessionId;
    callbackSessionId = sessionId;
    if (!sessionId) return jsonResponse({ error: 'Recording session is missing' }, { status: 409 }, request);
    const rows = normalized.segments.map((segment: Record<string, unknown>) => ({
      user_id: job.user_id,
      session_id: sessionId,
      provider_segment_id: `${job.id}:${segment.id}`,
      started_at_ms: segment.startMs,
      ended_at_ms: segment.endMs,
      source: 'replay',
      speaker_key: segment.speaker,
      speaker_role: null,
      language_code: segment.language,
      confidence: segment.confidence,
      original_text: segment.text,
      corrected_text: null,
      revision: 1,
      is_deleted: false,
    }));
    for (let offset = 0; offset < rows.length; offset += 400) {
      const { error } = await admin.from('transcript_segments')
        .upsert(rows.slice(offset, offset + 400), { onConflict: 'session_id,provider_segment_id' });
      if (error) throw error;
    }

    const now = new Date().toISOString();
    const { error: sessionError } = await admin.from('recording_sessions').update({
      state: 'transcript_ready',
      transcript_revision: rows.length,
      last_error_code: null,
    }).eq('id', sessionId).eq('user_id', job.user_id);
    if (sessionError) throw sessionError;

    const { data: queuedJob, error: queueError } = await admin.from('ai_jobs').update({
      status: 'queued',
      phase: 'processing_media',
      progress_percent: 38,
      progress_message: 'Saved lecture transcript recovered',
      next_attempt_at: now,
      result_payload: {
        ...resultPayload,
        recovery: {
          ...recovery,
          stage: 'transcript_ready',
          transcript_segment_count: rows.length,
          heartbeat_at: now,
        },
      },
      error_payload: {},
    }).eq('id', job.id).eq('status', job.status).select('id').maybeSingle();
    if (queueError) throw queueError;
    if (queuedJob) triggerRunJob(job.id);
    return jsonResponse({ ok: true }, {}, request);
  } catch (error) {
    const requestError = normalizeRequestError(error);
    await reportEdgeException(requestError, {
      request,
      functionName: 'deepgram-transcription-callback',
      tags: {
        job_id: jobId || undefined,
        session_id: callbackSessionId || undefined,
        checkpoint_stage: checkpointStage || undefined,
        attempt: checkpointAttempt || undefined,
        provider_category: 'deepgram_callback',
      },
    });
    return jsonResponse({ error: requestError.message || 'Callback processing failed' }, { status: requestError.status || 500 }, request);
  }
});
