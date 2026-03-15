import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import {
  banAdminUser,
  createAdminMessage,
  deleteAdminMessage,
  deleteAdminUser,
  getAdminStats,
  listAdminMessages,
  listAdminReports,
  listAdminUsers,
  requireAdminActor,
  requireOwnerActor,
  setAdminReportStatus,
  updateAdminMessage,
  updateAdminUser,
  updateAdminUserRole,
} from '../_shared/admin.ts';
import { corsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';

const parseId = (value: unknown, label: string) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    const error = new Error(`${label} must be a valid id`);
    (error as Error & { status?: number }).status = 400;
    throw error;
  }

  return parsed;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const url = new URL(request.url);
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    const action = request.method === 'GET' ? url.searchParams.get('action') : body.action;
    const authUser = await resolveSupabaseUser(request);

    if (request.method === 'GET' && action === 'users') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await listAdminUsers());
    }

    if (request.method === 'GET' && action === 'stats') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await getAdminStats());
    }

    if (request.method === 'GET' && action === 'messages') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await listAdminMessages());
    }

    if (request.method === 'GET' && action === 'reports') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await listAdminReports());
    }

    if (request.method === 'PUT' && action === 'user-role') {
      const actor = await requireOwnerActor(authUser.id);
      return jsonResponse(await updateAdminUserRole(actor, parseId(body.userId, 'userId'), body.role));
    }

    if (request.method === 'PUT' && action === 'user-update') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await updateAdminUser(actor, parseId(body.userId, 'userId'), body));
    }

    if (request.method === 'PUT' && action === 'message-update') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await updateAdminMessage(parseId(body.messageId ?? body.id, 'messageId'), body));
    }

    if (request.method === 'POST' && action === 'message-create') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await createAdminMessage(actor, body), { status: 201 });
    }

    if (request.method === 'POST' && action === 'report-resolve') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await setAdminReportStatus(actor, parseId(body.reportId, 'reportId'), 'resolved'));
    }

    if (request.method === 'POST' && action === 'report-close') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await setAdminReportStatus(actor, parseId(body.reportId, 'reportId'), 'closed'));
    }

    if (request.method === 'POST' && action === 'user-ban') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await banAdminUser(actor, parseId(body.userId, 'userId')));
    }

    if (request.method === 'DELETE' && action === 'user-delete') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await deleteAdminUser(actor, parseId(body.userId, 'userId')));
    }

    if (request.method === 'DELETE' && action === 'message-delete') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await deleteAdminMessage(parseId(body.messageId ?? body.id, 'messageId')));
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 });
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[admin-actions edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    return jsonResponse(
      { error: requestError.message || 'Internal server error' },
      { status },
    );
  }
});
