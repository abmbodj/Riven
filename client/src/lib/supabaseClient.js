import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — storage uploads will fail.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// #region agent log
fetch('http://127.0.0.1:7311/ingest/53f62ef3-2a00-4279-bbe9-6c0ad7e975d5', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '41ce24' },
    body: JSON.stringify({
        sessionId: '41ce24',
        runId: 'pre-fix',
        hypothesisId: 'H2',
        location: 'supabaseClient.js:afterCreateClient',
        message: 'supabase_client_init',
        data: {
            urlLen: (supabaseUrl || '').length,
            keyLen: (supabaseAnonKey || '').length,
        },
        timestamp: Date.now(),
    }),
}).catch(() => {});
// #endregion
