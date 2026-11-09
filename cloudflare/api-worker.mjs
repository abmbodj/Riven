import http from 'node:http';
import { httpServerHandler } from 'cloudflare:node';
import workerDatabase from '../server/workerDatabase.js';
import workerContext from '../server/workerContext.js';
export { ApiRateLimiter } from './rate-limit.mjs';

let handlerPromise;
async function getHandler() {
  if (!handlerPromise) {
    handlerPromise = import('../server/index.js').then(({ default: app }) => httpServerHandler(http.createServer(app)));
    handlerPromise.catch(() => { handlerPromise = undefined; });
  }
  return handlerPromise;
}

export default {
  async fetch(request, env, ctx) {
    const clientIp = request.headers.get('cf-connecting-ip');
    if (!clientIp || !env.RATE_LIMITER || !env.HYPERDRIVE) {
      return Response.json({ error: 'API unavailable' }, { status: 503 });
    }
    const url = new URL(request.url);
    try {
      const stub = env.RATE_LIMITER.get(env.RATE_LIMITER.idFromName(clientIp));
      const response = await stub.fetch('https://limiter.invalid/', {
        method: 'POST',
        body: JSON.stringify({ path: url.pathname, method: request.method }),
      });
      if (!response.ok) throw new Error('Rate limiter unavailable');
      const result = await response.json();
      if (result.allowed !== true) {
        return Response.json({ error: 'Too many requests, please try again later' }, {
          status: 429, headers: { 'Retry-After': String(result.retryAfter || 60) },
        });
      }
      const pool = workerDatabase.createWorkerPool(env.HYPERDRIVE.connectionString);
      return await workerContext.runWithWorkerContext({ pool, clientIp }, async () => {
        const handler = await getHandler();
        return handler.fetch(request, env, ctx);
      });
    } catch (error) {
      console.error('Worker API failure', error);
      return Response.json({ error: 'API unavailable' }, { status: 503 });
    }
  },
};
