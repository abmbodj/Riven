import * as authApi from '../api/authApi';

const GROUP_CHAT_CACHE_KEY = 'riven_group_chat_cache';
const MAX_CACHED_GROUP_THREADS = 30;

export function sortMessagesChronologically(messages = []) {
    return [...messages].sort((left, right) => {
        const leftTime = new Date(left.createdAt).getTime();
        const rightTime = new Date(right.createdAt).getTime();
        if (leftTime !== rightTime) return leftTime - rightTime;
        return String(left.id).localeCompare(String(right.id));
    });
}

export const groupChatCache = {
    _loaded: false,
    messages: {},
    times: {},
    _hydrate() {
        if (this._loaded || typeof sessionStorage === 'undefined') return;
        this._loaded = true;
        try {
            const raw = sessionStorage.getItem(GROUP_CHAT_CACHE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw);
            this.messages = parsed.messages || {};
            this.times = parsed.times || {};
        } catch {
            this.messages = {};
            this.times = {};
        }
    },
    _persist() {
        if (typeof sessionStorage === 'undefined') return;
        try {
            sessionStorage.setItem(GROUP_CHAT_CACHE_KEY, JSON.stringify({
                messages: this.messages,
                times: this.times,
            }));
        } catch {
            // Cache is an optimization only.
        }
    },
    _key(currentUserId, groupId) {
        if (!currentUserId || !groupId) return null;
        return `${currentUserId}:${groupId}`;
    },
    get(currentUserId, groupId) {
        this._hydrate();
        const key = this._key(currentUserId, groupId);
        return key ? this.messages[key] || [] : [];
    },
    set(currentUserId, groupId, messages) {
        this._hydrate();
        const key = this._key(currentUserId, groupId);
        if (!key) return;
        this.messages[key] = sortMessagesChronologically(messages);
        this.times[key] = Date.now();

        const keys = Object.keys(this.messages);
        if (keys.length > MAX_CACHED_GROUP_THREADS) {
            const sortedKeys = keys.sort((left, right) => (this.times[left] || 0) - (this.times[right] || 0));
            for (const staleKey of sortedKeys.slice(0, keys.length - MAX_CACHED_GROUP_THREADS)) {
                delete this.messages[staleKey];
                delete this.times[staleKey];
            }
        }

        this._persist();
    },
};

/**
 * Warm the chat cache for a group ahead of the user opening the Chat tab.
 * Best-effort: skips when the cache is already warm and swallows errors so a
 * failed prefetch never affects the group page load.
 */
export async function prefetchGroupMessages(currentUserId, groupId) {
    if (!currentUserId || !groupId) return;
    if (groupChatCache.get(currentUserId, groupId).length > 0) return; // already warm
    try {
        const msgs = await authApi.getGroupMessages(groupId);
        groupChatCache.set(currentUserId, groupId, msgs);
    } catch {
        // Prefetch is best-effort.
    }
}
