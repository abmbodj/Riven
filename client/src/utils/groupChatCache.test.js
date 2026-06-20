import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/authApi', () => ({
    getGroupMessages: vi.fn(),
}));

const authApi = await import('../api/authApi');
const { groupChatCache, prefetchGroupMessages, sortMessagesChronologically } = await import('./groupChatCache');

const sample = [
    { id: 'b', createdAt: '2026-06-01T17:01:00', content: 'second' },
    { id: 'a', createdAt: '2026-06-01T17:00:00', content: 'first' },
];

describe('groupChatCache', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        sessionStorage.clear();
        groupChatCache._loaded = false;
        groupChatCache.messages = {};
        groupChatCache.times = {};
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('stores messages chronologically and reads them back', () => {
        groupChatCache.set(42, 'g1', sample);
        const stored = groupChatCache.get(42, 'g1');
        expect(stored.map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('keys cache per user+group and returns [] for unknown threads', () => {
        groupChatCache.set(42, 'g1', sample);
        expect(groupChatCache.get(99, 'g1')).toEqual([]);
        expect(groupChatCache.get(42, 'other')).toEqual([]);
    });

    it('sortMessagesChronologically orders by time then id', () => {
        expect(sortMessagesChronologically(sample).map((m) => m.id)).toEqual(['a', 'b']);
    });
});

describe('prefetchGroupMessages', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        sessionStorage.clear();
        groupChatCache._loaded = false;
        groupChatCache.messages = {};
        groupChatCache.times = {};
    });

    it('warms the cache from the API when empty', async () => {
        authApi.getGroupMessages.mockResolvedValue(sample);
        await prefetchGroupMessages(42, 'g1');
        expect(authApi.getGroupMessages).toHaveBeenCalledWith('g1');
        expect(groupChatCache.get(42, 'g1').map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('skips the fetch when the cache is already warm', async () => {
        groupChatCache.set(42, 'g1', sample);
        await prefetchGroupMessages(42, 'g1');
        expect(authApi.getGroupMessages).not.toHaveBeenCalled();
    });

    it('no-ops without a user or group id', async () => {
        await prefetchGroupMessages(undefined, 'g1');
        await prefetchGroupMessages(42, undefined);
        expect(authApi.getGroupMessages).not.toHaveBeenCalled();
    });

    it('swallows API errors so the group load is never affected', async () => {
        authApi.getGroupMessages.mockRejectedValue(new Error('boom'));
        await expect(prefetchGroupMessages(42, 'g1')).resolves.toBeUndefined();
        expect(groupChatCache.get(42, 'g1')).toEqual([]);
    });
});
