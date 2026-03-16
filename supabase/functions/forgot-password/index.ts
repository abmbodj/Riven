import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

import { sendPasswordResetEmail } from '../_shared/email.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { checkRateLimit } from '../_shared/rateLimit.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import { forgotPasswordSchema } from '../_shared/validation.ts';

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

const buildBaseUrl = (request: Request) => {
  const origin = request.headers.get('origin')?.replace(/\/$/, '');
  const fallback = Deno.env.get('FRONTEND_URL')?.replace(/\/$/, '');
  return origin || fallback || 'http://localhost:5173';
};

const buildResetToken = () => Array.from(
  crypto.getRandomValues(new Uint8Array(32)),
  (byte) => byte.toString(16).padStart(2, '0'),
).join('');

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }
  const rl = await checkRateLimit(request, 'default');
  if (rl) return rl;

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return jsonResponse(
        { error: parsed.error.errors[0]?.message ?? 'Invalid request' },
        { status: 400 },
        request
      );
    }
    const { email } = parsed.data;

    const normalizedEmail = email.trim().toLowerCase();
    const admin = getSupabaseAdmin();
    const authClient = getAnonAuthClient();
    const baseUrl = buildBaseUrl(request);

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('id, email, supabase_auth_id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (userRow?.id) {
      let usedSupabaseRecovery = false;

      if (userRow.supabase_auth_id) {
        try {
          const { error } = await authClient.auth.resetPasswordForEmail(userRow.email, {
            redirectTo: `${baseUrl}/reset-password`,
          });

          if (!error) {
            usedSupabaseRecovery = true;
          }
        } catch (supabaseError) {
          console.warn('[forgot-password edge function] Supabase recovery failed, falling back to legacy flow:', supabaseError);
        }
      }

      if (!usedSupabaseRecovery) {
        const resetToken = buildResetToken();
        const expiresAt = new Date(Date.now() + (60 * 60 * 1000)).toISOString();

        const { error: deleteError } = await admin
          .from('password_reset_tokens')
          .delete()
          .eq('user_id', userRow.id);

        if (deleteError) {
          throw deleteError;
        }

        const { error: insertError } = await admin
          .from('password_reset_tokens')
          .insert({
            user_id: userRow.id,
            token: resetToken,
            expires_at: expiresAt,
          });

        if (insertError) {
          throw insertError;
        }

        await sendPasswordResetEmail(userRow.email, resetToken, baseUrl);
      }
    }

    return jsonResponse({
      message: 'If an account with that email exists, a reset link has been sent.',
    }, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    console.error('[forgot-password edge function] error', requestError);
    return jsonResponse(
      { error: requestError.message || 'Failed to process request' },
      { status },
      request,
    );
  }
});
