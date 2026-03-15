import Stripe from 'https://esm.sh/stripe@20.4.0?target=denonext';

import { getSupabaseAdmin } from './supabaseAdmin.ts';

const STRIPE_API_VERSION = '2023-10-16';

export const ALLOWED_PRICES = {
  price_1T6LPsLYlsIF3kiqi3vNu8q5: { tier: 'supporter', mode: 'subscription' },
  price_1T6LQZLYlsIF3kiqrWxurMC7: { tier: 'lifetime', mode: 'payment' },
} as const;

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

export const resolveBaseUrl = (request: Request) => {
  const fallbackBaseUrl = Deno.env.get('CLIENT_URL') || 'http://localhost:5173';
  const origin = request.headers.get('origin') || fallbackBaseUrl;

  return origin.endsWith('/') ? origin.slice(0, -1) : origin;
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
