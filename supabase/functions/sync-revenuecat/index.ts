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

    // 2. Fetch the RC Secret API Key from env (Fallback to Public key but it won't work for REST API)
    const rcSecretKey = Deno.env.get('RC_SECRET_KEY');
    const rcApiKey = rcSecretKey || Deno.env.get('VITE_RC_IOS_API_KEY') || Deno.env.get('RC_IOS_API_KEY');
    
    if (!rcApiKey) {
      console.error('[sync-revenuecat] API key missing in environment secrets');
      return jsonResponse({ error: 'RevenueCat is not configured on the server' }, { status: 503 }, request);
    }
    
    if (rcApiKey.startsWith('appl_')) {
        console.warn('[sync-revenuecat] WARNING: Using a Public API Key (appl_) for REST API. RevenueCat will likely return empty entitlements. A Secret API Key (sk_) is required.');
    }

    const body = await request.json().catch(() => ({}));
    const rcAppUserIdOverride = body.rcAppUserIdOverride;
    
    // 3. Request user's entitlements from RevenueCat REST API
    // Try the override first (if the client provides originalAppUserId), then fallback to Supabase UUID
    const rcAppUserId = rcAppUserIdOverride || user.id;

    console.log(`[sync-revenuecat] Fetching entitlements for: ${rcAppUserId}`);
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${rcAppUserId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rcApiKey}`,
        'Accept': 'application/json',
        'X-Is-Sandbox': 'true'
      }
    });

    const data = await response.json().catch(() => ({}));
    console.log(`[sync-revenuecat] RevenueCat REST response (${response.status}):`, JSON.stringify(data));
    
    if (!response.ok) {
      console.error(`[sync-revenuecat] RevenueCat API error: ${response.status}`, data);
      return jsonResponse({ 
        error: `RevenueCat API rejected request with status ${response.status}.`,
        details: data,
        rcAppUserId
      }, { status: 502 }, request);
    }
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

    // 4. Update the user in the database using admin privileges
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin
      .from('users')
      .update({ subscription_tier: newTier })
      .eq('supabase_auth_id', user.id);

    if (updateError) {
        return jsonResponse({ error: 'Failed to update database', details: updateError }, { status: 500 }, request);
    }

    // 5. Success! Return the detailed diagnostic information
    console.log(`[sync-revenuecat] Successfully synced ${user.id} to ${newTier}`);
    return jsonResponse({ 
        subscription_tier: newTier,
        debug_entitlements: entitlements,
        debug_rcAppUserId: rcAppUserId
    }, { status: 200 }, request);

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[sync-revenuecat] Error syncing subscription:', err.message);
    await reportEdgeException(err, { request, functionName: 'sync-revenuecat' });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 }, request);
  }
});
