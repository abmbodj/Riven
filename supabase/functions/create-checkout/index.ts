import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { ALLOWED_PRICES, getStripeClient, getStripeUser, resolveBaseUrl } from '../_shared/stripe.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  try {
    const body = (request.method === 'POST' ? await request.json().catch(() => ({})) : {}) as Record<string, unknown>;
    const priceId = typeof body.priceId === 'string' ? body.priceId : '';

    if (!priceId) {
      return jsonResponse({ error: 'Missing priceId in request body' }, { status: 400 }, request);
    }

    const allowedPrice = ALLOWED_PRICES[priceId as keyof typeof ALLOWED_PRICES];
    if (!allowedPrice) {
      console.warn(`[Stripe] Rejected unknown priceId: ${priceId}`);
      return jsonResponse({ error: 'Invalid price selected.' }, { status: 400 }, request);
    }

    const authUser = await resolveSupabaseUser(request);
    const user = await getStripeUser(authUser.id);

    if (!user.email) {
      return jsonResponse({ error: 'User email is required for checkout' }, { status: 400 }, request);
    }

    const stripe = getStripeClient();
    const baseUrl = resolveBaseUrl(request);

    const sessionParams: Record<string, unknown> = {
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: allowedPrice.mode,
      success_url: `${baseUrl}/account?payment=success`,
      cancel_url: `${baseUrl}/account`,
      client_reference_id: String(user.id),
      customer_email: user.email,
      metadata: {
        userId: String(user.id),
        tier: allowedPrice.tier,
      },
    };

    const testCoupon = Deno.env.get('STRIPE_TEST_COUPON');
    if (testCoupon && Deno.env.get('NODE_ENV') !== 'production') {
      console.warn(`[Stripe] TEST MODE: Applying coupon "${testCoupon}" to checkout`);
      sessionParams.discounts = [{ coupon: testCoupon }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams as any);
    if (!session.url) {
      throw new Error('Failed to create checkout session');
    }

    return jsonResponse({ url: session.url }, {}, request);
  } catch (error) {
    console.error('[create-checkout edge function] error', error);
    const status = typeof error?.statusCode === 'number'
      ? error.statusCode
      : typeof error?.status === 'number'
        ? error.status
        : 500;

    return jsonResponse({ error: error?.message || 'Failed to create checkout session' }, { status }, request);
  }
});
