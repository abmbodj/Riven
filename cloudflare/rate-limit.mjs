const rules = {
  api: { limit: 100, windowMs: 60_000 },
  auth: { limit: 10, windowMs: 15 * 60_000 },
  reset: { limit: 3, windowMs: 60 * 60_000 },
};

export function classifyRequest(path, method) {
  const groups = ['api'];
  path = path.toLowerCase();
  method = method.toUpperCase();
  if (method === 'POST' && /^\/api\/auth\/(forgot-password|reset-password)\/?$/.test(path)) groups.push('reset');
  else if (method === 'POST' && path.startsWith('/api/auth/')) groups.push('auth');
  return groups;
}

export function checkLimits(previous, groups, now) {
  const state = { ...previous };
  for (const group of groups) {
    const rule = rules[group];
    if (!rule) throw new Error('Unknown rate-limit group');
    let window = state[group];
    if (!window || now >= window.resetAt) window = { count: 0, resetAt: now + rule.windowMs };
    if (window.count >= rule.limit) return { allowed: false, retryAfter: Math.max(1, Math.ceil((window.resetAt - now) / 1000)), state };
    state[group] = { ...window, count: window.count + 1 };
  }
  return { allowed: true, state };
}

// One Durable Object per client address; transaction makes counters consistent across isolates.
export class ApiRateLimiter {
  constructor(state) { this.storage = state.storage; }

  async fetch(request) {
    const { path, method } = await request.json();
    const result = await this.storage.transaction(async transaction => {
      const previous = (await transaction.get('windows')) || {};
      const next = checkLimits(previous, classifyRequest(path, method), Date.now());
      if (next.allowed) await transaction.put('windows', next.state);
      return next;
    });
    return Response.json({ allowed: result.allowed, retryAfter: result.retryAfter });
  }
}
