/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Cache } from './cache';

const PERSIST_KEY = 'riven_groups_cache_v1';

describe('Cache', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        vi.useRealTimers();
        sessionStorage.clear();
    });

    describe('in-memory get/set (unchanged behaviour)', () => {
        it('returns a value before expiry and null after', () => {
            vi.useFakeTimers();
            const cache = new Cache();
            cache.set('k', 1, 1000);
            expect(cache.get('k')).toBe(1);
            vi.advanceTimersByTime(1001);
            expect(cache.get('k')).toBeNull();
        });

        it('wrap caches and dedupes concurrent calls', async () => {
            const cache = new Cache();
            const fn = vi.fn().mockResolvedValue('v');
            const [a, b] = await Promise.all([
                cache.wrap('k', fn, 1000),
                cache.wrap('k', fn, 1000),
            ]);
            expect(a).toBe('v');
            expect(b).toBe('v');
            expect(fn).toHaveBeenCalledTimes(1); // deduped
            expect(await cache.wrap('k', fn, 1000)).toBe('v');
            expect(fn).toHaveBeenCalledTimes(1); // served from cache
        });
    });

    describe('swr', () => {
        it('returns a null stale value then revalidates to fresh', async () => {
            const cache = new Cache();
            cache.ensureUser('user-1');
            const fn = vi.fn().mockResolvedValue(['fresh']);

            const first = cache.swr('groups', fn, { persist: true });
            expect(first.value).toBeNull();

            const fresh = await first.revalidate();
            expect(fresh).toEqual(['fresh']);

            // A subsequent read sees the persisted value synchronously.
            const second = cache.swr('groups', fn, { persist: true });
            expect(second.value).toEqual(['fresh']);
            expect(cache.peek('groups')).toEqual(['fresh']);
        });

        it('dedupes concurrent revalidations per key', async () => {
            const cache = new Cache();
            const fn = vi.fn().mockResolvedValue('v');
            const { revalidate } = cache.swr('k', fn, { persist: true });
            await Promise.all([revalidate(), revalidate()]);
            expect(fn).toHaveBeenCalledTimes(1);
        });

        it('persists to sessionStorage when persist:true', async () => {
            const cache = new Cache();
            cache.ensureUser('user-1');
            await cache.swr('groups', () => Promise.resolve([1, 2]), { persist: true }).revalidate();

            const raw = JSON.parse(sessionStorage.getItem(PERSIST_KEY));
            expect(raw._userId).toBe('user-1');
            expect(raw.entries.groups.value).toEqual([1, 2]);
        });

        it('does not persist when persist:false', async () => {
            const cache = new Cache();
            cache.ensureUser('user-1');
            await cache.swr('sessions', () => Promise.resolve([1]), { persist: false, ttl: 1000 }).revalidate();
            const raw = JSON.parse(sessionStorage.getItem(PERSIST_KEY) || '{"entries":{}}');
            expect(raw.entries.sessions).toBeUndefined();
            expect(cache.peek('sessions')).toEqual([1]); // still in-memory
        });
    });

    describe('persistence round-trip (survives reload)', () => {
        it('a fresh instance hydrates persisted entries for the same user', () => {
            const a = new Cache();
            a.ensureUser('user-1');
            a.setPersistent('group-info:42', { name: 'Bio' });

            // Simulate a reload: a brand-new Cache reading the same sessionStorage.
            const b = new Cache();
            b.ensureUser('user-1');
            expect(b.peek('group-info:42')).toEqual({ name: 'Bio' });
        });

        it('drops persisted entries that belong to a different user', () => {
            const a = new Cache();
            a.ensureUser('user-1');
            a.setPersistent('group-info:42', { name: 'Bio' });

            const b = new Cache();
            b.ensureUser('user-2'); // different account
            expect(b.peek('group-info:42')).toBeNull();
            const raw = JSON.parse(sessionStorage.getItem(PERSIST_KEY));
            expect(raw._userId).toBe('user-2');
            expect(raw.entries).toEqual({});
        });

        it('drops expired persisted entries on hydrate', () => {
            vi.useFakeTimers();
            const a = new Cache();
            a.ensureUser('user-1');
            a.setPersistent('k', 'v', 1000);
            vi.advanceTimersByTime(1001);

            const b = new Cache();
            b.ensureUser('user-1');
            expect(b.peek('k')).toBeNull();
        });
    });

    describe('deletePrefix', () => {
        it('removes matching keys from both maps and reflushes', () => {
            const cache = new Cache();
            cache.ensureUser('user-1');
            cache.setPersistent('group-files:42:root', [1]);
            cache.setPersistent('group-files:42:folderA', [2]);
            cache.setPersistent('group-files:99:root', [3]);

            cache.deletePrefix('group-files:42:');

            expect(cache.peek('group-files:42:root')).toBeNull();
            expect(cache.peek('group-files:42:folderA')).toBeNull();
            expect(cache.peek('group-files:99:root')).toEqual([3]);

            const raw = JSON.parse(sessionStorage.getItem(PERSIST_KEY));
            expect(Object.keys(raw.entries)).toEqual(['group-files:99:root']);
        });
    });

    describe('delete / clearPersistent', () => {
        it('delete removes a persisted key from storage', () => {
            const cache = new Cache();
            cache.ensureUser('user-1');
            cache.setPersistent('groups', [1]);
            cache.delete('groups');
            expect(cache.peek('groups')).toBeNull();
            const raw = JSON.parse(sessionStorage.getItem(PERSIST_KEY));
            expect(raw.entries.groups).toBeUndefined();
        });

        it('clearPersistent wipes persisted data and storage', () => {
            const cache = new Cache();
            cache.ensureUser('user-1');
            cache.setPersistent('groups', [1]);
            cache.setPersistent('group-info:42', { name: 'Bio' });

            cache.clearPersistent();

            expect(cache.peek('groups')).toBeNull();
            expect(cache.peek('group-info:42')).toBeNull();
            expect(sessionStorage.getItem(PERSIST_KEY)).toBeNull();
        });
    });

    describe('ensureUser', () => {
        it('is a no-op for null/undefined user id', () => {
            const cache = new Cache();
            expect(() => cache.ensureUser(undefined)).not.toThrow();
            expect(() => cache.ensureUser(null)).not.toThrow();
            expect(sessionStorage.getItem(PERSIST_KEY)).toBeNull();
        });
    });

    // The freshness gate is what lets swrRead skip the network (the egress fix): a
    // recently-fetched entry is served from cache, a stale one triggers a refetch,
    // while the snapshot itself is retained for instant first paint until its TTL.
    describe('isFresh (egress freshness gate)', () => {
        it('is false for a missing key', () => {
            expect(new Cache().isFresh('missing', 1000)).toBe(false);
        });

        it('is true within maxAge of the last write and false after', () => {
            vi.useFakeTimers();
            const cache = new Cache();
            cache.set('k', 'v', 60000);
            expect(cache.isFresh('k', 1000)).toBe(true);
            vi.advanceTimersByTime(1001);
            expect(cache.isFresh('k', 1000)).toBe(false); // stale -> swrRead revalidates
            expect(cache.get('k')).toBe('v');              // value retained for instant paint
        });

        it('is false once the entry is past its retention expiry', () => {
            vi.useFakeTimers();
            const cache = new Cache();
            cache.set('k', 'v', 1000);
            vi.advanceTimersByTime(1001);
            expect(cache.isFresh('k', 60000)).toBe(false);
        });

        it('marks a freshly revalidated swr entry as fresh', async () => {
            const cache = new Cache();
            cache.ensureUser('user-1');
            await cache.swr('groups', () => Promise.resolve(['g']), { persist: true }).revalidate();
            expect(cache.isFresh('groups', 60000)).toBe(true);
        });
    });
});
