/**
 * reconcile-subscriptions — daily safety net edge function
 *
 * Triggered by pg_cron (daily at 07:00 UTC) via a POST with bearer secret
 * stored in Vault as 'reconcile_subscriptions_secret'.
 * Can also be called ad-hoc (e.g. just-in-time from a gated endpoint) with
 * a query param `?user_id=<id>` to reconcile a single user.
 *
 * For each 'supporter' whose subscription_expires_at is null or in the past:
 *  1. Re-query the provider (RevenueCat for iOS, Stripe for web).
 *  2. If still active → refresh subscription_expires_at (heals missed renewals).
 *  3. If truly expired → set tier='free', store expiry, create notification.
 *
 * Lifetime / role-based users are never touched.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { getStripeClient } from '../_shared/stripe.ts';

const BATCH_SIZE = 50;

const requireAuth = (authorizationHeader: string) => {
  const expectedSecret = Deno.env.get('RECONCILE_SUBSCRIPTIONS_SECRET')?.trim();
  if (!expectedSecret) {
    throw Object.assign(new Error('Reconcile secret not configured'), { status: 503 });
  }
  const token = authorizationHeader.startsWith('Bearer ')
    ? authorizationHeader.slice(7).trim()
    : '';
  if (token !== expectedSecret) {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
};

/** Fetch the authoritative period end from RevenueCat for one user (by Supabase auth UUID). */
const getRevenueCatExpiry = async (
  rcApiKey: string,
  appUserId: string,
  isSandbox: boolean,
): Promise<{ tier: 'supporter' | 'free'; expiresAt: string | null }> => {
  const resp = await fetch(`https://api.revenuecat.com/v1/subscribers/${appUserId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${rcApiKey}`,
      Accept: 'application/json',
      'X-Is-Sandbox': isSandbox ? 'true' : 'false',
    },
  });

  if (!resp.ok) return { tier: 'free', expiresAt: null };

  const body = await resp.json().catch(() => ({}));
  const entitlements = body?.subscriber?.entitlements ?? {};

  const premiumEnt = entitlements.premium as { expires_date?: string } | undefined;
  if (premiumEnt) {
    if (!premiumEnt.expires_date) return { tier: 'supporter', expiresAt: null };
    const expiry = new Date(premiumEnt.expires_date);
    if (expiry.getTime() > Date.now()) {
      return { tier: 'supporter', expiresAt: expiry.toISOString() };
    }
    return { tier: 'free', expiresAt: expiry.toISOString() };
  }

  // Scan all entitlements.
  for (const ent of Object.values(entitlements as Record<string, { expires_date?: string }>)) {
    if (!ent.expires_date) return { tier: 'supporter', expiresAt: null };
    const expiry = new Date(ent.expires_date);
    if (expiry.getTime() > Date.now()) {
      return { tier: 'supporter', expiresAt: expiry.toISOString() };
    }
  }

  return { tier: 'free', expiresAt: null };
};

/** Fetch the authoritative period end from Stripe (by stripe_customer_id). */
const getStripeExpiry = async (
  stripe: ReturnType<typeof getStripeClient>,
  stripeCustomerId: string,
): Promise<{ tier: 'supporter' | 'free'; expiresAt: string | null }> => {
  const active = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
    limit: 5,
  });
  if (active.data.length > 0) {
    const sub = active.data[0];
    const expiresAt = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;
    return { tier: 'supporter', expiresAt };
  }

  const trialing = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: 'trialing',
    limit: 5,
  });
  if (trialing.data.length > 0) {
    const sub = trialing.data[0];
    const expiresAt = sub.current_period_end
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null;
    return { tier: 'supporter', expiresAt };
  }

  return { tier: 'free', expiresAt: null };
};

type ReconcileUser = {
  id: number;
  role: string;
  simulate_free_tier: boolean;
  subscription_tier: string;
  subscription_expires_at: string | null;
  stripe_customer_id: string | null;
  supabase_auth_id: string | null;
};

type ReconcileResult = {
  userId: number;
  action: 'skipped' | 'refreshed' | 'downgraded' | 'error';
  reason?: string;
};

const reconcileUser = async (
  user: ReconcileUser,
  admin: ReturnType<typeof getSupabaseAdmin>,
  stripe: ReturnType<typeof getStripeClient> | null,
  rcApiKey: string | null,
  isSandbox: boolean,
): Promise<ReconcileResult> => {
  const userId = user.id;

  // Check expiry: null means not-yet-backfilled (treat as needs re-check),
  // or future (still valid → skip).
  const expiresAt = user.subscription_expires_at;
  if (expiresAt !== null && new Date(expiresAt).getTime() > Date.now()) {
    return { userId, action: 'skipped', reason: 'not-yet-expired' };
  }

  // Determine provider and fetch authoritative state.
  let providerResult: { tier: 'supporter' | 'free'; expiresAt: string | null } | null = null;

  if (user.supabase_auth_id && rcApiKey) {
    try {
      providerResult = await getRevenueCatExpiry(rcApiKey, user.supabase_auth_id, isSandbox);
    } catch {
      // Fall through to Stripe.
    }
  }

  if (!providerResult && user.stripe_customer_id && stripe) {
    try {
      providerResult = await getStripeExpiry(stripe, user.stripe_customer_id);
    } catch {
      return { userId, action: 'error', reason: 'provider-fetch-failed' };
    }
  }

  if (!providerResult) {
    return { userId, action: 'error', reason: 'no-provider-configured' };
  }

  if (providerResult.tier === 'supporter') {
    // Still active — refresh the expiry window (heals missed renewal webhooks).
    const { error } = await admin
      .from('users')
      .update({ subscription_expires_at: providerResult.expiresAt })
      .eq('id', userId);

    if (error) return { userId, action: 'error', reason: error.message };
    return { userId, action: 'refreshed' };
  }

  // Truly expired — downgrade.
  const { data: updatedUser, error: updateError } = await admin
    .from('users')
    .update({
      subscription_tier: 'free',
      subscription_expires_at: providerResult.expiresAt,
    })
    .eq('id', userId)
    .select('id, subscription_tier, subscription_expires_at, role, simulate_free_tier')
    .maybeSingle();

  if (updateError) return { userId, action: 'error', reason: updateError.message };

  // Create expired notification (idempotent via ON CONFLICT DO NOTHING on kind+user_id if desired,
  // but user_notifications has no such constraint — the UI dismisses them, so duplicates are fine
  // as long as the cron runs once per day).
  if (updatedUser) {
    await admin.from('user_notifications').insert([{
      user_id: userId,
      kind: 'subscription_expired',
      title: 'Your Pro access has ended',
      content: 'Your billing period has ended, so paid Pro features are no longer active on this account.',
      metadata: {
        source: 'reconcile',
        previousTier: 'supporter',
        currentTier: 'free',
        reconciledAt: new Date().toISOString(),
      },
    }]).then(() => {}).catch(() => {});
  }

  return { userId, action: 'downgraded' };
};

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    requireAuth(request.headers.get('authorization') ?? '');

    const admin = getSupabaseAdmin();
    const rcApiKey = Deno.env.get('RC_SECRET_KEY') || null;
    const isSandbox = Deno.env.get('REVENUECAT_SANDBOX') === 'true';

    let stripe: ReturnType<typeof getStripeClient> | null = null;
    try {
      stripe = getStripeClient();
    } catch {
      console.warn('[reconcile-subscriptions] Stripe not configured, skipping Stripe lookups');
    }

    const url = new URL(request.url);
    const singleUserId = url.searchParams.get('user_id');

    // Build the query — either one user (JIT) or the full lapsed-supporter batch (cron).
    const query = admin
      .from('users')
      .select('id, role, simulate_free_tier, subscription_tier, subscription_expires_at, stripe_customer_id, supabase_auth_id')
      .eq('subscription_tier', 'supporter')
      // Exclude role-based users who never expire.
      .not('role', 'in', '("owner","admin","friends")');

    if (singleUserId) {
      query.eq('id', parseInt(singleUserId, 10));
    } else {
      // Supporters with null expiry (never backfilled) OR expired.
      query.or(`subscription_expires_at.is.null,subscription_expires_at.lte.${new Date().toISOString()}`);
      query.limit(BATCH_SIZE);
    }

    const { data: users, error: fetchError } = await query as unknown as {
      data: ReconcileUser[] | null;
      error: { message: string } | null;
    };

    if (fetchError) {
      console.error('[reconcile-subscriptions] Failed to fetch users:', fetchError.message);
      return jsonResponse({ error: 'Failed to fetch users', details: fetchError }, { status: 500 }, request);
    }

    if (!users || users.length === 0) {
      return jsonResponse({ reconciled: 0, results: [] }, {}, request);
    }

    const results: ReconcileResult[] = [];
    for (const user of users) {
      const result = await reconcileUser(user, admin, stripe, rcApiKey, isSandbox);
      results.push(result);
      if (result.action !== 'skipped') {
        console.log(`[reconcile-subscriptions] user=${result.userId} action=${result.action}${result.reason ? ` reason=${result.reason}` : ''}`);
      }
    }

    const summary = results.reduce(
      (acc, r) => { acc[r.action] = (acc[r.action] || 0) + 1; return acc; },
      {} as Record<string, number>,
    );

    return jsonResponse({ reconciled: results.length, summary, results }, {}, request);
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    const status = (err as { status?: number }).status;
    if (status === 401 || status === 503) {
      return jsonResponse({ error: err.message }, { status }, request);
    }
    console.error('[reconcile-subscriptions] Error:', err.message);
    await reportEdgeException(err, { request, functionName: 'reconcile-subscriptions' });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 }, request);
  }
});
