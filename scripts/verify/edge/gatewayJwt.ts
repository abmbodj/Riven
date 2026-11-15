// Gateway-equivalent JWT check for the local function host.
//
// Hosted Supabase verifies the caller's JWT before a function runs unless the function
// sets `verify_jwt = false` in supabase/config.toml. This reproduces that: functions
// default to verified; the token must be a valid, unexpired JWT signed by the local
// project (ES256 user tokens via the auth JWKS, or the HS256 legacy anon/service keys).

const CONFIG = new URL('../../../supabase/config.toml', import.meta.url);

export function loadVerifyJwtSettings(): Map<string, boolean> {
  const settings = new Map<string, boolean>();
  let current: string | null = null;
  for (const line of Deno.readTextFileSync(CONFIG).split('\n')) {
    const header = line.match(/^\[functions\.([a-z0-9-]+)\]\s*$/);
    if (header) { current = header[1]; continue; }
    if (line.startsWith('[')) { current = null; continue; }
    const setting = line.match(/^\s*verify_jwt\s*=\s*(true|false)/);
    if (current && setting) settings.set(current, setting[1] === 'true');
  }
  return settings;
}

const b64urlToBytes = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=')), (c) => c.charCodeAt(0));
const decodeJson = (s: string) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

let jwksCache: { keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function verifySignature(header: { alg: string; kid?: string }, signingInput: Uint8Array, signature: Uint8Array, gateway: string, hsSecret: string) {
  if (header.alg === 'HS256') {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(hsSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('HMAC', key, signature, signingInput);
  }
  if (header.alg === 'ES256') {
    jwksCache ??= await (await fetch(`${gateway}/auth/v1/.well-known/jwks.json`)).json();
    const jwk = jwksCache!.keys.find((k) => k.kid === header.kid);
    if (!jwk) { jwksCache = null; return false; }
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, signingInput);
  }
  return false;
}

/** Returns null when the request may proceed, or the gateway's 401 response. */
export async function gatewayJwtCheck(req: Request, { gateway, hsSecret }: { gateway: string; hsSecret: string }): Promise<Response | null> {
  if (req.method === 'OPTIONS') return null;
  const auth = req.headers.get('authorization') ?? '';
  const token = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return Response.json({ code: 401, message: 'Missing authorization header' }, { status: 401 });
  try {
    const [h, p, s] = token.split('.');
    const header = decodeJson(h);
    const payload = decodeJson(p);
    const ok = await verifySignature(header, new TextEncoder().encode(`${h}.${p}`), b64urlToBytes(s), gateway, hsSecret);
    if (!ok || (payload.exp && payload.exp * 1000 < Date.now())) throw new Error('invalid');
    return null;
  } catch {
    return Response.json({ code: 401, message: 'Invalid JWT' }, { status: 401 });
  }
}
