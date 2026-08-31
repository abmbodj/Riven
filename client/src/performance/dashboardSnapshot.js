export const DASHBOARD_CACHE_KEY = 'dashboard:v1';
export const DASHBOARD_CACHE_TTL = 24 * 60 * 60 * 1000;

function isSnapshot(value) {
    return Boolean(value && Number(value.version) === 1);
}

export async function loadDashboardSnapshot({
    cache,
    fetchSnapshot,
    fallbackFetch,
    onSnapshot = () => {},
}) {
    const cached = cache.peek(DASHBOARD_CACHE_KEY);
    if (isSnapshot(cached)) {
        onSnapshot(cached, { cacheState: 'cached' });
    }

    try {
        const fresh = await fetchSnapshot();
        if (!isSnapshot(fresh)) throw new Error('Unsupported dashboard snapshot');
        cache.setPersistent(DASHBOARD_CACHE_KEY, fresh, DASHBOARD_CACHE_TTL);
        onSnapshot(fresh, { cacheState: cached ? 'fresh' : 'miss' });
        return {
            snapshot: fresh,
            cacheState: cached ? 'fresh' : 'miss',
            stale: false,
            error: null,
        };
    } catch (error) {
        if (isSnapshot(cached)) {
            return {
                snapshot: cached,
                cacheState: 'stale',
                stale: true,
                error,
            };
        }

        if (typeof fallbackFetch !== 'function') throw error;
        const fallback = await fallbackFetch();
        cache.setPersistent(DASHBOARD_CACHE_KEY, fallback, DASHBOARD_CACHE_TTL);
        onSnapshot(fallback, { cacheState: 'fallback' });
        return {
            snapshot: fallback,
            cacheState: 'fallback',
            stale: false,
            error,
        };
    }
}

export function updateCachedAssignment(cache, assignmentId, patch) {
    const snapshot = cache.peek(DASHBOARD_CACHE_KEY);
    if (!isSnapshot(snapshot)) return null;
    const assignments = (snapshot.assignments || []).map((assignment) => (
        String(assignment.id) === String(assignmentId)
            ? { ...assignment, ...patch }
            : assignment
    ));
    const next = { ...snapshot, assignments };
    cache.setPersistent(DASHBOARD_CACHE_KEY, next, DASHBOARD_CACHE_TTL);
    return next;
}
