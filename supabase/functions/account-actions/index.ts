import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse, normalizeRequestError } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(request) });
  }

  if (request.method !== 'DELETE') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405 }, request);
  }

  try {
    const actor = await resolveSupabaseUser(request);
    const admin = getSupabaseAdmin();

    const { data: userRow, error: userError } = await admin
      .from('users')
      .select('id, supabase_auth_id')
      .eq('id', actor.id)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!userRow?.id) {
      return jsonResponse({ error: 'User not found' }, { status: 404 }, request);
    }

    const authUserId = userRow.supabase_auth_id || actor.authId;

    if (authUserId) {
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(authUserId, false);
      if (deleteAuthError) {
        throw deleteAuthError;
      }
    }

    const { error: deleteUserError } = await admin
      .from('users')
      .delete()
      .eq('id', actor.id);

    if (deleteUserError) {
      throw deleteUserError;
    }

    return jsonResponse({ message: 'Account deleted successfully' }, {}, request);
  } catch (error: unknown) {
    const requestError = normalizeRequestError(error);
    const status = typeof requestError.status === 'number' ? requestError.status : 500;

    console.error('[account-actions edge function] error', requestError);
    return jsonResponse(
      { error: requestError.message || 'Failed to delete account' },
      { status },
      request,
    );
  }
});
