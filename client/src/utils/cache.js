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

    // Helper to wrap async functions with caching
    async wrap(key, fn, ttl) {
        const cached = this.get(key);
        if (cached !== null) return cached;
        
        const result = await fn();
        this.set(key, result, ttl);
        return result;
    }
}

export const cache = new Cache();
