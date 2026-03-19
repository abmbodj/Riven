const ALLOWED_ORIGINS = [
  Deno.env.get('FRONTEND_URL'),
  Deno.env.get('CLIENT_URL'),
  ...(Deno.env.get('ALLOWED_ORIGINS') || '').split(','),
  'https://riven.rocks',
  'https://www.riven.rocks',
  'https://riven-virid.vercel.app',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost:5173',
  'http://localhost:3000',
].filter(Boolean).map((o) => (o as string).trim().replace(/\/+$/, '')) as string[];

const DEFAULT_ALLOWED_HEADERS = [
  'authorization',
  'x-client-info',
  'x-supabase-auth',
  'apikey',
  'content-type',
  'x-warmup',
];

const isLocalOrigin = (origin: string) => (
  /^https?:\/\/localhost(?::\d+)?$/i.test(origin)
  || /^https?:\/\/127\.0\.0\.1(?::\d+)?$/i.test(origin)
);

const buildAllowedHeaders = (req?: Request) => {
  const requestedHeaders = (req?.headers?.get('access-control-request-headers') ?? '')
    .split(',')
    .map((header) => header.trim().toLowerCase())
    .filter(Boolean);

  return Array.from(new Set([
    ...DEFAULT_ALLOWED_HEADERS,
    ...requestedHeaders,
  ])).join(', ');
};

export function getCorsHeaders(req?: Request): Record<string, string> {
  const origin = (req?.headers?.get('origin') ?? '').replace(/\/+$/, '');
  const isAllowed =
    ALLOWED_ORIGINS.some((o) => origin === o) ||
    origin.endsWith('.vercel.app') ||
    origin.endsWith('.riven.rocks') ||
    isLocalOrigin(origin) ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost';

  const allowOrigin = !origin || origin === 'null'
    ? '*'
    : (isAllowed ? origin : '*');

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': buildAllowedHeaders(req),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Expose-Headers': 'Content-Type',
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
