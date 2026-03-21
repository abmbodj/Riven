import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import {
  banAdminUser,
  createAdminMessage,
  deleteAdminFeedback,
  deleteAdminMessage,
  deleteAdminUser,
  getAdminStats,
  listAdminFeedback,
  listAdminMessages,
  listAdminReports,
  listAdminUsers,
  requireAdminActor,
  requireOwnerActor,
  setAdminReportStatus,
  thankAdminFeedback,
  toggleAdminFeedbackFavorite,
  updateAdminMessage,
  updateAdminUser,
  updateAdminUserRole,
} from '../_shared/admin.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';

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
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'admin');
  if (rl) return rl;

  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(request.method)) {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const url = new URL(request.url);
    const body = request.method === 'GET' ? {} : await request.json().catch(() => ({}));
    const action = request.method === 'GET' ? url.searchParams.get('action') : body.action;
    const authUser = await resolveSupabaseUser(request);

    if (request.method === 'GET' && action === 'users') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await listAdminUsers(), {}, request);
    }

    if (request.method === 'GET' && action === 'stats') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await getAdminStats(), {}, request);
    }

    if (request.method === 'GET' && action === 'messages') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await listAdminMessages(), {}, request);
    }

    if (request.method === 'GET' && action === 'reports') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await listAdminReports(), {}, request);
    }

    if (request.method === 'GET' && action === 'feedback') {
      await requireOwnerActor(authUser.id);
      return jsonResponse(await listAdminFeedback(), {}, request);
    }

    if (request.method === 'PUT' && action === 'user-role') {
      const actor = await requireOwnerActor(authUser.id);
      return jsonResponse(await updateAdminUserRole(actor, parseId(body.userId, 'userId'), body.role), {}, request);
    }

    if (request.method === 'PUT' && action === 'user-update') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await updateAdminUser(actor, parseId(body.userId, 'userId'), body), {}, request);
    }

    if (request.method === 'PUT' && action === 'message-update') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await updateAdminMessage(parseId(body.messageId ?? body.id, 'messageId'), body), {}, request);
    }

    if (request.method === 'PUT' && action === 'feedback-favorite') {
      await requireOwnerActor(authUser.id);
      return jsonResponse(
        await toggleAdminFeedbackFavorite(
          parseId(body.feedbackId ?? body.id, 'feedbackId'),
          body.isFavorited == null ? undefined : Boolean(body.isFavorited),
        ),
        {},
        request,
      );
    }

    if (request.method === 'POST' && action === 'message-create') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await createAdminMessage(actor, body), { status: 201 }, request);
    }

    if (request.method === 'POST' && action === 'feedback-thank') {
      const actor = await requireOwnerActor(authUser.id);
      return jsonResponse(await thankAdminFeedback(actor, parseId(body.feedbackId ?? body.id, 'feedbackId')), {}, request);
    }

    if (request.method === 'POST' && action === 'report-resolve') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await setAdminReportStatus(actor, parseId(body.reportId, 'reportId'), 'resolved'), {}, request);
    }

    if (request.method === 'POST' && action === 'report-close') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await setAdminReportStatus(actor, parseId(body.reportId, 'reportId'), 'closed'), {}, request);
    }

    if (request.method === 'POST' && action === 'user-ban') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await banAdminUser(actor, parseId(body.userId, 'userId')), {}, request);
    }

    if (request.method === 'DELETE' && action === 'user-delete') {
      const actor = await requireAdminActor(authUser.id);
      return jsonResponse(await deleteAdminUser(actor, parseId(body.userId, 'userId')), {}, request);
    }

    if (request.method === 'DELETE' && action === 'message-delete') {
      await requireAdminActor(authUser.id);
      return jsonResponse(await deleteAdminMessage(parseId(body.messageId ?? body.id, 'messageId')), {}, request);
    }

    if (request.method === 'DELETE' && action === 'feedback-delete') {
      await requireOwnerActor(authUser.id);
      return jsonResponse(await deleteAdminFeedback(parseId(body.feedbackId ?? body.id, 'feedbackId')), {}, request);
    }

    return jsonResponse({ error: 'Unsupported action' }, { status: 400 }, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[admin-actions edge function] error', requestError);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    return jsonResponse(
      { error: requestError.message || 'Internal server error' },
      { status },
      request,
    );
  }
});
