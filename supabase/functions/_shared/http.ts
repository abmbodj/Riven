const ALLOWED_ORIGINS = [
  Deno.env.get('FRONTEND_URL') || 'https://riven.rocks',
  Deno.env.get('CLIENT_URL'),
  'https://riven-virid.vercel.app',
  'capacitor://localhost',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean) as string[];

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = req?.headers?.get('origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.some((o) => origin === o) ||
    origin.endsWith('.vercel.app');

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Vary': 'Origin',
  };
}

/** @deprecated Use getCorsHeaders(req) for origin-aware CORS. Kept for backward compat. */
export const corsHeaders = getCorsHeaders();

export type RequestError = Error & {
  status?: number;
  statusCode?: number;
  canWatchAd?: boolean;
};

export const normalizeRequestError = (error: unknown): RequestError => {
  if (error instanceof Error) {
    return error as RequestError;
  }

  const normalized = new Error('Unknown server error') as RequestError;

  if (typeof error === 'string' && error.trim()) {
    normalized.message = error;
    return normalized;
  }

  if (error && typeof error === 'object') {
    const maybeError = error as {
      message?: unknown;
      status?: unknown;
      statusCode?: unknown;
      canWatchAd?: unknown;
    };

    if (typeof maybeError.message === 'string' && maybeError.message.trim()) {
      normalized.message = maybeError.message;
    }

    if (typeof maybeError.status === 'number') {
      normalized.status = maybeError.status;
    }

    if (typeof maybeError.statusCode === 'number') {
      normalized.statusCode = maybeError.statusCode;
    }

    if (typeof maybeError.canWatchAd === 'boolean') {
      normalized.canWatchAd = maybeError.canWatchAd;
    }
  }

  return normalized;
};

export const jsonResponse = (body: unknown, init: ResponseInit = {}, req?: Request) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(req ? getCorsHeaders(req) : corsHeaders),
      ...(init.headers ?? {}),
    },
  });
