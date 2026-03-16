const NodeCache = require('node-cache');

const cache = new NodeCache({
    stdTTL: 30,
    checkperiod: 60,
    useClones: false,
});

function userKey(userId, resource) {
    return `${userId}:${resource}`;
}

function invalidate(userId, resource) {
    cache.del(userKey(userId, resource));
}

function invalidateAll(userId) {
    const keys = cache.keys().filter(k => k.startsWith(`${userId}:`));
    if (keys.length) cache.del(keys);
}

async function wrap(userId, resource, fn, ttl) {
    const key = userKey(userId, resource);
    const cached = cache.get(key);
    if (cached !== undefined) return cached;

    const result = await fn();
    cache.set(key, result, ttl);
    return result;
}

module.exports = { cache, userKey, invalidate, invalidateAll, wrap };
