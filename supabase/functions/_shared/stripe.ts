import Stripe from 'https://esm.sh/stripe@20.4.0?target=denonext';

import { getSupabaseAdmin } from './supabaseAdmin.ts';

const STRIPE_API_VERSION = '2023-10-16';

const DEFAULT_MONTHLY_PRICE_ID = 'price_1T6LPsLYlsIF3kiqi3vNu8q5';

/** Built at cold start from env. Set STRIPE_PRICE_ANNUAL in Supabase to your yearly recurring price id. */
export const ALLOWED_PRICES: Record<string, { tier: 'supporter'; mode: 'subscription' }> = (() => {
  const monthlyId = (Deno.env.get('STRIPE_PRICE_MONTHLY') || '').trim() || DEFAULT_MONTHLY_PRICE_ID;
  const annualId = (Deno.env.get('STRIPE_PRICE_ANNUAL') || '').trim();
  const map: Record<string, { tier: 'supporter'; mode: 'subscription' }> = {
    [monthlyId]: { tier: 'supporter', mode: 'subscription' },
  };
  if (annualId) {
    map[annualId] = { tier: 'supporter', mode: 'subscription' };
  }
  return map;
})();

const statusError = (status: number, message: string) => {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
};

export const getStripeClient = () => {
  const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');

  if (!stripeSecretKey) {
    throw statusError(503, 'Stripe is not configured');
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
  });
};

const trimTrailingSlash = (url: string) => (url.endsWith('/') ? url.slice(0, -1) : url);

/** True for http://localhost or http://127.0.0.1 (Stripe test / local dev). */
const isLocalHttpOrigin = (origin: string) => {
  try {
    const u = new URL(origin);
    return u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
  } catch {
    return false;
  }
};

/**
 * Stripe success/cancel/return URLs must be valid https origins in production.
 * Capacitor and Ionic WebViews send origins like capacitor://localhost, which Stripe rejects.
 * Prefer CLIENT_URL for those and for non-local http origins.
 */
export const resolveBaseUrl = (request: Request) => {
  const fallbackBaseUrl = trimTrailingSlash(Deno.env.get('CLIENT_URL') || 'http://localhost:5173');
  const rawOrigin = request.headers.get('origin');

  if (!rawOrigin) return fallbackBaseUrl;

  const origin = trimTrailingSlash(rawOrigin);

  if (
    origin.startsWith('capacitor://') ||
    origin.startsWith('ionic://') ||
    origin.startsWith('file://')
  ) {
    return fallbackBaseUrl;
  }

  if (origin.startsWith('https://')) return origin;

  if (isLocalHttpOrigin(origin)) return origin;

  return fallbackBaseUrl;
};

export const getStripeUser = async (userId: number) => {
  const admin = getSupabaseAdmin();
  const { data, error } = await admin
    .from('users')
    .select('id, email, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw statusError(404, 'User not found');

  return data as {
    id: number;
    email: string | null;
    stripe_customer_id: string | null;
  };
};
