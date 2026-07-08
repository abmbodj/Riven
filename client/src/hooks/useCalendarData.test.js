import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCalendarData } from './useCalendarData.js';
import { cache } from '../utils/cache.js';

vi.mock('../api', () => ({
    api: {
        getGroupScheduleCalendar: vi.fn(),
    },
}));

const { api } = await import('../api');

beforeEach(() => {
    cache.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useCalendarData optimistic writes vs. in-flight fetches', () => {
    it('does not let a slow in-flight fetch overwrite a newer optimistic update', async () => {
        // The initial mount fetch never resolves during this test — it stands
        // in for a slow request that's still in flight when the user acts.
        let releaseInitialFetch;
        const initialFetch = new Promise((resolve) => { releaseInitialFetch = resolve; });
        api.getGroupScheduleCalendar.mockReturnValueOnce(initialFetch);

        const { result } = renderHook(() => useCalendarData(
            { kind: 'group', groupId: 'g1' },
            { rangeStart: '2026-06-01', rangeEnd: '2026-06-30' },
        ));

        expect(result.current.loading).toBe(true);

        // User toggles visibility before the initial fetch has resolved — this
        // is the optimistic write path used by setShareMode/saveAvailability.
        act(() => {
            result.current.setData((current) => ({ ...current, my_share_mode: 'busy_free' }));
        });
        expect(result.current.data.my_share_mode).toBe('busy_free');

        // The slow initial fetch finally resolves with the *old* pre-toggle
        // state. Without the reqRef bump in setValue, this would silently
        // clobber the optimistic 'busy_free' back to 'hidden'.
        await act(async () => {
            releaseInitialFetch({ my_share_mode: 'hidden', members: [], schedule_slots: [], meetups: [] });
            await initialFetch;
        });

        expect(result.current.data.my_share_mode).toBe('busy_free');
    });

    it('still applies a refresh() that is issued after the optimistic write', async () => {
        api.getGroupScheduleCalendar.mockResolvedValueOnce({ my_share_mode: 'hidden', members: [], schedule_slots: [], meetups: [] });

        const { result } = renderHook(() => useCalendarData(
            { kind: 'group', groupId: 'g2' },
            { rangeStart: '2026-06-01', rangeEnd: '2026-06-30' },
        ));

        await waitFor(() => expect(result.current.data.my_share_mode).toBe('hidden'));

        act(() => {
            result.current.setData((current) => ({ ...current, my_share_mode: 'busy_free' }));
        });

        api.getGroupScheduleCalendar.mockResolvedValueOnce({ my_share_mode: 'busy_free', members: [], schedule_slots: [], meetups: [] });
        await act(async () => {
            await result.current.refresh();
        });

        expect(result.current.data.my_share_mode).toBe('busy_free');
    });
});
