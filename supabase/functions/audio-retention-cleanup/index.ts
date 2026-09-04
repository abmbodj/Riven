import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { collectExpiredRecordingPaths } from '../_shared/audioRetentionCore.mjs';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const ensureCleanupAuth = (request: Request) => {
  const authorization = request.headers.get('Authorization') || '';
  const bearer = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const cleanupSecret = Deno.env.get('AUDIO_RETENTION_CLEANUP_SECRET') || '';
  const suppliedCleanupSecret = request.headers.get('x-audio-retention-secret') || '';
  if ((serviceRoleKey && bearer === serviceRoleKey)
    || (cleanupSecret && suppliedCleanupSecret === cleanupSecret)) return;
  const error = new Error('Unauthorized');
  (error as Error & { status?: number }).status = 401;
  throw error;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    ensureCleanupAuth(request);
    const admin = getSupabaseAdmin();
    const { data: sessions, error: sessionsError } = await admin
      .from('recording_sessions')
      .select('id, user_id, audio_expires_at')
      .lte('audio_expires_at', new Date().toISOString())
      .is('audio_deleted_at', null)
      .order('audio_expires_at', { ascending: true })
      .limit(100);
    if (sessionsError) throw sessionsError;

    let deletedSessions = 0;
    let deletedChunks = 0;
    for (const session of sessions || []) {
      const { data: chunks, error: chunksError } = await admin
        .from('recording_chunks')
        .select('session_id, storage_path, upload_state')
        .eq('session_id', session.id)
        .neq('upload_state', 'deleted');
      if (chunksError) throw chunksError;

      const paths = collectExpiredRecordingPaths({
        sessionId: session.id,
        userId: session.user_id,
        chunks: chunks || [],
      });
      if (paths.length) {
        const { error: removalError } = await admin.storage.from('recording-chunks').remove(paths);
        if (removalError) throw removalError;
      }
      const deletedAt = new Date().toISOString();
      const { error: chunkUpdateError } = await admin
        .from('recording_chunks')
        .update({ upload_state: 'deleted' })
        .eq('session_id', session.id);
      if (chunkUpdateError) throw chunkUpdateError;
      const { error: sessionUpdateError } = await admin
        .from('recording_sessions')
        .update({ audio_deleted_at: deletedAt })
        .eq('id', session.id);
      if (sessionUpdateError) throw sessionUpdateError;
      deletedSessions += 1;
      deletedChunks += paths.length;
    }

    return jsonResponse({ ok: true, deletedSessions, deletedChunks }, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    await reportEdgeException(error, { request, functionName: 'audio-retention-cleanup' });
    return jsonResponse({
      error: requestError.status === 401 ? 'Unauthorized' : 'Audio retention cleanup failed',
    }, { status: requestError.status || 500 }, request);
  }
});
