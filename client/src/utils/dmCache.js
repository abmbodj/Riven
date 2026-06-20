import { openDB } from 'idb';

const DB_NAME = 'riven-dm';
const DB_VERSION = 1;
const MAX_THREADS = 30;

let _dbPromise = null;

function _getDb() {
    if (!_dbPromise) {
        _dbPromise = openDB(DB_NAME, DB_VERSION, {
            upgrade(db) {
                if (!db.objectStoreNames.contains('threads')) {
                    db.createObjectStore('threads');
                }
                if (!db.objectStoreNames.contains('conversations')) {
                    db.createObjectStore('conversations');
                }
                if (!db.objectStoreNames.contains('users')) {
                    db.createObjectStore('users');
                }
            },
        });
    }
    return _dbPromise;
}

// Module-level in-memory cache — warm across route changes within a session.
// Populated synchronously from sessionStorage on first access, then
// enriched asynchronously from IndexedDB (which survives app restarts).
let _mem = { userId: null, threads: {}, conversations: null, times: {}, users: {} };
let _hydrated = false;

const SESSION_KEY = 'riven_dm_v2';

function _loadSession(userId) {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.userId !== userId) return;
        _mem.threads = parsed.threads || {};
        _mem.conversations = parsed.conversations || null;
        _mem.times = parsed.times || {};
        _mem.users = parsed.users || {};
    } catch { /* corrupt or unavailable */ }
}

function _saveSession() {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
            userId: _mem.userId,
            threads: _mem.threads,
            conversations: _mem.conversations,
            times: _mem.times,
            users: _mem.users,
        }));
    } catch { /* quota exceeded */ }
}

function _trimThreads() {
    const keys = Object.keys(_mem.threads);
    if (keys.length <= MAX_THREADS) return;
    const sorted = keys.sort((a, b) => (_mem.times[a] || 0) - (_mem.times[b] || 0));
    for (const key of sorted.slice(0, keys.length - MAX_THREADS)) {
        delete _mem.threads[key];
        delete _mem.times[key];
    }
}

export const dmCache = {
    // ── Sync reads (from in-memory, instant) ──────────────────────────────

    getThread(partnerId) {
        return _mem.threads[String(partnerId)] || [];
    },

    getConversations() {
        return _mem.conversations;
    },

    getUser(partnerId) {
        return _mem.users[String(partnerId)] || null;
    },

    // ── Hydration: call once on mount, awaiting gives cross-session data ──

    async hydrate(userId) {
        if (!userId) return;
        const uid = String(userId);

        // Switch user — wipe memory
        if (_mem.userId !== uid) {
            _mem = { userId: uid, threads: {}, conversations: null, times: {}, users: {} };
            _hydrated = false;
        }

        // Seed from sessionStorage immediately (same-session page reloads)
        if (!_hydrated) {
            _loadSession(uid);
        }

        if (_hydrated) return;

        // Enrich from IndexedDB (cross-session / cold launch)
        try {
            const db = await _getDb();
            const [idbThreads, idbConvs, idbUsers] = await Promise.all([
                db.getAll('threads'),
                db.get('conversations', uid),
                db.getAll('users'),
            ]);

            // Merge thread data — IDB wins if newer
            for (const entry of (idbThreads || [])) {
                if (!entry || entry.userId !== uid) continue;
                const pid = String(entry.partnerId);
                const memTime = _mem.times[pid] || 0;
                if ((entry.time || 0) > memTime) {
                    _mem.threads[pid] = entry.messages || [];
                    _mem.times[pid] = entry.time;
                }
            }

            // Merge conversations
            if (idbConvs && idbConvs.userId === uid) {
                if (!_mem.conversations) {
                    _mem.conversations = idbConvs.conversations;
                }
            }

            // Merge users
            for (const entry of (idbUsers || [])) {
                if (!entry) continue;
                const pid = String(entry.partnerId);
                if (!_mem.users[pid]) {
                    _mem.users[pid] = entry.user;
                }
            }
        } catch { /* IDB unavailable, continue with session data */ }

        _hydrated = true;
        _saveSession();
    },

    // ── Writes (update memory + persist async) ───────────────────────────

    setThread(userId, partnerId, messages) {
        const uid = String(userId);
        const pid = String(partnerId);
        _mem.threads[pid] = messages;
        _mem.times[pid] = Date.now();
        _trimThreads();
        _saveSession();

        _getDb().then(db => db.put('threads', {
            userId: uid,
            partnerId: pid,
            messages,
            time: Date.now(),
        }, `${uid}:${pid}`)).catch(() => {});
    },

    setConversations(userId, conversations) {
        const uid = String(userId);
        _mem.conversations = conversations;
        _saveSession();

        _getDb().then(db => db.put('conversations', {
            userId: uid,
            conversations,
        }, uid)).catch(() => {});
    },

    setUser(userId, partnerId, user) {
        const pid = String(partnerId);
        _mem.users[pid] = user;
        _saveSession();

        _getDb().then(db => db.put('users', {
            partnerId: pid,
            user,
        }, pid)).catch(() => {});
    },

    invalidateConversations() {
        _mem.conversations = null;
        _saveSession();
    },

    // Merge realtime message insert/update into cached thread
    applyThreadInsert(userId, partnerId, message) {
        const pid = String(partnerId);
        const current = _mem.threads[pid] || [];
        if (current.find(m => m.id === message.id)) return;
        this.setThread(userId, pid, [...current, message]);
    },

    applyThreadUpdate(userId, partnerId, message) {
        const pid = String(partnerId);
        const current = _mem.threads[pid] || [];
        this.setThread(userId, pid, current.map(m => m.id === message.id ? { ...m, ...message } : m));
    },

    applyThreadDelete(userId, partnerId, messageId) {
        const pid = String(partnerId);
        const current = _mem.threads[pid] || [];
        this.setThread(userId, pid, current.filter(m => m.id !== messageId));
    },
};
