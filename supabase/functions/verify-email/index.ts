import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { corsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

const isLegacyTokenHash = (token: string) => /^[a-f0-9]{64}$/i.test(token);

const getAnonAuthClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    const error = new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
    (error as Error & { status?: number }).status = 500;
    throw error;
  }

  return createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const resolveRedirectTo = () => {
  const baseUrl = Deno.env.get('FRONTEND_URL')?.replace(/\/$/, '');
  return baseUrl ? `${baseUrl}/verify-email` : undefined;
};

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { token } = await request.json().catch(() => ({}));
    if (!token || typeof token !== 'string') {
      return jsonResponse({ error: 'Token is required' }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (isLegacyTokenHash(token)) {
      const now = new Date().toISOString();
      const { data: record, error: recordError } = await admin
        .from('email_verification_tokens')
        .select('user_id')
        .eq('token', token)
        .gt('expires_at', now)
        .maybeSingle();

      if (recordError) {
        throw recordError;
      }

      if (!record?.user_id) {
        return jsonResponse({ error: 'Invalid or expired verification link' }, { status: 400 });
      }

      const { error: updateLegacyUserError } = await admin
        .from('users')
        .update({ email_verified: true })
        .eq('id', record.user_id);

      if (updateLegacyUserError) {
        throw updateLegacyUserError;
      }

      const { error: deleteTokenError } = await admin
        .from('email_verification_tokens')
        .delete()
        .eq('user_id', record.user_id);

      if (deleteTokenError) {
        throw deleteTokenError;
      }

      return jsonResponse({ message: 'Email verified successfully' });
    }

    const authClient = getAnonAuthClient();
    const redirectTo = resolveRedirectTo();
    const verifyParams = {
      token_hash: token,
      type: 'signup' as const,
      ...(redirectTo ? { options: { redirectTo } } : {}),
    };

    const { data, error } = await authClient.auth.verifyOtp(verifyParams);
    if (error || !data.user?.id) {
      return jsonResponse({ error: 'Invalid or expired verification link' }, { status: 400 });
    }

    const { error: updateError } = await admin
      .from('users')
      .update({ email_verified: true })
      .eq('supabase_auth_id', data.user.id);

    if (updateError) {
      throw updateError;
    }

    return jsonResponse({ message: 'Email verified successfully' });
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    console.error('[verify-email edge function] error', requestError);
    return jsonResponse(
      { error: requestError.message || 'Failed to verify email' },
      { status },
    );
  }
});
