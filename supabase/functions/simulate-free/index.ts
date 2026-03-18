import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

import { resolveSupabaseUser } from '../_shared/auth.ts';
import { getCorsHeaders, jsonResponse } from '../_shared/http.ts';
import { getSupabaseAdmin } from '../_shared/supabaseAdmin.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    const authUser = await resolveSupabaseUser(req);
    const admin = getSupabaseAdmin();

    const { data: user, error } = await admin
      .from('users')
      .select('id, role, is_admin, simulate_free_tier')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error || !user) {
      return jsonResponse({ error: 'User not found' }, { status: 404 }, req);
    }

    const role = user.role || (user.is_admin === 1 ? 'admin' : 'user');
    if (role !== 'owner' && role !== 'admin') {
      return jsonResponse({ error: 'Owner or Admin only' }, { status: 403 }, req);
    }

    const nextValue = !user.simulate_free_tier;
    await admin.from('users').update({ simulate_free_tier: nextValue }).eq('id', user.id);

    return jsonResponse({
      simulate_free_tier: nextValue,
      subscription_tier: nextValue ? 'free' : 'lifetime',
    }, {}, req);

  } catch (err) {
    const status = typeof (err as { status?: number }).status === 'number' ? (err as { status: number }).status : 500;
    return jsonResponse({ error: (err as Error).message || 'Internal server error' }, { status }, req);
  }
});
