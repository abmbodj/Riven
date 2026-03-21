import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { reportEdgeException } from '../_shared/sentry.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.42.0';

serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    // 1. Authenticate the request using the user's Supabase JWT
    const authHeader = request.headers.get('Authorization') || request.headers.get('x-supabase-auth');
    if (!authHeader) {
      return jsonResponse({ error: 'Missing auth header' }, { status: 401 }, request);
    }

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: 'Unauthorized' }, { status: 401 }, request);
    }

    // 2. Fetch the RC iOS API Key from env
    const rcApiKey = Deno.env.get('VITE_RC_IOS_API_KEY') || Deno.env.get('RC_IOS_API_KEY');
    if (!rcApiKey) {
      console.error('[sync-revenuecat] API key missing in environment secrets');
      return jsonResponse({ error: 'RevenueCat is not configured on the server' }, { status: 503 }, request);
    }

    // 3. Request user's entitlements from RevenueCat REST API
    // App User ID is the Supabase Auth UUID
    const rcAppUserId = user.id;

    console.log(`[sync-revenuecat] Fetching entitlements for: ${rcAppUserId}`);
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${rcAppUserId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rcApiKey}`,
        'Accept': 'application/json',
        'X-Platform': 'ios'
      } // Deno fetch
    });

    if (!response.ok) {
      console.error(`[sync-revenuecat] RevenueCat API error: ${response.status}`);
      return jsonResponse({ error: 'Failed to verify subscription with RevenueCat' }, { status: 502 }, request);
    }

    const data = await response.json();
    const entitlements = data?.subscriber?.entitlements || {};

    let newTier = 'free';
    if (entitlements.premium && !entitlements.premium.expires_date) {
      newTier = 'supporter';
    } else if (entitlements.premium && new Date(entitlements.premium.expires_date).getTime() > Date.now()) {
      newTier = 'supporter';
    } else {
      const hasActive = Object.values(entitlements).some((e: any) => 
        !e.expires_date || new Date(e.expires_date).getTime() > Date.now()
      );
      if (hasActive) {
        newTier = 'supporter';
      }
    }

    // 4. Update the user in the database using admin privileges (since RLS blocks them)
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin
      .from('users')
      .update({ subscription_tier: newTier })
      .eq('supabase_auth_id', user.id);

    if (updateError) {
      throw updateError;
    }

    console.log(`[sync-revenuecat] Successfully synced ${user.id} to ${newTier}`);
    return jsonResponse({ message: 'Subscription synchronized', subscription_tier: newTier }, {}, request);

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[sync-revenuecat] Error syncing subscription:', err.message);
    await reportEdgeException(err, { request, functionName: 'sync-revenuecat' });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 }, request);
  }
});
