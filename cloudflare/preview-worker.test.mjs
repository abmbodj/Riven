import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './preview-worker.mjs';

test('preview API routes return an explicit JSON unavailable response', async () => {
  const response = await worker.fetch(new Request('https://preview.example/api/study/coach'), {});
  assert.equal(response.status, 503);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.equal((await response.json()).error, 'Preview API is not configured');
});

test('only explicitly allowed read-only endpoints are forwarded to the backend', async () => {
  let calls = 0;
  const env = { API: { fetch: async () => { calls++; return Response.json({ status: 'ok' }); } } };
  const health = await worker.fetch(new Request('https://preview.example/api/health'), env);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('x-robots-tag'), 'noindex, nofollow');
  const blocked = await worker.fetch(new Request('https://preview.example/api/auth/login', { method: 'POST' }), env);
  assert.equal(blocked.status, 503);
  assert.equal(calls, 1);
  const assist = await worker.fetch(new Request('https://preview.example/api/study/assist', { method: 'POST' }), env);
  assert.equal(assist.status, 200);
  assert.equal(calls, 2);
});
