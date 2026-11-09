const xss = require('xss');

function sanitizeDeep(value) {
    if (typeof value === 'string') return xss(value);
    if (Array.isArray(value)) return value.map(sanitizeDeep);
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeDeep(item)]));
    }
    return value;
}

function sanitizeRequest(req, res, next) {
    if (req.path === '/api/webhooks/stripe') return next();
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        req.body = sanitizeDeep(req.body);
    }
    // Express 5 exposes query through a getter; shadow it with the sanitized result.
    if (req.query) Object.defineProperty(req, 'query', { value: sanitizeDeep(req.query), writable: true, configurable: true, enumerable: true });
    if (req.params) req.params = sanitizeDeep(req.params);
    next();
}

module.exports = { sanitizeRequest };
