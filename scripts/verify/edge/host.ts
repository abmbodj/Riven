// Local-only host for supabase/functions/* under plain Deno (verification stack).
//
// Why not the edge-runtime image: some sandboxes cap the container's open-file limit
// below what `supabase functions serve` requests, and the image does not honor a
// custom CA bundle for npm fetches. Plain Deno honors DENO_CERT / HTTPS_PROXY.
//
// Each function's index.ts calls Deno.serve (directly or via std `serve`). We capture
// that handler instead of opening a port, import every function lazily on first call,
// and dispatch /<function>/... to it. Differences from production, by design:
//   * all functions share one isolate and one env (no per-function worker isolation);
//   * the gateway JWT check is reproduced in gatewayJwt.ts from supabase/config.toml;
//   * EdgeRuntime.waitUntil runs the promise without extending a worker lifetime.

import { installFetchFakes } from '../fakes/externals.ts';
import { gatewayJwtCheck, loadVerifyJwtSettings } from './gatewayJwt.ts';

// Must run before any function module loads, so SDKs that capture `fetch` at import
// time (OpenAI, Stripe) capture the faked one.
if (Deno.env.get('RIVEN_VERIFY_REAL_EXTERNALS') !== '1') installFetchFakes();

// In production each function runs in its own worker, so a stray rejection kills only
// that request. Here all functions share one process: log it instead of exiting.
globalThis.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  console.error(JSON.stringify({ unhandledRejection: String((event.reason as Error)?.stack ?? event.reason) }));
});

type Handler = (req: Request, info: Deno.ServeHandlerInfo) => Response | Promise<Response>;

const FUNCTIONS_DIR = new URL('../../../supabase/functions/', import.meta.url);
const port = Number(Deno.env.get('RIVEN_EDGE_PORT') ?? '54331');
const realServe = Deno.serve.bind(Deno);
const verifyJwt = loadVerifyJwtSettings();
const jwtOptions = {
  gateway: Deno.env.get('RIVEN_LOCAL_GATEWAY') ?? 'http://127.0.0.1:54321',
  hsSecret: Deno.env.get('RIVEN_LOCAL_JWT_SECRET') ?? '',
};
const handlers = new Map<string, Handler>();
let captured: Handler | null = null;

const pending = new Set<Promise<unknown>>();
(globalThis as unknown as { EdgeRuntime: unknown }).EdgeRuntime = {
  waitUntil(promise: Promise<unknown>) {
    const tracked = Promise.resolve(promise).catch((error) => console.error(JSON.stringify({ waitUntilError: String(error) })));
    pending.add(tracked);
    tracked.finally(() => pending.delete(tracked));
  },
};

// deno-lint-ignore no-explicit-any
(Deno as any).serve = (...args: any[]) => {
  const handler = args.find((a) => typeof a === 'function') ?? args.find((a) => a && typeof a.handler === 'function')?.handler;
  if (!handler) throw new Error('verify host: Deno.serve called without a handler');
  captured = handler;
  return { finished: new Promise(() => {}), shutdown: async () => {}, ref() {}, unref() {}, addr: { hostname: '127.0.0.1', port, transport: 'tcp' } };
};

const loading = new Map<string, Promise<Handler | null>>();

// Imports are serialized: Deno.serve capture is a module-global, so two functions
// loading at once could swap handlers. A function's first callers share one promise.
let importChain: Promise<unknown> = Promise.resolve();

function load(name: string): Promise<Handler | null> {
  const cached = loading.get(name);
  if (cached) return cached;
  const promise = (async () => {
    const entry = new URL(`${name}/index.ts`, FUNCTIONS_DIR);
    try { await Deno.stat(entry); } catch { return null; }
    const run = importChain.then(async () => {
      captured = null;
      await import(entry.href);
      if (!captured) throw new Error(`${name}/index.ts did not call Deno.serve`);
      return captured;
    });
    importChain = run.catch(() => {});
    const handler = await run;
    handlers.set(name, handler);
    return handler;
  })();
  promise.catch(() => loading.delete(name));
  loading.set(name, promise);
  return promise;
}

realServe({ port, hostname: '0.0.0.0', onListen: () => console.log(JSON.stringify({ ready: true, port })) }, async (req, info) => {
  const url = new URL(req.url);
  const name = url.pathname.split('/').filter(Boolean)[0] ?? '';
  const started = performance.now();
  if (!/^[a-z0-9-]+$/.test(name)) return Response.json({ error: 'bad function name' }, { status: 400 });
  try {
    if (verifyJwt.get(name) !== false) {
      const rejected = await gatewayJwtCheck(req, jwtOptions);
      if (rejected) {
        console.log(JSON.stringify({ fn: name, method: req.method, status: 401, gateway: 'jwt-rejected', ms: Math.round(performance.now() - started) }));
        return rejected;
      }
    }
    const handler = await load(name);
    if (!handler) return Response.json({ error: `function not found: ${name}` }, { status: 404 });
    const res = await handler(req, info);
    console.log(JSON.stringify({ fn: name, method: req.method, status: res.status, ms: Math.round(performance.now() - started) }));
    return res;
  } catch (error) {
    console.error(JSON.stringify({ fn: name, method: req.method, error: String(error?.stack ?? error), ms: Math.round(performance.now() - started) }));
    return Response.json({ error: `function crashed: ${String(error)}` }, { status: 500 });
  }
});
