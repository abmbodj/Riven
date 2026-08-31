import { describe, expect, it, vi } from 'vitest';
import { Cache } from '../utils/cache.js';
import {
    DASHBOARD_CACHE_KEY,
    loadDashboardSnapshot,
    updateCachedAssignment,
} from './dashboardSnapshot.js';

describe('dashboard snapshot cache', () => {
    it('paints cached data and retains it when background refresh fails', async () => {
        const cache = new Cache();
        cache.ensureUser(7);
        const cached = {
            version: 1,
            generatedAt: '2026-07-29T12:00:00.000Z',
            assignments: [{ id: 12, status: 'Pending' }],
        };
        cache.setPersistent(DASHBOARD_CACHE_KEY, cached);
        const onSnapshot = vi.fn();

        const result = await loadDashboardSnapshot({
            cache,
            fetchSnapshot: vi.fn().mockRejectedValue(new Error('offline')),
            fallbackFetch: vi.fn(),
            onSnapshot,
        });

        expect(onSnapshot).toHaveBeenCalledWith(cached, { cacheState: 'cached' });
        expect(result).toEqual({
            snapshot: cached,
            cacheState: 'stale',
            stale: true,
            error: expect.any(Error),
        });
    });

    it('uses the legacy fallback only on first-ever RPC failure', async () => {
        const cache = new Cache();
        cache.ensureUser(8);
        const fallback = { version: 1, assignments: [], classes: [] };

        const result = await loadDashboardSnapshot({
            cache,
            fetchSnapshot: vi.fn().mockRejectedValue(new Error('rpc unavailable')),
            fallbackFetch: vi.fn().mockResolvedValue(fallback),
        });

        expect(result).toMatchObject({
            snapshot: fallback,
            cacheState: 'fallback',
            stale: false,
        });
        expect(cache.peek(DASHBOARD_CACHE_KEY)).toEqual(fallback);
    });

    it('updates cached assignments optimistically without changing other fields', () => {
        const cache = new Cache();
        cache.ensureUser(9);
        cache.setPersistent(DASHBOARD_CACHE_KEY, {
            version: 1,
            classes: [{ id: 3, name: 'Math' }],
            assignments: [{ id: 2, status: 'Pending' }, { id: 4, status: 'Pending' }],
        });

        updateCachedAssignment(cache, 2, { status: 'Done' });

        expect(cache.peek(DASHBOARD_CACHE_KEY)).toEqual({
            version: 1,
            classes: [{ id: 3, name: 'Math' }],
            assignments: [{ id: 2, status: 'Done' }, { id: 4, status: 'Pending' }],
        });
    });
});
