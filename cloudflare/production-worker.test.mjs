import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './production-worker.mjs';

test('forwards verified API endpoints and refuses other API routes', async () => {
  let calls = 0;
  const env = { API: { fetch: async () => { calls++; return Response.json({ ok: true }); } } };
  assert.equal((await worker.fetch(new Request('https://rivenos.com/api/health'), env)).status, 200);
  const rejected = await worker.fetch(new Request('https://rivenos.com/api/auth/register', { method: 'POST' }), env);
  assert.equal(rejected.status, 503);
  assert.equal(rejected.headers.get('x-robots-tag'), null);
  assert.equal(calls, 1);
});

test('serves the app shell for navigation but returns 404 for missing assets', async () => {
  const env = { ASSETS: { fetch: async (req) => new URL(req.url).pathname === '/'
    ? new Response('<html>app</html>', { headers: { 'Content-Type': 'text/html' } })
    : new Response('not found', { status: 404 }) } };
  const page = await worker.fetch(new Request('https://rivenos.com/dashboard', { headers: { Accept: 'text/html' } }), env);
  assert.equal(page.status, 200);
  const missing = await worker.fetch(new Request('https://rivenos.com/assets/missing.js'), env);
  assert.equal(missing.status, 404);
});
