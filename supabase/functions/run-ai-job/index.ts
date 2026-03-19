import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { createJobReporter, ensureInternalJobAuth } from '../_shared/aiJobs.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { processAiJob } from '../_shared/aiJobProcessors.ts';
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

  try {
    ensureInternalJobAuth(request);

    const body = await request.json().catch(() => ({}));
    const jobId = typeof body.jobId === 'string' ? body.jobId : '';
    if (!jobId) {
      return jsonResponse({ error: 'jobId is required.' }, { status: 400 }, request);
    }

    const admin = getSupabaseAdmin();
    const { data: job, error } = await admin
      .from('ai_jobs')
      .select('*')
      .eq('id', jobId)
      .maybeSingle();

    if (error) throw error;
    if (!job) {
      return jsonResponse({ error: 'AI job not found.' }, { status: 404 }, request);
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return jsonResponse({ ok: true, skipped: true }, { status: 200 }, request);
    }

    try {
      await processAiJob({ admin, job });
    } catch (error) {
      await createJobReporter(admin, job).fail(error);
      throw error;
    }

    return jsonResponse({ ok: true }, { status: 200 }, request);
  } catch (error) {
    const requestError = normalizeRequestError(error);
    console.error('[run-ai-job] failed', requestError);
    return jsonResponse({
      error: requestError.message || 'Failed to run AI job.',
    }, { status: requestError.status || 500 }, request);
  }
});
