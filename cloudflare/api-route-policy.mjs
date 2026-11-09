export function isAllowedApiRequest(request) {
  const path = new URL(request.url).pathname;
  if (request.method === 'GET') return ['/api/health', '/api/csrf', '/api/auth/me'].includes(path);
  if (request.method === 'POST') {
    return path === '/api/study/assist' || /^\/api\/messages\/\d+\/(accept-share|accept-deck)$/.test(path);
  }
  return false;
}
