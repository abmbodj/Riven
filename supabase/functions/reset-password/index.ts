import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { hash } from 'https://esm.sh/bcryptjs@2.4.3';

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

const getAuthenticatedAuthClient = (accessToken: string) => {
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
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};

const buildBaseUrl = (request: Request) => {
  const origin = request.headers.get('origin')?.replace(/\/$/, '');
  const fallback = Deno.env.get('FRONTEND_URL')?.replace(/\/$/, '');
  return origin || fallback || 'http://localhost:5173';
};

const invalidResetResponse = () => jsonResponse(
  { error: 'Invalid or expired reset link. Please request a new one.' },
  { status: 400 },
);

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const { token, password } = await request.json().catch(() => ({}));
    if (!token || !password || typeof token !== 'string' || typeof password !== 'string') {
      return jsonResponse({ error: 'Token and new password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return jsonResponse({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    if (isLegacyTokenHash(token)) {
      const admin = getSupabaseAdmin();
      const now = new Date().toISOString();
      const { data: resetRecord, error: resetError } = await admin
        .from('password_reset_tokens')
        .select('id, user_id')
        .eq('token', token)
        .eq('used', false)
        .gt('expires_at', now)
        .maybeSingle();

      if (resetError) {
        throw resetError;
      }

      if (!resetRecord?.id) {
        return invalidResetResponse();
      }

      const hashedPassword = await hash(password, 12);

      const { error: updateUserError } = await admin
        .from('users')
        .update({ password: hashedPassword })
        .eq('id', resetRecord.user_id);

      if (updateUserError) {
        throw updateUserError;
      }

      const { error: markUsedError } = await admin
        .from('password_reset_tokens')
        .update({ used: true })
        .eq('id', resetRecord.id);

      if (markUsedError) {
        throw markUsedError;
      }

      const { error: cleanupError } = await admin
        .from('password_reset_tokens')
        .delete()
        .eq('user_id', resetRecord.user_id)
        .neq('id', resetRecord.id);

      if (cleanupError) {
        throw cleanupError;
      }

      return jsonResponse({ message: 'Password has been reset successfully. You can now log in.' });
    }

    const authClient = getAnonAuthClient();
    const redirectTo = `${buildBaseUrl(request)}/reset-password`;
    const { data, error } = await authClient.auth.verifyOtp({
      token_hash: token,
      type: 'recovery',
      options: { redirectTo },
    });

    if (error) {
      return invalidResetResponse();
    }

    const accessToken = data?.session?.access_token;
    if (!accessToken) {
      return invalidResetResponse();
    }

    const recoveryClient = getAuthenticatedAuthClient(accessToken);
    const { error: updateError } = await recoveryClient.auth.updateUser({ password });

    if (updateError) {
      return invalidResetResponse();
    }

    return jsonResponse({ message: 'Password has been reset successfully. You can now log in.' });
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    console.error('[reset-password edge function] error', requestError);
    return jsonResponse(
      { error: requestError.message || 'Failed to reset password' },
      { status },
    );
  }
});
