import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { ensureInternalJobAuth } from '../_shared/aiJobs.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const runJob = async (jobId: string) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const runnerSecret = Deno.env.get('AI_JOB_RUNNER_SECRET');
  if (!supabaseUrl || !serviceRoleKey) throw new Error('Supabase runner configuration is missing');

  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/run-ai-job`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceRoleKey}`,
      ...(runnerSecret ? { 'x-ai-job-secret': runnerSecret } : {}),
    },
    body: JSON.stringify({ jobId }),
  });
  if (!response.ok) {
    throw new Error(`run-ai-job returned ${response.status}`);
  }
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    ensureInternalJobAuth(request);
    const admin = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { error: expiryError } = await admin
      .from('ai_jobs')
      .update({
        status: 'failed',
        phase: 'error',
        progress_message: 'Provider remained unavailable for 24 hours',
        completed_at: now,
      })
      .eq('kind', 'note_enhancement')
      .eq('status', 'queued')
      .not('next_attempt_at', 'is', null)
      .lte('retry_until', now);
    if (expiryError) throw expiryError;

    const { data: jobs, error } = await admin
      .from('ai_jobs')
      .select('id')
      .eq('kind', 'note_enhancement')
      .eq('status', 'queued')
      .not('next_attempt_at', 'is', null)
      .lte('next_attempt_at', now)
      .gt('retry_until', now)
      .order('next_attempt_at', { ascending: true })
      .limit(20);
    if (error) throw error;

    const settled = await Promise.allSettled((jobs || []).map((job: { id: string }) => runJob(job.id)));
    const dispatched = settled.filter((result) => result.status === 'fulfilled').length;
    const failedDispatches = settled.length - dispatched;
    if (failedDispatches > 0) {
      await reportEdgeException(new Error('One or more queued AI retries failed to dispatch'), {
        request,
        functionName: 'retry-ai-jobs',
        extras: { queued: settled.length, failedDispatches },
      });
    }

    return jsonResponse({ ok: true, queued: settled.length, dispatched, failedDispatches }, {}, request);
  } catch (error) {
    const requestError = normalizeRequestError(error);
    if ((requestError.status || 500) >= 500) {
      await reportEdgeException(error, { request, functionName: 'retry-ai-jobs' });
    }
    return jsonResponse({
      error: requestError.message || 'Failed to dispatch AI retries',
    }, { status: requestError.status || 500 }, request);
  }
});
