import { createClient } from 'jsr:@supabase/supabase-js@2';

let cachedAdminClient: ReturnType<typeof createClient> | null = null;

export const getSupabaseAdmin = () => {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  cachedAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
};
