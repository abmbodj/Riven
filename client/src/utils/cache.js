/**
 * Simple in-memory cache with TTL
 */
class Cache {
    constructor() {
        this.store = new Map();
    }

    set(key, value, ttl = 60000) { // Default 60s TTL
        const expiresAt = Date.now() + ttl;
        this.store.set(key, { value, expiresAt });
    }

    get(key) {
        const item = this.store.get(key);
        if (!item) return null;

        if (Date.now() > item.expiresAt) {
            this.store.delete(key);
            return null;
        }

        return item.value;
    }

    delete(key) {
        this.store.delete(key);
    }

    clear() {
        this.store.clear();
    }

    // Helper to wrap async functions with caching + in-flight deduplication
    async wrap(key, fn, ttl) {
        const cached = this.get(key);
        if (cached !== null) return cached;

        // Deduplicate concurrent calls for the same key
        if (this._inflight?.has(key)) return this._inflight.get(key);
        if (!this._inflight) this._inflight = new Map();

        const promise = fn().then(result => {
            this.set(key, result, ttl);
            this._inflight.delete(key);
            return result;
        }).catch(err => {
            this._inflight.delete(key);
            throw err;
        });

        this._inflight.set(key, promise);
        return promise;
    }

    startGarbageCollection(intervalMs = 60000) { // Default 1m interval
        if (this.gcInterval) clearInterval(this.gcInterval);
        this.gcInterval = setInterval(() => {
            const now = Date.now();
            for (const [key, item] of this.store.entries()) {
                if (now > item.expiresAt) {
                    this.store.delete(key);
                }
            }
        }, intervalMs);
    }
}

export const cache = new Cache();
// Automatically begin pruning memory to prevent passive cache leaks on inactive keys
cache.startGarbageCollection();
