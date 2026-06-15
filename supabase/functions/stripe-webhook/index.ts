import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { processStripeWebhookEvent } from '../_shared/stripeWebhookCore.mjs';

type CheckoutUpdatePayload = {
  userId: number;
  tier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  expiresAt: string | null;
};

const USER_BILLING_STATE_SELECT = 'id, email, role, simulate_free_tier, subscription_tier, subscription_expires_at';

const statusError = (status: number, message: string) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
};

const ensureWebhookEnvironment = () => {
  if (Deno.env.get('NODE_ENV') === 'production') {
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

    if (!stripeSecretKey?.startsWith('sk_live_')) {
      throw statusError(500, 'STRIPE_SECRET_KEY must be a live key in production');
    }

    if (!stripeWebhookSecret?.startsWith('whsec_')) {
      throw statusError(500, 'STRIPE_WEBHOOK_SECRET is required in production');
    }
  }
};

// RIV-027: atomically claim an event before processing. Returns true only if THIS
// call inserted the row (won the claim); a concurrent duplicate delivery gets false.
// This replaces the previous check-then-act sequence, which had a TOCTOU race where
// two concurrent deliveries could both pass the existence check and double-process.
const claimEvent = async (eventId: string): Promise<boolean> => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('stripe_processed_events')
    .upsert([{ event_id: eventId }], { onConflict: 'event_id', ignoreDuplicates: true })
    .select('event_id');

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
};

// Release a previously-claimed event so Stripe's retry can reprocess it after a failure.
const releaseEvent = async (eventId: string) => {
  const admin = getSupabaseAdmin();
  await admin.from('stripe_processed_events').delete().eq('event_id', eventId);
};

const cleanupOldEvents = async () => {
  const admin = getSupabaseAdmin();
  const cutoffIso = new Date(Date.now() - (7 * 24 * 60 * 60 * 1000)).toISOString();
  const { error: cleanupError } = await admin
    .from('stripe_processed_events')
    .delete()
    .lt('processed_at', cutoffIso);

  if (cleanupError) throw cleanupError;
};

const persistence = {
  async updateUserFromCheckout({
    userId,
    tier,
    stripeCustomerId,
    stripeSubscriptionId,
    expiresAt,
  }: CheckoutUpdatePayload) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .update({
        subscription_tier: tier,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        subscription_expires_at: expiresAt ?? null,
      })
      .eq('id', userId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return Boolean(data?.id);
  },

  async getSubscriptionTierByCustomerId(stripeCustomerId: string) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .select('subscription_tier')
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (error) throw error;
    return data?.subscription_tier || null;
  },

  async getUserBillingStateByCustomerId(stripeCustomerId: string) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .select(USER_BILLING_STATE_SELECT)
      .eq('stripe_customer_id', stripeCustomerId)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async getUserBillingStateByEmail(email: string) {
    const admin = getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase();
    const { data, error } = await admin
      .from('users')
      .select(USER_BILLING_STATE_SELECT)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async downgradeUserByCustomerId(stripeCustomerId: string, expiresAt: string | null = null) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .update({ subscription_tier: 'free', subscription_expires_at: expiresAt })
      .eq('stripe_customer_id', stripeCustomerId)
      .select(USER_BILLING_STATE_SELECT)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async downgradeUserByEmail(email: string, expiresAt: string | null = null) {
    const admin = getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase();
    const { data, error } = await admin
      .from('users')
      .update({ subscription_tier: 'free', subscription_expires_at: expiresAt })
      .eq('email', normalizedEmail)
      .select(USER_BILLING_STATE_SELECT)
      .maybeSingle();

    if (error) throw error;
    return data || null;
  },

  async refreshSubscriptionExpiry({
    stripeCustomerId,
    stripeSubscriptionId,
    expiresAt,
  }: { stripeCustomerId: string; stripeSubscriptionId: string; expiresAt: string }) {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('users')
      .update({
        subscription_expires_at: expiresAt,
        stripe_subscription_id: stripeSubscriptionId,
      })
      .eq('stripe_customer_id', stripeCustomerId)
      .eq('subscription_tier', 'supporter');

    if (error) throw error;
  },

  async createUserNotification({
    userId,
    kind,
    title,
    content,
    metadata,
  }: {
    userId: number;
    kind: string;
    title: string;
    content: string;
    metadata?: Record<string, unknown> | null;
  }) {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from('user_notifications')
      .insert([{
        user_id: userId,
        kind,
        title,
        content,
        metadata: metadata ?? {},
      }]);

    if (error) throw error;
  },
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'webhook');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    ensureWebhookEnvironment();

    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!stripeWebhookSecret) {
      throw statusError(503, 'Stripe webhook secret is not configured');
    }

    const signature = request.headers.get('stripe-signature');
    if (!signature) {
      return new Response('Webhook Error: Missing stripe-signature header', {
        status: 400,
        headers: getCorsHeaders(request),
      });
    }

    const rawBody = await request.text();
    const stripe = getStripeClient();

    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, stripeWebhookSecret);
    } catch (error: unknown) {
      const requestError = normalizeRequestError(error);

      console.error('[stripe-webhook edge function] signature verification failed', requestError);
      return new Response(`Webhook Error: ${requestError.message || 'Invalid signature'}`, {
        status: 400,
        headers: getCorsHeaders(request),
      });
    }

    // RIV-027: claim the event up front; a concurrent duplicate delivery loses the race.
    const claimed = await claimEvent(event.id);
    if (!claimed) {
      console.info(`[Stripe Webhook] Skipping duplicate event: ${event.id}`);
      return jsonResponse({ received: true, duplicate: true }, {}, request);
    }

    try {
      await processStripeWebhookEvent({
        event,
        stripe,
        persistence,
        logger: console,
      });
    } catch (processingError) {
      // Release the claim so Stripe's automatic retry can reprocess this event.
      await releaseEvent(event.id).catch(() => {});
      throw processingError;
    }

    // Best-effort cleanup of old idempotency rows after a successful process.
    await cleanupOldEvents().catch(() => {});

    return jsonResponse({ received: true }, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[stripe-webhook edge function] error', requestError);
    await reportEdgeException(requestError, { request, functionName: 'stripe-webhook' });
    const status = typeof requestError.status === 'number'
      ? requestError.status
      : typeof requestError.statusCode === 'number'
        ? requestError.statusCode
        : 500;

    return jsonResponse(
      { error: requestError.message || 'Failed to process Stripe webhook' },
      { status },
      request,
    );
  }
});
