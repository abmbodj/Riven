import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { cache } from '../utils/cache';
import { calendarKeys } from '../utils/calendarCacheKeys';
import { groupKeys } from '../utils/groupCacheKeys';
import { getVisibleMonthRange } from '../utils/calendarDates';

/**
 * Shared calendar data layer. Generalises the seed → revalidate → dedup →
 * pre-warm pattern that the group schedule pioneered (GroupDetails.jsx) so every
 * calendar surface (personal, group, exams) loads instantly:
 *
 *   - First paint is seeded synchronously from `cache.peek`, so `loading` is only
 *     ever true on a true cold load (nothing cached for the key).
 *   - The fetch runs through `api.*` (never `serverApi` directly), keeping
 *     api.js the single source of truth for caching + invalidation.
 *   - In-flight responses are deduped by request id, so navigating between
 *     month/week/day or groups can't let a stale response overwrite a newer one.
 *   - Range-scoped (group) sources pre-warm the adjacent months during idle time
 *     so prev/next navigation never flashes.
 */

const EMPTY_ARRAY = [];
const EMPTY_GROUP = { members: [], schedule_slots: [], meetups: [] };
const DEFAULT_RESOURCES = ['assignments', 'classes', 'schedule'];
const NOOP = () => {};
const NOOP_ASYNC = () => Promise.resolve(null);

/**
 * One cached resource. The seed is *derived during render* from `cache.peek(key)`
 * (the same instant-seed trick GroupDetails uses in its state initialisers), while
 * only fetched values live in React state — so the effect's only `setState` runs
 * after the await (never synchronously in the effect body). Stale responses are
 * dropped by request id. A null `key` makes the slot inert (used when a source
 * doesn't request a given resource) so hooks stay unconditional. `fetcher` must
 * be stable (memoise it in the caller).
 */
function useSeeded(key, fetcher) {
    const [fetched, setFetched] = useState(null); // { key, value } | null
    const reqRef = useRef(0);

    // Revalidate on mount and whenever the key changes. The promise chain is
    // inlined (setState only in .then/.catch callbacks, never synchronously) so
    // this stays a legitimate external-sync effect.
    useEffect(() => {
        if (!key) return undefined;
        const id = ++reqRef.current;
        let active = true;
        Promise.resolve()
            .then(fetcher)
            .then((fresh) => {
                if (active && id === reqRef.current) setFetched({ key, value: fresh });
            })
            .catch(() => {
                // Keep already-fetched data on a failed revalidate; otherwise fall
                // back to whatever the cache holds so `loading` still clears.
                if (active && id === reqRef.current) {
                    setFetched((prev) => (prev && prev.key === key ? prev : { key, value: cache.peek(key) }));
                }
            });
        return () => { active = false; };
    }, [key, fetcher]);

    const refresh = useCallback(() => {
        if (!key) return Promise.resolve(null);
        const id = ++reqRef.current;
        return Promise.resolve()
            .then(fetcher)
            .then((fresh) => {
                if (id === reqRef.current) setFetched({ key, value: fresh });
                return fresh;
            })
            .catch((err) => {
                if (id === reqRef.current) {
                    setFetched((prev) => (prev && prev.key === key ? prev : { key, value: cache.peek(key) }));
                }
                throw err;
            });
    }, [key, fetcher]);

    const setValue = useCallback((updater) => {
        // Bump the request id so any fetch already in flight (started before this
        // optimistic write) gets dropped by the `id === reqRef.current` guard
        // above instead of silently overwriting it when it resolves later —
        // without this, an optimistic update could flash correctly then revert
        // to stale data once an older in-flight request lands.
        reqRef.current += 1;
        setFetched((prev) => {
            const base = prev && prev.key === key ? prev.value : cache.peek(key);
            return { key, value: typeof updater === 'function' ? updater(base) : updater };
        });
    }, [key]);

    // Seed derived during render from the cache (no effect needed for first paint).
    const hasFetched = fetched != null && fetched.key === key;
    const seed = key ? cache.peek(key) : null;
    const value = hasFetched ? fetched.value : seed;
    const loading = !!key && !hasFetched && seed == null;

    return { value, loading, refresh, setValue };
}

/**
 * @param {{ kind: 'personal', resources?: string[] } | { kind: 'group', groupId: string } | { kind: 'exams' }} source
 *   Discriminated source descriptor. `kind` must be stable for a given mounted
 *   component (it selects which resource slots are active).
 * @param {{ rangeStart?: Date|string, rangeEnd?: Date|string }} [range]
 *   Visible range — only used by range-scoped (group) sources.
 * @returns {{ data: any, loading: boolean, refresh: () => Promise<any>, setData: any }}
 */
export function useCalendarData(source, { rangeStart, rangeEnd } = {}) {
    const kind = source?.kind ?? 'personal';
    const groupId = kind === 'group' ? source.groupId : null;
    const resources = kind === 'personal' ? (source?.resources ?? DEFAULT_RESOURCES) : EMPTY_ARRAY;

    // --- Personal resource slots (inert unless requested by the source) ---
    const fetchAssignments = useCallback(() => api.getAssignments(), []);
    const assignments = useSeeded(resources.includes('assignments') ? calendarKeys.assignments() : null, fetchAssignments);

    const fetchClasses = useCallback(() => api.getClasses(), []);
    const classes = useSeeded(resources.includes('classes') ? calendarKeys.classes() : null, fetchClasses);

    const fetchSchedule = useCallback(() => api.getSchedule(), []);
    const schedule = useSeeded(resources.includes('schedule') ? calendarKeys.schedule() : null, fetchSchedule);

    // --- Group schedule slot (inert unless group) ---
    const groupKey = groupId ? groupKeys.schedule(groupId, rangeStart, rangeEnd) : null;
    const fetchGroup = useCallback(() => (
        groupId ? api.getGroupScheduleCalendar(groupId, rangeStart, rangeEnd) : Promise.resolve(EMPTY_GROUP)
    ), [groupId, rangeStart, rangeEnd]);
    const group = useSeeded(groupKey, fetchGroup);

    // Pre-warm adjacent months so prev/next navigation is instant. Month-grid
    // ranges (>= 35 days) only — week/day ranges aren't worth warming.
    useEffect(() => {
        if (!groupId || !rangeStart || !rangeEnd) return undefined;
        const start = rangeStart instanceof Date ? rangeStart : new Date(rangeStart);
        const end = rangeEnd instanceof Date ? rangeEnd : new Date(rangeEnd);
        if (Math.round((end - start) / 86400000) < 35) return undefined;
        const warm = (monthOffset) => {
            const anchor = new Date(start.getTime() + 15 * 86400000);
            anchor.setMonth(anchor.getMonth() + monthOffset);
            const { start: wStart, end: wEnd } = getVisibleMonthRange(anchor);
            if (!cache.peek(groupKeys.schedule(groupId, wStart, wEnd))) {
                api.getGroupScheduleCalendar(groupId, wStart, wEnd).catch(() => {});
            }
        };
        const run = () => { warm(-1); warm(1); };
        if (typeof requestIdleCallback === 'function') {
            const handle = requestIdleCallback(run);
            return () => cancelIdleCallback(handle);
        }
        const timer = setTimeout(run, 0);
        return () => clearTimeout(timer);
    }, [groupId, rangeStart, rangeEnd]);

    if (kind === 'group') {
        return {
            data: group.value ?? EMPTY_GROUP,
            loading: group.loading,
            refresh: group.refresh,
            setData: group.setValue,
        };
    }

    if (kind === 'exams') {
        // Placeholder until the exams surface adopts the shared calendar (later phase).
        return { data: { exams: EMPTY_ARRAY }, loading: false, refresh: NOOP_ASYNC, setData: NOOP };
    }

    return {
        data: {
            assignments: assignments.value ?? EMPTY_ARRAY,
            classes: classes.value ?? EMPTY_ARRAY,
            scheduleSlots: schedule.value ?? EMPTY_ARRAY,
        },
        // Reveal as soon as assignments (the primary layer) resolve; classes &
        // schedule fill in without gating the whole calendar behind a skeleton.
        loading: assignments.loading,
        refresh: () => Promise.all([assignments.refresh(), classes.refresh(), schedule.refresh()]),
        setData: {
            setAssignments: assignments.setValue,
            setClasses: classes.setValue,
            setScheduleSlots: schedule.setValue,
        },
    };
}

export default useCalendarData;
