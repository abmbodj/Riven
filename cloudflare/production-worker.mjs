import { isAllowedApiRequest } from './api-route-policy.mjs';

// A route is added to the policy only after its security and behavior are verified.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/api' && !url.pathname.startsWith('/api/')) {
      const response = await env.ASSETS.fetch(request);
      if (response.status !== 404 || !['GET', 'HEAD'].includes(request.method) || !request.headers.get('accept')?.includes('text/html')) return response;
      if (url.pathname.startsWith('/assets/')) return response;
      return env.ASSETS.fetch(new Request(new URL('/', url), request));
    }
    if (isAllowedApiRequest(request) && env.API) return env.API.fetch(request);
    return Response.json({ error: 'API temporarily unavailable' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  },
};
