import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (hoisted — no top-level variable refs) ───────────────────────

vi.mock('../utils/calendarDates', () => ({
    getVisibleMonthRange: () => ({
        start: new Date('2026-06-01'),
        end: new Date('2026-06-30'),
    }),
}));

vi.mock('../utils/groupCacheKeys', () => ({
    groupKeys: {
        schedule:       (id, s, e) => `gs:${id}:${String(s).slice(0,10)}:${String(e).slice(0,10)}`,
        schedulePrefix: (id) => `gs:${id}:`,
    },
}));

vi.mock('../utils/cache', () => ({
    cache: {
        peek:         vi.fn(() => null),
        setPersistent: vi.fn(),
        deletePrefix:  vi.fn(),
        ensureUser:    vi.fn(),
        swr:           vi.fn(() => ({ value: null, revalidate: vi.fn(() => Promise.resolve(null)) })),
    },
}));

vi.mock('../api', () => ({
    api: { getGroupScheduleCalendar: vi.fn(() => Promise.resolve(null)) },
}));

vi.mock('../api/authApi', () => ({
    setGroupAvailability:  vi.fn(() => Promise.resolve()),
    setGroupScheduleShare: vi.fn(() => Promise.resolve()),
    createGroupMeetup:     vi.fn(() => Promise.resolve(null)),
    joinGroupMeetup:       vi.fn(() => Promise.resolve()),
    leaveGroupMeetup:      vi.fn(() => Promise.resolve()),
    cancelGroupMeetup:     vi.fn(() => Promise.resolve()),
}));

// useCalendarData is controlled per-test via _returnValue.
vi.mock('./useCalendarData', () => ({ useCalendarData: vi.fn() }));

// ── Test setup ─────────────────────────────────────────────────────────────────

import { useGroupSchedule } from './useGroupSchedule';
import { useCalendarData } from './useCalendarData';
import * as serverApi from '../api/authApi';
import { cache } from '../utils/cache';

const GROUP_ID  = 'grp-1';
const USER_ID   = 42;
const SAMPLE_DATA = {
    members:          [{ id: USER_ID, username: 'ab' }],
    schedule_slots:   [],
    availability:     [{ user_id: USER_ID, day_of_week: 1, hour: 10 }],
    my_availability:  [{ day_of_week: 1, hour: 10 }],
    my_schedule_slots: [],
    meetups:          [],
    my_share_mode:    'busy_free',
};

const toast   = { success: vi.fn(), error: vi.fn() };
const haptics = { light: vi.fn() };

// Shared mocks controlled by tests.
let mockRefresh;
let mockSetData;

function stubCalendar({ data = null, loading = true } = {}) {
    mockRefresh = vi.fn(() => Promise.resolve(null));
    mockSetData = vi.fn();
    vi.mocked(useCalendarData).mockReturnValue({ data, loading, refresh: mockRefresh, setData: mockSetData });
}

function buildHook() {
    return renderHook(() =>
        useGroupSchedule({ groupId: GROUP_ID, currentUserId: USER_ID, toast, haptics }),
    );
}

beforeEach(() => {
    vi.clearAllMocks();
    stubCalendar();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useGroupSchedule', () => {
    describe('cold load', () => {
        it('exposes loading=true with no data before first fetch', () => {
            stubCalendar({ data: null, loading: true });
            const { result } = buildHook();
            expect(result.current.loading).toBe(true);
            expect(result.current.calendarData).toBeNull();
            expect(result.current.revalidating).toBe(false);
        });

        it('clears loading once data arrives', () => {
            stubCalendar({ data: null, loading: true });
            const { result, rerender } = buildHook();

            stubCalendar({ data: SAMPLE_DATA, loading: false });
            rerender();

            expect(result.current.loading).toBe(false);
            expect(result.current.revalidating).toBe(false);
            expect(result.current.calendarData).toBe(SAMPLE_DATA);
        });
    });

    describe('range navigation — no skeleton after first load', () => {
        it('keeps previous data visible (revalidating=true) when navigating to an uncached range', () => {
            stubCalendar({ data: SAMPLE_DATA, loading: false });
            const { result, rerender } = buildHook();
            expect(result.current.calendarData).toBe(SAMPLE_DATA);

            // New range has no cache — useCalendarData goes back to loading
            stubCalendar({ data: null, loading: true });
            rerender();

            expect(result.current.loading).toBe(false);      // no skeleton
            expect(result.current.revalidating).toBe(true);  // inline indicator
            expect(result.current.calendarData).toBe(SAMPLE_DATA); // previous data
        });

        it('shows fresh data and clears revalidating once the new range loads', () => {
            const nextData = { ...SAMPLE_DATA, meetups: [{ id: 'm2' }] };

            stubCalendar({ data: SAMPLE_DATA, loading: false });
            const { result, rerender } = buildHook();

            stubCalendar({ data: null, loading: true });
            rerender();
            expect(result.current.revalidating).toBe(true);

            stubCalendar({ data: nextData, loading: false });
            rerender();
            expect(result.current.loading).toBe(false);
            expect(result.current.revalidating).toBe(false);
            expect(result.current.calendarData).toBe(nextData);
        });
    });

    describe('saveAvailability', () => {
        it('calls setData optimistically before the server resolves', async () => {
            stubCalendar({ data: SAMPLE_DATA, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            let resolveServer;
            vi.mocked(serverApi.setGroupAvailability).mockReturnValueOnce(
                new Promise((r) => { resolveServer = r; }),
            );

            const cells = [{ day_of_week: 2, hour: 14 }];
            act(() => { result.current.saveAvailability(cells); });

            // setData invoked before server settled
            expect(mockSetData).toHaveBeenCalledTimes(1);
            const next = mockSetData.mock.calls[0][0](SAMPLE_DATA);
            expect(next.my_availability).toEqual(cells);
            expect(next.availability.filter((r) => r.user_id === USER_ID)).toEqual(
                cells.map((c) => ({ ...c, user_id: USER_ID })),
            );

            resolveServer();
            await act(() => Promise.resolve());
            expect(toast.success).toHaveBeenCalledWith('Availability saved.');
        });

        it('first-run (hidden): flips share_mode optimistically and never calls setGroupScheduleShare', async () => {
            const firstRunData = {
                ...SAMPLE_DATA,
                my_share_mode: null,
                members: [{ id: USER_ID, username: 'ab', share_mode: 'hidden' }],
                availability: [],
                my_availability: [],
            };
            stubCalendar({ data: firstRunData, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            const cells = [{ day_of_week: 2, hour: 14 }];
            await act(() => result.current.saveAvailability(cells));

            // RPC owns the share flip — client must not call setGroupScheduleShare
            expect(serverApi.setGroupScheduleShare).not.toHaveBeenCalled();
            expect(serverApi.setGroupAvailability).toHaveBeenCalledTimes(1);
            // Cache must be invalidated so the post-save refresh sees fresh data
            expect(cache.deletePrefix).toHaveBeenCalledWith(`gs:${GROUP_ID}:`);

            // Optimistic state should have promoted the member to busy_free
            const optimisticCall = mockSetData.mock.calls[0][0];
            const next = optimisticCall(firstRunData);
            expect(next.my_share_mode).toBe('busy_free');
            const myMember = next.members.find((m) => m.id === USER_ID);
            expect(myMember.share_mode).toBe('busy_free');
            // Availability cells merged in
            expect(next.availability.some((r) => r.user_id === USER_ID && r.day_of_week === 2)).toBe(true);
        });

        it('rolls back state and re-throws on server error', async () => {
            stubCalendar({ data: SAMPLE_DATA, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            vi.mocked(serverApi.setGroupAvailability).mockRejectedValueOnce(new Error('Server down'));

            await act(async () => {
                await expect(
                    result.current.saveAvailability([{ day_of_week: 3, hour: 9 }]),
                ).rejects.toThrow('Server down');
            });

            // Two setData calls: optimistic, then rollback
            expect(mockSetData).toHaveBeenCalledTimes(2);
            expect(mockSetData.mock.calls[1][0]).toBe(SAMPLE_DATA); // snapshot restored
            expect(toast.error).toHaveBeenCalled();
        });
    });

    describe('createMeetup', () => {
        it('appends an optimistic meetup with a temp id before server confirms', async () => {
            stubCalendar({ data: SAMPLE_DATA, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            let resolveServer;
            const serverMeetup = { id: 'srv-m1', status: 'scheduled' };
            vi.mocked(serverApi.createGroupMeetup).mockReturnValueOnce(
                new Promise((r) => { resolveServer = () => r(serverMeetup); }),
            );

            const payload = { topic: 'Review', start_at: '2026-07-01T14:00:00Z', end_at: '2026-07-01T15:00:00Z', timezone: 'UTC' };
            act(() => { result.current.createMeetup(payload); });

            // First call: append optimistic
            expect(mockSetData).toHaveBeenCalledTimes(1);
            const withOptimistic = mockSetData.mock.calls[0][0](SAMPLE_DATA);
            expect(withOptimistic.meetups).toHaveLength(1);
            expect(withOptimistic.meetups[0].id).toMatch(/^optimistic-/);
            expect(withOptimistic.meetups[0].is_joined).toBe(true);
            const tempId = withOptimistic.meetups[0].id;

            resolveServer();
            await act(() => Promise.resolve());

            // Second call: swap temp id with real id
            expect(mockSetData).toHaveBeenCalledTimes(2);
            const swapped = mockSetData.mock.calls[1][0](withOptimistic);
            expect(swapped.meetups[0].id).toBe('srv-m1');
            expect(swapped.meetups.find((m) => m.id === tempId)).toBeUndefined();
            expect(toast.success).toHaveBeenCalledWith('Study session proposed.');
        });

        it('rolls back and re-throws on server error', async () => {
            stubCalendar({ data: SAMPLE_DATA, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            vi.mocked(serverApi.createGroupMeetup).mockRejectedValueOnce(new Error('Quota exceeded'));
            await act(async () => {
                await expect(
                    result.current.createMeetup({ topic: 'X', start_at: '', end_at: '' }),
                ).rejects.toThrow('Quota exceeded');
            });
            expect(mockSetData.mock.calls[1][0]).toBe(SAMPLE_DATA);
        });
    });

    describe('joinMeetup / leaveMeetup', () => {
        const meetup = { id: 'm1', group_id: GROUP_ID, is_joined: false, attendee_count: 2 };
        const dataWithMeetup = { ...SAMPLE_DATA, meetups: [meetup] };

        it('joinMeetup: flips is_joined and bumps attendee_count optimistically', async () => {
            stubCalendar({ data: dataWithMeetup, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            await act(() => result.current.joinMeetup(meetup));

            expect(haptics.light).toHaveBeenCalled();
            const next = mockSetData.mock.calls[0][0](dataWithMeetup);
            expect(next.meetups[0].is_joined).toBe(true);
            expect(next.meetups[0].attendee_count).toBe(3);
            expect(toast.success).toHaveBeenCalledWith("You're going.");
        });

        it('joinMeetup: rolls back on server error (no re-throw)', async () => {
            stubCalendar({ data: dataWithMeetup, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            vi.mocked(serverApi.joinGroupMeetup).mockRejectedValueOnce(new Error('network'));
            await act(() => result.current.joinMeetup(meetup)); // must not throw

            expect(mockSetData.mock.calls[1][0]).toBe(dataWithMeetup);
            expect(toast.error).toHaveBeenCalled();
        });

        it('leaveMeetup: decrements count and flips is_joined', async () => {
            const joined = { ...meetup, is_joined: true, attendee_count: 3 };
            const data = { ...SAMPLE_DATA, meetups: [joined] };
            stubCalendar({ data, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            await act(() => result.current.leaveMeetup(joined));

            const next = mockSetData.mock.calls[0][0](data);
            expect(next.meetups[0].is_joined).toBe(false);
            expect(next.meetups[0].attendee_count).toBe(2);
            expect(toast.success).toHaveBeenCalledWith('You left the session.');
        });
    });

    describe('refreshRange', () => {
        it('debounces bursts and invalidates the schedule cache before refetching', () => {
            vi.useFakeTimers();
            stubCalendar({ data: SAMPLE_DATA, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            act(() => {
                result.current.refreshRange();
                result.current.refreshRange();
                result.current.refreshRange();
            });

            // Realtime events arrive in bursts (one per changed row) — must coalesce.
            expect(cache.deletePrefix).not.toHaveBeenCalled();
            expect(mockRefresh).not.toHaveBeenCalled();

            act(() => { vi.advanceTimersByTime(250); });

            expect(cache.deletePrefix).toHaveBeenCalledWith(`gs:${GROUP_ID}:`);
            expect(mockRefresh).toHaveBeenCalledTimes(1);

            vi.useRealTimers();
        });
    });

    describe('cancelMeetup', () => {
        const meetup = { id: 'm1', group_id: GROUP_ID, status: 'scheduled' };
        const dataWithMeetup = { ...SAMPLE_DATA, meetups: [meetup] };

        it('marks meetup cancelled optimistically', async () => {
            stubCalendar({ data: dataWithMeetup, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            await act(() => result.current.cancelMeetup(meetup));

            const next = mockSetData.mock.calls[0][0](dataWithMeetup);
            expect(next.meetups[0].status).toBe('cancelled');
            expect(toast.success).toHaveBeenCalledWith('Session cancelled');
        });

        it('rolls back and re-throws on server error', async () => {
            stubCalendar({ data: dataWithMeetup, loading: false });
            const { result, rerender } = buildHook();
            rerender();

            vi.mocked(serverApi.cancelGroupMeetup).mockRejectedValueOnce(new Error('forbidden'));
            await act(async () => {
                await expect(result.current.cancelMeetup(meetup)).rejects.toThrow('forbidden');
            });
            expect(mockSetData.mock.calls[1][0]).toBe(dataWithMeetup);
        });
    });
});
