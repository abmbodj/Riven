import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
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

/** Map RC event type → subscription_tier.  Returns null = no change needed. */
function tierFromEvent(type: string): string | null {
  switch (type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'NON_RENEWING_PURCHASE':
    case 'UNCANCELLATION':
    case 'TRANSFER':
      return 'supporter';

    case 'CANCELLATION':
    case 'EXPIRATION':
    case 'BILLING_ISSUE':
      return 'free';

    // No tier change for these events
    case 'SUBSCRIBER_ALIAS':
    case 'PRODUCT_CHANGE':
    default:
      return null;
  }
}

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

    // ── Resolve target tier ───────────────────────────────────────────────
    const newTier = tierFromEvent(type);
    if (newTier === null) {
      console.info(`[revenuecat-webhook] No tier change needed for event: ${type}`);
      return jsonResponse({ received: true }, {}, request);
    }

    // ── Update user ───────────────────────────────────────────────────────
    // appUserId = the value passed to Purchases.configure({ appUserID }) in useRevenueCat.js
    // This is the Supabase auth UUID, so look up by supabase_auth_id first.
    const admin = getSupabaseAdmin();

    let updated = false;

    // 1. Try supabase_auth_id (primary — UUID from Supabase auth)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appUserId);
    if (isUuid) {
      const { data: byAuthId, error: authIdError } = await admin
        .from('users')
        .update({ subscription_tier: newTier })
        .eq('supabase_auth_id', appUserId)
        .select('id')
        .maybeSingle();

      if (authIdError) throw authIdError;
      if (byAuthId?.id) {
        updated = true;
        console.info(`[revenuecat-webhook] ✅ Updated user ${appUserId} (supabase_auth_id) → ${newTier}`);
      }
    }

    // 2. Fallback: numeric users.id (legacy / test app user IDs)
    if (!updated && /^\d+$/.test(appUserId)) {
      const { data: byId, error: byIdError } = await admin
        .from('users')
        .update({ subscription_tier: newTier })
        .eq('id', parseInt(appUserId, 10))
        .select('id')
        .maybeSingle();

      if (byIdError) throw byIdError;
      if (byId?.id) {
        updated = true;
        console.info(`[revenuecat-webhook] ✅ Updated user ${appUserId} (numeric id) → ${newTier}`);
      }
    }

    if (!updated) {
      console.error(`[revenuecat-webhook] ❌ User not found: ${appUserId}`);
    }

    return jsonResponse({ received: true }, {}, request);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[revenuecat-webhook] Error:', err.message);
    await reportEdgeException(err, { request, functionName: 'revenuecat-webhook' });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 }, request);
  }
});
