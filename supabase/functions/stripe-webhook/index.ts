import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripe.ts';
import { processStripeWebhookEvent } from '../_shared/stripeWebhookCore.mjs';

type CheckoutUpdatePayload = {
  userId: number;
  tier: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

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

const hasProcessedEvent = async (eventId: string) => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('stripe_processed_events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data?.event_id);
};

const markProcessedEvent = async (eventId: string) => {
  const admin = getSupabaseAdmin();
  const { error: insertError } = await admin
    .from('stripe_processed_events')
    .upsert([{ event_id: eventId }], { onConflict: 'event_id', ignoreDuplicates: true });

  if (insertError) throw insertError;

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
  }: CheckoutUpdatePayload) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .update({
        subscription_tier: tier,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
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

  async downgradeUserByCustomerId(stripeCustomerId: string) {
    const admin = getSupabaseAdmin();
    const { data, error } = await admin
      .from('users')
      .update({ subscription_tier: 'free' })
      .eq('stripe_customer_id', stripeCustomerId)
      .select('id')
      .maybeSingle();

    if (error) throw error;
    return Boolean(data?.id);
  },

  async downgradeUserByEmail(email: string) {
    const admin = getSupabaseAdmin();
    const normalizedEmail = email.toLowerCase();
    const { error } = await admin
      .from('users')
      .update({ subscription_tier: 'free' })
      .eq('email', normalizedEmail);

    if (error) throw error;
  },
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

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

    if (await hasProcessedEvent(event.id)) {
      console.info(`[Stripe Webhook] Skipping duplicate event: ${event.id}`);
      return jsonResponse({ received: true, duplicate: true }, {}, request);
    }

    await processStripeWebhookEvent({
      event,
      stripe,
      persistence,
      logger: console,
    });

    await markProcessedEvent(event.id);

    return jsonResponse({ received: true }, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);

    console.error('[stripe-webhook edge function] error', requestError);
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
