import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyRequest, checkLimits } from './rate-limit.mjs';

test('classifies password reset separately from general authentication', () => {
  assert.deepEqual(classifyRequest('/api/auth/forgot-password', 'POST'), ['api', 'reset']);
  assert.deepEqual(classifyRequest('/api/auth/login', 'POST'), ['api', 'auth']);
  assert.deepEqual(classifyRequest('/api/csrf', 'GET'), ['api']);
});

test('enforces all applicable windows and resets them after expiry', () => {
  let state = {};
  for (let i = 0; i < 10; i++) {
    const result = checkLimits(state, ['api', 'auth'], 1_000);
    assert.equal(result.allowed, true);
    state = result.state;
  }
  assert.equal(checkLimits(state, ['api', 'auth'], 1_000).allowed, false);
  assert.equal(checkLimits(state, ['api', 'auth'], 901_001).allowed, true);
});

test('limits password reset attempts to three per hour', () => {
  let state = {};
  for (let i = 0; i < 3; i++) state = checkLimits(state, ['api', 'reset'], 1_000).state;
  assert.equal(checkLimits(state, ['api', 'reset'], 1_001).allowed, false);
});
