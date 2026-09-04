import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { createJobReporter, ensureInternalJobAuth, normalizeAiJobError } from '../_shared/aiJobs.ts';
import { buildAiJobRetrySchedule, isRetryableProviderError } from '../_shared/aiJobRetryCore.mjs';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { processAiJob } from '../_shared/aiJobProcessors.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

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

  let jobId = '';
  let jobKind = '';

  try {
    ensureInternalJobAuth(request);

    const body = await request.json().catch(() => ({}));
    jobId = typeof body.jobId === 'string' ? body.jobId : '';
    if (!jobId) {
      return jsonResponse({ error: 'jobId is required.' }, { status: 400 }, request);
    }

    const admin = getSupabaseAdmin();
    const { data: loadedJob, error } = await admin
      .from('ai_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (error) throw error;
    if (!loadedJob) {
      return jsonResponse({ error: 'AI job not found.' }, { status: 404 }, request);
    }
    let job = loadedJob;
    jobKind = typeof job.kind === 'string' ? job.kind : '';

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return jsonResponse({ ok: true, skipped: true }, { status: 200 }, request);
    }

    if (job.status !== 'queued') {
      return jsonResponse({ ok: true, skipped: true, reason: 'already_claimed' }, { status: 200 }, request);
    }
    if (job.next_attempt_at && new Date(job.next_attempt_at).getTime() > Date.now()) {
      return jsonResponse({ ok: true, skipped: true, reason: 'retry_not_due' }, { status: 200 }, request);
    }

    const { data: claimedJob, error: claimError } = await admin
      .from('ai_jobs')
      .update({
        status: 'running',
        started_at: job.started_at || new Date().toISOString(),
        next_attempt_at: null,
      })
      .eq('id', job.id)
      .eq('status', 'queued')
      .select('*')
      .maybeSingle();
    if (claimError) throw claimError;
    if (!claimedJob) {
      return jsonResponse({ ok: true, skipped: true, reason: 'claim_lost' }, { status: 200 }, request);
    }
    job = claimedJob;

    try {
      await processAiJob({ admin, job });
    } catch (error) {
      const retrySchedule = job.kind === 'note_enhancement' && isRetryableProviderError(error)
        ? buildAiJobRetrySchedule({
          createdAt: job.created_at,
          retryUntil: job.retry_until,
          attemptCount: job.attempt_count,
        })
        : null;
      if (retrySchedule) {
        const normalized = normalizeAiJobError(error);
        const { error: retryError } = await admin
          .from('ai_jobs')
          .update({
            status: 'queued',
            phase: 'accepted',
            progress_message: 'Provider temporarily unavailable — retrying automatically',
            attempt_count: retrySchedule.attemptCount,
            next_attempt_at: retrySchedule.nextAttemptAt,
            retry_until: retrySchedule.retryUntil,
            error_payload: {
              ...normalized,
              retry_scheduled: true,
              next_attempt_at: retrySchedule.nextAttemptAt,
            },
          })
          .eq('id', job.id);
        if (retryError) throw retryError;
        return jsonResponse({
          ok: true,
          retryScheduled: true,
          nextAttemptAt: retrySchedule.nextAttemptAt,
        }, { status: 202 }, request);
      }
      await createJobReporter(admin, job).fail(error);
      throw error;
    }

    return jsonResponse({ ok: true }, { status: 200 }, request);
  } catch (error) {
    const requestError = normalizeRequestError(error);
    console.error('[run-ai-job] failed', requestError);
    await reportEdgeException(requestError, {
      request,
      functionName: 'run-ai-job',
      tags: {
        job_id: jobId || undefined,
        job_kind: jobKind || undefined,
      },
    });
    return jsonResponse({
      error: requestError.message || 'Failed to run AI job.',
    }, { status: requestError.status || 500 }, request);
  }
});
