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

    // RIV-003: always sync the caller's OWN RevenueCat subscriber. The previous
    // rcAppUserIdOverride let any authenticated user read a paying subscriber's
    // entitlements and grant themselves the tier. The client SDK is configured with
    // appUserID = user.id, so restorePurchases() already transfers entitlements here.
    const rcAppUserId = user.id;

    // RIV-003: do not log raw request bodies / RC responses (PII + entitlement data).
    const isSandbox = Deno.env.get('REVENUECAT_SANDBOX') === 'true';
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${rcAppUserId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${rcApiKey}`,
        'Accept': 'application/json',
        'X-Is-Sandbox': isSandbox ? 'true' : 'false'
      }
    });

    const data = await response.json().catch(() => ({}));

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
    let newExpiresAt: string | null = null;

    const premiumEnt = entitlements.premium as { expires_date?: string } | undefined;
    if (premiumEnt) {
      if (!premiumEnt.expires_date) {
        // Non-renewing or lifetime-like — no expiry date means perpetual.
        newTier = 'supporter';
        newExpiresAt = null;
      } else if (new Date(premiumEnt.expires_date).getTime() > Date.now()) {
        newTier = 'supporter';
        newExpiresAt = new Date(premiumEnt.expires_date).toISOString();
      }
    }

    if (newTier === 'free') {
      // Fall back: scan all entitlements for any active one.
      const activeEnt = Object.values(entitlements as Record<string, { expires_date?: string }>).find((e) =>
        !e.expires_date || new Date(e.expires_date).getTime() > Date.now()
      );
      if (activeEnt) {
        newTier = 'supporter';
        newExpiresAt = activeEnt.expires_date ? new Date(activeEnt.expires_date).toISOString() : null;
      }
    }

    // 4. Update the user in the database using admin privileges
    const admin = getSupabaseAdmin();
    const { error: updateError } = await admin
      .from('users')
      .update({ subscription_tier: newTier, subscription_expires_at: newExpiresAt })
      .eq('supabase_auth_id', user.id);

    if (updateError) {
        return jsonResponse({ error: 'Failed to update database', details: updateError }, { status: 500 }, request);
    }

    // 5. Success
    return jsonResponse({
        subscription_tier: newTier,
        subscription_expires_at: newExpiresAt,
    }, { status: 200 }, request);

  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    console.error('[sync-revenuecat] Error syncing subscription:', err.message);
    await reportEdgeException(err, { request, functionName: 'sync-revenuecat' });
    return jsonResponse({ error: 'Internal server error' }, { status: 500 }, request);
  }
});
