/**
 * In-memory cache with TTL, plus an opt-in user-scoped persistent layer
 * (sessionStorage) and stale-while-revalidate reads for instant page loads.
 *
 * - The original API (get/set/delete/clear/wrap) is unchanged and in-memory only,
 *   so existing callers (folders/tags/classes...) keep working as before.
 * - Keys written via setPersistent / swr({ persist: true }) are ALSO mirrored to
 *   sessionStorage, scoped to the current user, so a snapshot survives reloads
 *   within a session and seeds the next render instantly. Freshness comes from
 *   always revalidating on read — not from the TTL.
 */

const PERSIST_KEY = 'riven_groups_cache_v1';
// Persisted snapshots are retained long enough to survive reloads / navigation
// gaps within a session; data is kept fresh by revalidating on read, not by TTL.
const PERSIST_RETENTION = 24 * 60 * 60 * 1000; // 24h

const STORE = (() => {
    try {
        return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    } catch {
        return null;
    }
})();

export class Cache {
    constructor() {
        this.store = new Map();
        this._persist = new Map(); // persisted entries mirror (a subset of `store`)
        this._inflight = new Map();
        this._userId = null;
        this._loaded = false;
    }

    set(key, value, ttl = 60000) { // Default 60s TTL
        this.store.set(key, { value, expiresAt: Date.now() + ttl });
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

    /** Non-mutating, TTL-respecting read across both in-memory and persisted maps. */
    peek(key) {
        const item = this.store.get(key) || this._persist.get(key);
        if (!item) return null;
        if (Date.now() > item.expiresAt) return null;
        return item.value;
    }

    delete(key) {
        this.store.delete(key);
        if (this._persist.delete(key)) this._flush();
    }

    /** Delete every key beginning with `prefix` (e.g. `group-files:42:`). */
    deletePrefix(prefix) {
        for (const key of this.store.keys()) {
            if (key.startsWith(prefix)) this.store.delete(key);
        }
        let changed = false;
        for (const key of this._persist.keys()) {
            if (key.startsWith(prefix)) {
                this._persist.delete(key);
                changed = true;
            }
        }
        if (changed) this._flush();
    }

    clear() {
        this.store.clear();
        this._persist.clear();
        try { STORE?.removeItem(PERSIST_KEY); } catch { /* ignore */ }
    }

    // ---------- persistent, user-scoped layer ----------

    /** Hydrate persisted entries for `userId`; drops other-user / expired data. */
    ensureUser(userId) {
        if (userId == null) return;
        if (this._loaded && this._userId === userId) return;
        this._hydrate(userId);
    }

    _hydrate(userId) {
        const previousUser = this._userId;
        this._loaded = true;
        this._userId = userId;
        // Switching accounts without a reload: purge all stale in-memory data.
        if (previousUser != null && previousUser !== userId) this.store.clear();

        const next = new Map();
        try {
            const raw = STORE?.getItem(PERSIST_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && parsed._userId === userId && parsed.entries) {
                    const now = Date.now();
                    for (const [key, entry] of Object.entries(parsed.entries)) {
                        if (entry && entry.expiresAt > now) {
                            next.set(key, entry);
                            this.store.set(key, entry); // warm the in-memory map
                        }
                    }
                }
            }
        } catch { /* corrupt cache — ignore */ }

        this._persist = next;
        this._flush(); // rewrite under the current user (drops other-user data)
    }

    _flush() {
        if (!STORE) return;
        try {
            STORE.setItem(PERSIST_KEY, JSON.stringify({
                _userId: this._userId,
                entries: Object.fromEntries(this._persist),
            }));
        } catch { /* quota / serialization — ignore */ }
    }

    setPersistent(key, value, ttl = PERSIST_RETENTION) {
        const entry = { value, expiresAt: Date.now() + ttl };
        this.store.set(key, entry);
        this._persist.set(key, entry);
        this._flush();
    }

    /** Drop all persisted data — call on logout / account switch. */
    clearPersistent() {
        for (const key of this._persist.keys()) this.store.delete(key);
        this._persist.clear();
        this._userId = null;
        this._loaded = false;
        try { STORE?.removeItem(PERSIST_KEY); } catch { /* ignore */ }
    }

    // ---------- stale-while-revalidate ----------

    /**
     * Returns { value, revalidate }: `value` is the last-known cached value
     * (possibly stale, may be null) read synchronously; `revalidate()` fetches
     * fresh data, writes it to cache, and resolves to it. In-flight revalidations
     * are deduped per key. Does not auto-fire — the caller decides when.
     */
    swr(key, fn, { ttl = PERSIST_RETENTION, persist = false } = {}) {
        const entry = this._persist.get(key) || this.store.get(key);
        const value = entry ? entry.value : null;

        const revalidate = () => {
            if (this._inflight.has(key)) return this._inflight.get(key);
            const promise = Promise.resolve()
                .then(fn)
                .then(result => {
                    if (persist) this.setPersistent(key, result);
                    else this.set(key, result, ttl);
                    this._inflight.delete(key);
                    return result;
                })
                .catch(err => {
                    this._inflight.delete(key);
                    throw err;
                });
            this._inflight.set(key, promise);
            return promise;
        };

        return { value, revalidate };
    }

    // Helper to wrap async functions with caching + in-flight deduplication
    async wrap(key, fn, ttl) {
        const cached = this.get(key);
        if (cached !== null) return cached;

        // Deduplicate concurrent calls for the same key
        if (this._inflight.has(key)) return this._inflight.get(key);

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
