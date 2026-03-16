import { createClient } from 'jsr:@supabase/supabase-js@2';

import { getSupabaseAdmin } from './supabaseAdmin.ts';

const getBearerToken = (request: Request) => {
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) {
    const error = new Error('Missing bearer token');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  return authorization.slice('Bearer '.length);
};

export const resolveSupabaseUser = async (request: Request) => {
  const token = getBearerToken(request);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !anonKey) {
    const error = new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required');
    (error as Error & { status?: number }).status = 500;
    throw error;
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  const { data, error: authError } = await authClient.auth.getUser(token);
  if (authError || !data.user) {
    const error = new Error('Unauthorized');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  const admin = getSupabaseAdmin();
  const { data: linkedUser, error: linkedUserError } = await admin
    .from('users')
    .select('id')
    .eq('supabase_auth_id', data.user.id)
    .maybeSingle();

  if (linkedUserError) {
    throw linkedUserError;
  }

  if (linkedUser?.id) {
    return { id: linkedUser.id, authId: data.user.id };
  }

  const email = data.user.email?.toLowerCase();
  if (!email) {
    const error = new Error('Account setup required');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  const { data: emailUser, error: emailUserError } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .limit(1)
    .maybeSingle();

  if (emailUserError) {
    throw emailUserError;
  }

  if (!emailUser?.id) {
    const error = new Error('Account setup required');
    (error as Error & { status?: number }).status = 401;
    throw error;
  }

  // Link supabase_auth_id so RLS get_app_user_id() works for future queries
  await admin
    .from('users')
    .update({ supabase_auth_id: data.user.id })
    .eq('id', emailUser.id)
    .is('supabase_auth_id', null);

  return { id: emailUser.id, authId: data.user.id };
};
