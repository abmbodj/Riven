import { useState, useRef, useCallback, useEffect } from 'react';
import { useCalendarData } from './useCalendarData';
import { api } from '../api';
import { cache } from '../utils/cache';
import { groupKeys } from '../utils/groupCacheKeys';
import { getVisibleMonthRange } from '../utils/calendarDates';
import * as serverApi from '../api/authApi';

const toDateKey = (v) => {
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

/**
 * Manages all schedule data and mutations for a study group.
 *
 * - First paint seeded from cache: `loading` is only true on a true cold load.
 * - Range navigation never re-shows the skeleton; previous data stays visible
 *   with a subtle `revalidating` indicator while the new range loads.
 * - All six mutations (saveAvailability, setShareMode, createMeetup, joinMeetup,
 *   leaveMeetup, cancelMeetup) are optimistic: UI updates instantly, server is
 *   called async, error rolls back state + shows toast.
 * - Warms adjacent months on every range change so prev/next is always instant.
 */
export function useGroupSchedule({ groupId, currentUserId, toast, haptics }) {
    // Range state — GroupScheduleHub drives this via onRangeChange.
    const [range, setRangeState] = useState(() => getVisibleMonthRange(new Date()));

    const setRange = useCallback((start, end) => {
        setRangeState((prev) => {
            if (
                toDateKey(prev.start) === toDateKey(start) &&
                toDateKey(prev.end) === toDateKey(end)
            ) {
                return prev; // deduplicate — no re-render, no re-fetch
            }
            return {
                start: start instanceof Date ? start : new Date(start),
                end: end instanceof Date ? end : new Date(end),
            };
        });
    }, []);

    const calendarHook = useCalendarData(
        { kind: 'group', groupId },
        { rangeStart: range.start, rangeEnd: range.end },
    );

    // ── Keep-data-on-navigation: track last successfully loaded data so we never
    //    flash a skeleton when navigating to an uncached range.
    //
    // "Adjusting state when a prop changes" pattern (react.dev/learn/…#adjusting-some-state-when-a-prop-changes):
    // calling setLastData in the function body during render causes React to
    // discard the current output and immediately re-render — one synchronous
    // extra pass, no async scheduling, no visual flicker.
    const [lastData, setLastData] = useState(calendarHook.data ?? null);
    if (!calendarHook.loading && calendarHook.data !== lastData) {
        setLastData(calendarHook.data ?? null);
    }

    const hasAnyData = lastData != null;
    const calendarData = calendarHook.loading && hasAnyData ? lastData : calendarHook.data;
    const loading = calendarHook.loading && !hasAnyData;
    const revalidating = calendarHook.loading && hasAnyData;

    // Warm adjacent months on every range change (not just month-view ranges) so
    // week → month and week-boundary crossings are instant.
    useEffect(() => {
        if (!groupId || !range.start) return;
        const anchor = range.start instanceof Date ? range.start : new Date(range.start);
        const warm = (monthOffset) => {
            const a = new Date(anchor.getTime() + 15 * 86400000);
            a.setMonth(a.getMonth() + monthOffset);
            const { start: ws, end: we } = getVisibleMonthRange(a);
            if (!cache.peek(groupKeys.schedule(groupId, ws, we))) {
                api.getGroupScheduleCalendar(groupId, ws, we).catch(() => {});
            }
        };
        const run = () => { warm(-1); warm(1); };
        const hasIdle = typeof requestIdleCallback === 'function';
        const handle = hasIdle ? requestIdleCallback(run) : setTimeout(run, 0);
        return () => { if (hasIdle) cancelIdleCallback(handle); else clearTimeout(handle); };
    }, [groupId, range.start]);

    // ── Stable refs into the latest hook callbacks and data snapshot.
    //    Updated in effects (not during render) so they're valid at mutation call-time.
    const lastDataRef = useRef(null);
    const setDataRef = useRef(calendarHook.setData);
    const refreshRef = useRef(calendarHook.refresh);
    useEffect(() => {
        lastDataRef.current = lastData;
        setDataRef.current = calendarHook.setData;
        refreshRef.current = calendarHook.refresh;
    }, [lastData, calendarHook.setData, calendarHook.refresh]);

    // ─── Optimistic mutations ───────────────────────────────────────────────────

    /**
     * Replace the caller's painted free cells.
     * Optimistically updates my_availability + availability + my member row's
     * share_mode; rolls back on error. Painting cells implies participation, so
     * if the caller is currently hidden we flip them to busy_free in the same
     * optimistic pass (and the same reconcile) — this keeps the heatmap
     * denominator counting them immediately (it reads member.share_mode), so the
     * group view never flashes the "Find a time to meet" empty state after a save.
     * Re-throws so GroupScheduleHub can stay in edit mode on failure.
     */
    const saveAvailability = useCallback(async (cells) => {
        const snapshot = lastDataRef.current;
        const myIdStr = String(currentUserId);
        const wasHidden = !snapshot?.my_share_mode || snapshot.my_share_mode === 'hidden';
        const enableShare = cells.length > 0 && wasHidden;

        setDataRef.current((current) => {
            const nextShareMode = enableShare ? 'busy_free' : (current?.my_share_mode ?? null);
            return {
                ...current,
                my_availability: cells,
                my_share_mode: nextShareMode,
                availability: [
                    ...(current?.availability ?? []).filter((r) => String(r.user_id) !== myIdStr),
                    ...cells.map((cell) => ({ ...cell, user_id: currentUserId })),
                ],
                members: (current?.members ?? []).map((m) =>
                    String(m.id) === myIdStr ? { ...m, share_mode: nextShareMode } : m,
                ),
            };
        });

        try {
            await serverApi.setGroupAvailability(groupId, cells); // share flip is atomic in the RPC
            cache.deletePrefix(groupKeys.schedulePrefix(groupId));
            void refreshRef.current(); // background reconcile — don't block the save button
            toast?.success('Availability saved.');
        } catch (err) {
            setDataRef.current(snapshot);
            toast?.error(err?.message || 'Failed to save availability');
            throw err;
        }
    }, [groupId, currentUserId, toast]);

    /**
     * Toggle schedule visibility (busy_free / full / hidden).
     * If hiding: also drops the caller's rows from the group availability view.
     */
    const setShareMode = useCallback(async (visibilityMode) => {
        const snapshot = lastDataRef.current;
        const myIdStr = String(currentUserId);

        setDataRef.current((current) => ({
            ...current,
            my_share_mode: visibilityMode,
            availability: visibilityMode === 'hidden'
                ? (current?.availability ?? []).filter((r) => String(r.user_id) !== myIdStr)
                : current?.availability ?? [],
            members: (current?.members ?? []).map((m) =>
                String(m.id) === myIdStr ? { ...m, share_mode: visibilityMode } : m,
            ),
        }));

        try {
            await serverApi.setGroupScheduleShare(groupId, visibilityMode);
            void refreshRef.current();
            toast?.success(
                visibilityMode === 'hidden'
                    ? 'Your schedule is hidden for this group.'
                    : 'Availability updated.',
            );
        } catch (err) {
            setDataRef.current(snapshot);
            toast?.error(err?.message || 'Failed to update schedule sharing');
        }
    }, [groupId, currentUserId, toast]);

    /**
     * Propose a new session. Optimistically appends the meetup with a temp id;
     * swaps to the real server row on success.
     * Re-throws so the ProposeSessionSheet can stay open on failure.
     */
    const createMeetup = useCallback(async (payload) => {
        const snapshot = lastDataRef.current;
        const optimisticId = `optimistic-${Date.now()}`;
        const optimisticMeetup = {
            id: optimisticId,
            group_id: groupId,
            created_by: currentUserId,
            created_by_name: null,
            topic: payload.topic,
            start_at: payload.start_at,
            end_at: payload.end_at,
            timezone: payload.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
            location_label: payload.location_label ?? null,
            location_url: payload.location_url ?? null,
            status: 'scheduled',
            attendee_count: 1,
            attendee_ids: [currentUserId],
            is_joined: true,
            is_creator: true,
            attendees: [],
        };

        setDataRef.current((current) => ({
            ...current,
            meetups: [...(current?.meetups ?? []), optimisticMeetup],
        }));

        try {
            const saved = await serverApi.createGroupMeetup(groupId, payload);
            // Swap the temp-id row with the server-confirmed row.
            setDataRef.current((current) => ({
                ...current,
                meetups: (current?.meetups ?? []).map((m) =>
                    m.id === optimisticId
                        ? { ...optimisticMeetup, ...(saved ?? {}), id: saved?.id ?? optimisticId }
                        : m,
                ),
            }));
            // Scope cache invalidation to this group; background reconcile.
            cache.deletePrefix(groupKeys.schedulePrefix(groupId));
            void refreshRef.current();
            toast?.success('Study session proposed.');
        } catch (err) {
            setDataRef.current(snapshot);
            toast?.error(err?.message || 'Failed to create study session');
            throw err;
        }
    }, [groupId, currentUserId, toast]);

    /** RSVP join. Optimistic: flip is_joined + bump attendee_count. */
    const joinMeetup = useCallback(async (meetup) => {
        const snapshot = lastDataRef.current;
        setDataRef.current((current) => ({
            ...current,
            meetups: (current?.meetups ?? []).map((m) =>
                m.id === meetup.id
                    ? { ...m, is_joined: true, attendee_count: (m.attendee_count ?? 0) + 1 }
                    : m,
            ),
        }));
        try {
            haptics?.light?.();
            await serverApi.joinGroupMeetup(meetup.id);
            void refreshRef.current();
            toast?.success("You're going.");
        } catch (err) {
            setDataRef.current(snapshot);
            toast?.error(err?.message || 'Failed to join the session');
        }
    }, [toast, haptics]);

    /** RSVP leave. Optimistic: flip is_joined + decrement attendee_count. */
    const leaveMeetup = useCallback(async (meetup) => {
        const snapshot = lastDataRef.current;
        setDataRef.current((current) => ({
            ...current,
            meetups: (current?.meetups ?? []).map((m) =>
                m.id === meetup.id
                    ? { ...m, is_joined: false, attendee_count: Math.max(0, (m.attendee_count ?? 1) - 1) }
                    : m,
            ),
        }));
        try {
            haptics?.light?.();
            await serverApi.leaveGroupMeetup(meetup.id);
            void refreshRef.current();
            toast?.success('You left the session.');
        } catch (err) {
            setDataRef.current(snapshot);
            toast?.error(err?.message || 'Failed to leave the session');
        }
    }, [toast, haptics]);

    /**
     * Cancel a session (admin/creator only).
     * Optimistic: mark status='cancelled'.
     * Re-throws so the caller's confirm-dialog can catch failures.
     */
    const cancelMeetup = useCallback(async (meetup) => {
        const snapshot = lastDataRef.current;
        setDataRef.current((current) => ({
            ...current,
            meetups: (current?.meetups ?? []).map((m) =>
                m.id === meetup.id ? { ...m, status: 'cancelled' } : m,
            ),
        }));
        try {
            await serverApi.cancelGroupMeetup(meetup.id);
            cache.deletePrefix(groupKeys.schedulePrefix(meetup.group_id ?? groupId));
            void refreshRef.current();
            toast?.success('Session cancelled');
        } catch (err) {
            setDataRef.current(snapshot);
            toast?.error(err?.message || 'Failed to cancel the session');
            throw err;
        }
    }, [groupId, toast]);

    /**
     * Silent range refresh — call from realtime onChanged handlers.
     * Debounced (per-row realtime events arrive in bursts) and invalidates the
     * cache key first so the refetch can't be served stale by the SWR freshness
     * gate — this handler exists specifically because the DB just changed.
     */
    const refreshTimerRef = useRef(null);
    useEffect(() => () => clearTimeout(refreshTimerRef.current), []);
    const refreshRange = useCallback(() => {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => {
            cache.deletePrefix(groupKeys.schedulePrefix(groupId));
            void refreshRef.current();
        }, 250);
    }, [groupId]);

    return {
        calendarData,
        loading,
        revalidating,
        setRange,
        saveAvailability,
        setShareMode,
        createMeetup,
        joinMeetup,
        leaveMeetup,
        cancelMeetup,
        refreshRange,
    };
}
