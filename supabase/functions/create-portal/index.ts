import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { getStripeClient, getStripeUser, resolveBaseUrl } from '../_shared/stripe.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  try {
    const authUser = await resolveSupabaseUser(request);
    const user = await getStripeUser(authUser.id);
    const stripe = getStripeClient();

    let stripeCustomerId = user.stripe_customer_id;

    if (!stripeCustomerId && user.email) {
      console.info(`[Stripe] No stripeCustomerId found for user ${user.id}, searching by email...`);
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });

      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
      }
    }

    if (!stripeCustomerId) {
      return jsonResponse({ error: 'No Stripe customer record found. Please make a purchase first.' }, { status: 404 }, request);
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${resolveBaseUrl(request)}/account`,
    });

    return jsonResponse({ url: session.url }, {}, request);
  } catch (error) {
    console.error('[create-portal edge function] error', error);
    const status = typeof error?.statusCode === 'number'
      ? error.statusCode
      : typeof error?.status === 'number'
        ? error.status
        : 500;

    return jsonResponse({ error: error?.message || 'Failed to create portal session' }, { status }, request);
  }
});
