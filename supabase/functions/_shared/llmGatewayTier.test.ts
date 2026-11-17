import { pushTierFromEdge } from './llmGatewayTier.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const push = { userId: 42, tier: 'free' as const, version: 1_760_000_000_000 };

const withGateway = async (
  env: Record<string, string> | null,
  respond: () => Promise<Response>,
  run: (calls: { url: string; init: RequestInit }[]) => Promise<void>,
) => {
  const names = ['LLM_GATEWAY_BASE_URL', 'LLM_GATEWAY_APP_KEY', 'SENTRY_DSN'];
  const saved = names.map((name) => [name, Deno.env.get(name)] as const);
  const realFetch = globalThis.fetch;
  const calls: { url: string; init: RequestInit }[] = [];
  names.forEach((name) => Deno.env.delete(name));
  Object.entries(env ?? {}).forEach(([name, value]) => Deno.env.set(name, value));
  globalThis.fetch = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return respond();
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = realFetch;
    saved.forEach(([name, value]) => (value === undefined ? Deno.env.delete(name) : Deno.env.set(name, value)));
  }
};

const gatewayEnv = { LLM_GATEWAY_BASE_URL: 'https://gateway.test/v1', LLM_GATEWAY_APP_KEY: 'app-key' };

Deno.test('skips the gateway when it is not configured', async () => {
  await withGateway(null, () => Promise.reject(new Error('unexpected fetch')), async (calls) => {
    await pushTierFromEdge(push, { functionName: 'test' });
    assert(calls.length === 0, 'no request without gateway env');
  });
});

Deno.test('pushes the tier to the configured gateway', async () => {
  const ok = () => Promise.resolve(Response.json({ tier: 'free', version: push.version, applied: true }));
  await withGateway(gatewayEnv, ok, async (calls) => {
    await pushTierFromEdge(push, { functionName: 'test' });
    assert(calls.length === 1, 'one request');
    assert(calls[0].url === 'https://gateway.test/v1/end-users/42/tier', `url was ${calls[0].url}`);
    assert(calls[0].init.body === JSON.stringify({ tier: 'free', version: push.version }), 'body carries tier and version');
  });
});

Deno.test('a gateway outage does not reach the webhook', async () => {
  const down = () => Promise.resolve(Response.json({ error: 'redis down' }, { status: 503 }));
  await withGateway(gatewayEnv, down, async (calls) => {
    await pushTierFromEdge(push, { functionName: 'test' });
    assert(calls.length === 1, 'the push was attempted');
  });
});
