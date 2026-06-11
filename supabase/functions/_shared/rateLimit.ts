/**
 * Rate limiting for Supabase Edge Functions using Upstash Redis.
 * Requires UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Supabase secrets.
 * If not set, rate limiting is skipped (allows local dev without Upstash).
 */

import { Redis } from 'npm:@upstash/redis@1.28.0';
import { Ratelimit } from 'npm:@upstash/ratelimit@0.4.4';
import { getCorsHeaders } from './http.ts';

export type RateLimitPreset = 'default' | 'webhook' | 'admin' | 'grading';

type RateLimitWindow = Parameters<typeof Ratelimit.slidingWindow>[1];

const PRESETS: Record<RateLimitPreset, { limit: number; window: RateLimitWindow }> = {
  default: { limit: 60, window: '1 m' },
  webhook: { limit: 300, window: '1 m' },
  admin: { limit: 30, window: '1 m' },
  // 100 grading calls per user per day — prevents unbounded Groq spend on unmetered grading
  grading: { limit: 100, window: '24 h' },
};

function getIdentifier(request: Request): string {
  const customAuth = request.headers.get('x-supabase-auth');
  if (customAuth) {
    return `auth:${customAuth.slice(0, 43)}`;
  }

  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) {
    return `auth:${auth.slice(7, 50)}`;
  }
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'anonymous';
  return `ip:${ip}`;
}

// RIV-012: a hosted deploy that is missing Upstash config must fail closed rather
// than silently disabling rate limiting. Local dev (kong/localhost) still allows.
function isHostedEnvironment(): boolean {
  const explicit = Deno.env.get('EDGE_RUNTIME_ENV') || Deno.env.get('ENVIRONMENT');
  if (explicit) return explicit === 'production' || explicit === 'hosted';
  const url = Deno.env.get('SUPABASE_URL') || '';
  return url.includes('.supabase.co');
}

let cachedLimiters: Map<string, Ratelimit> | null = null;

function getLimiter(preset: RateLimitPreset): Ratelimit | null {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

  if (!url || !token) {
    return null;
  }

  if (!cachedLimiters) {
    const redis = new Redis({ url, token });
    cachedLimiters = new Map();
    for (const [key, config] of Object.entries(PRESETS)) {
      cachedLimiters.set(
        key,
        new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(config.limit, config.window),
          analytics: false,
        })
      );
    }
  }

  return cachedLimiters.get(preset) ?? null;
}

const PRESET_ERRORS: Record<RateLimitPreset, { message: string; retryAfter: string }> = {
  default: { message: 'Too many requests. Please try again later.', retryAfter: '60' },
  webhook: { message: 'Too many requests. Please try again later.', retryAfter: '60' },
  admin: { message: 'Too many requests. Please try again later.', retryAfter: '60' },
  grading: {
    message: 'You have reached the daily grading limit (100 answers per day). Please try again tomorrow.',
    retryAfter: String(60 * 60 * 24), // 24 hours
  },
};

/**
 * Check rate limit. Returns 429 Response if over limit, otherwise null.
 * Call at the start of your handler (after OPTIONS) and return early if non-null.
 */
export async function checkRateLimit(
  request: Request,
  preset: RateLimitPreset = 'default'
): Promise<Response | null> {
  const limiter = getLimiter(preset);
  if (!limiter) {
    if (isHostedEnvironment()) {
      // RIV-012: fail closed when Upstash is unconfigured in a hosted environment.
      console.error('[rateLimit] Upstash not configured in a hosted environment — refusing request.');
      return new Response(
        JSON.stringify({ error: 'Rate limiting is temporarily unavailable. Please try again later.' }),
        {
          status: 503,
          headers: {
            ...getCorsHeaders(request),
            'Content-Type': 'application/json',
            'Retry-After': '30',
          },
        }
      );
    }
    return null;
  }

  const identifier = getIdentifier(request);
  const { success } = await limiter.limit(identifier);

  if (!success) {
    const { message, retryAfter } = PRESET_ERRORS[preset];
    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 429,
        headers: {
          ...getCorsHeaders(request),
          'Content-Type': 'application/json',
          'Retry-After': retryAfter,
        },
      }
    );
  }

  return null;
}
