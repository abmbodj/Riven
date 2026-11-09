import { isAllowedApiRequest } from './api-route-policy.mjs';

// Preview-only guard: production routing must be enabled only after the API is verified.
export default {
  async fetch(request, env) {
    if (isAllowedApiRequest(request) && env.API) {
      const response = await env.API.fetch(request);
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('X-Robots-Tag', 'noindex, nofollow');
      return new Response(response.body, { status: response.status, headers });
    }
    return Response.json(
      { error: 'Preview API is not configured' },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } },
    );
  },
};
