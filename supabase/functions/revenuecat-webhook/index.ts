import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { processRevenueCatWebhookEvent } from '../_shared/revenuecatWebhookCore.mjs';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

/**
 * RevenueCat Webhook — Supabase Edge Function
 *
 * Receives server-to-server notifications from RevenueCat and keeps
 * `users.subscription_tier` in sync.
 *
 * Security: requests must include `Authorization: Bearer <RC_WEBHOOK_SECRET>`.
 * Set RC_WEBHOOK_SECRET via:
 *   npx supabase secrets set RC_WEBHOOK_SECRET=your-long-random-secret
 *
 * In RevenueCat dashboard → Project → Integrations → Webhooks:
 *   URL: https://<project-ref>.supabase.co/functions/v1/revenuecat-webhook
 *   Authorization: Bearer <same secret>
 *
 * Docs: https://www.revenuecat.com/docs/integrations/webhooks/
 */

const USER_STATE_SELECT = 'id, role, simulate_free_tier, subscription_tier, subscription_expires_at';

type UserLookup = {
  matchType: 'supabase_auth_id' | 'id';
  matchValue: string | number;
  user: Record<string, unknown>;
};

const resolveUserLookup = async (admin: ReturnType<typeof getSupabaseAdmin>, appUserId: string) => {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId);
  if (isUuid) {
    const { data, error } = await admin
      .from('users')
      .select(USER_STATE_SELECT)
      .eq('supabase_auth_id', appUserId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) {
      return { matchType: 'supabase_auth_id', matchValue: appUserId, user: data } satisfies UserLookup;
    }
  }

  if (/^\d+$/.test(appUserId)) {
    const numericId = parseInt(appUserId, 10);
    const { data, error } = await admin
      .from('users')
      .select(USER_STATE_SELECT)
      .eq('id', numericId)
      .maybeSingle();

    if (error) throw error;
    if (data?.id) {
      return { matchType: 'id', matchValue: numericId, user: data } satisfies UserLookup;
    }
  }

  return null;
};

const updateUserTier = async (
  admin: ReturnType<typeof getSupabaseAdmin>,
  lookup: { matchType: 'supabase_auth_id' | 'id'; matchValue: string | number },
  nextTier: string,
  expiresAt: string | null = null,
) => {
  const query = admin
    .from('users')
    .update({ subscription_tier: nextTier, subscription_expires_at: expiresAt })
    .select(USER_STATE_SELECT)
    .maybeSingle();

  const { data, error } = lookup.matchType === 'supabase_auth_id'
    ? await query.eq('supabase_auth_id', lookup.matchValue)
    : await query.eq('id', lookup.matchValue);

  if (error) throw error;
  return data || null;
};

const createSubscriptionExpiredNotification = async (
  admin: ReturnType<typeof getSupabaseAdmin>,
  payload: {
    userId: number;
    kind: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  },
) => {
  const { error } = await admin
    .from('user_notifications')
    .insert([{
      user_id: payload.userId,
      kind: payload.kind,
      title: payload.title,
      content: payload.content,
      metadata: payload.metadata ?? {},
    }]);

  if (error) throw error;
};

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const rcWebhookSecret = Deno.env.get('RC_WEBHOOK_SECRET');
    if (!rcWebhookSecret) {
      console.error('[revenuecat-webhook] RC_WEBHOOK_SECRET is not set');
      return jsonResponse({ error: 'Webhook not configured' }, { status: 503 }, request);
    }

    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token !== rcWebhookSecret) {
      console.warn('[revenuecat-webhook] Unauthorized request — token mismatch');
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 }, request);
    }

    // ── Parse event ───────────────────────────────────────────────────────
    const body = await request.json();
    const event = body?.event;
    if (!event) {
      console.warn('[revenuecat-webhook] Missing event payload');
      return jsonResponse({ error: 'Missing event payload' }, { status: 400 }, request);
    }

    const { type, app_user_id: appUserId } = event as { type: string; app_user_id: string };
    console.log(`[revenuecat-webhook] Received event: ${type} for user: ${appUserId}`);

    // ── Update user ───────────────────────────────────────────────────────
    // appUserId = the value passed to Purchases.configure({ appUserID }) in useRevenueCat.js
    // This is the Supabase auth UUID, so look up by supabase_auth_id first.
    const admin = getSupabaseAdmin();
    const persistence = {
      async getUserByAppUserId(targetAppUserId: string) {
        const resolvedUser = await resolveUserLookup(admin, targetAppUserId);
        return resolvedUser?.user || null;
      },
      async updateUserTierByAppUserId(targetAppUserId: string, nextTier: string, expiresAt: string | null = null) {
        const resolvedUser = await resolveUserLookup(admin, targetAppUserId);
        if (!resolvedUser) return null;
        return updateUserTier(admin, resolvedUser, nextTier, expiresAt);
      },
      async createUserNotification(payload: {
        userId: number;
        kind: string;
        title: string;
        content: string;
        metadata?: Record<string, unknown>;
      }) {
        return createSubscriptionExpiredNotification(admin, payload);
      },
    };

    await processRevenueCatWebhookEvent({
      event,
      persistence,
      logger: console,
    });

    return jsonResponse({ received: true }, {}, request);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[revenuecat-webhook] Error:', err.message);
    await reportEdgeException(err, { request, functionName: 'revenuecat-webhook' });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 }, request);
  }
});
