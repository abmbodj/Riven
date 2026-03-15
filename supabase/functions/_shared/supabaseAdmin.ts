import { createClient } from 'jsr:@supabase/supabase-js@2';

let cachedAdminClient: any = null;

export const getSupabaseAdmin = (): any => {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  // Debug: log the JWT role claim to verify the key is actually the service_role key
  try {
    const payload = JSON.parse(atob(serviceRoleKey.split('.')[1]));
    console.log('[supabaseAdmin] key role claim:', payload.role, '| key starts with:', serviceRoleKey.slice(0, 20));
  } catch { /* ignore */ }

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    },
  }) as any;

  return cachedAdminClient;
};
