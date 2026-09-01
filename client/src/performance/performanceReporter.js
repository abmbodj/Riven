const APPROVED_NAMES = new Set([
    'LCP',
    'INP',
    'CLS',
    'TTFB',
    'route-ready',
    'dashboard-data',
    'long-task',
    'fps',
    'visual-budget-transition',
]);

const ROUTE_TEMPLATES = [
    [/^\/$/, '/'],
    [/^\/dashboard\/?$/, '/dashboard'],
    [/^\/account\/?$/, '/account'],
    [/^\/onboarding\/?$/, '/onboarding'],
    [/^\/decks(?:\/library)?\/?$/, '/decks/library'],
    [/^\/deck\/[^/]+\/study\/?$/, '/deck/:id/study'],
    [/^\/deck\/[^/]+\/test\/?$/, '/deck/:id/test'],
    [/^\/deck\/[^/]+\/?$/, '/deck/:id'],
    [/^\/notes\/?$/, '/notes'],
    [/^\/note\/[^/]+\/?$/, '/note/:id'],
    [/^\/guides\/?$/, '/guides'],
    [/^\/guide\/[^/]+\/?$/, '/guide/:id'],
    [/^\/exams\/?$/, '/exams'],
    [/^\/exam\/[^/]+\/?$/, '/exam/:id'],
    [/^\/classes\/?$/, '/classes'],
    [/^\/class\/[^/]+\/?$/, '/class/:id'],
    [/^\/calendar\/?$/, '/calendar'],
    [/^\/groups\/[^/]+\/cram\/[^/]+\/?$/, '/groups/:id/cram/:id'],
    [/^\/groups\/[^/]+\/?$/, '/groups/:id'],
    [/^\/groups\/?$/, '/groups'],
    [/^\/messages\/[^/]+\/?$/, '/messages/:id'],
    [/^\/messages\/?$/, '/messages'],
    [/^\/profile\/[^/]+\/?$/, '/profile/:id'],
    [/^\/(themes|garden|settings|friends|create|youtube|privacy|terms|reset-password)\/?$/, (match) => `/${match[1]}`],
];

const VALID_UNITS = new Set(['ms', 'score', 'fps', 'count']);
const VALID_RATINGS = new Set(['good', 'needs-improvement', 'poor', 'unknown']);
const VALID_CACHE_STATES = new Set(['none', 'miss', 'cached', 'fresh', 'stale', 'fallback']);
const VALID_NAVIGATION_TYPES = new Set(['navigate', 'reload', 'back-forward', 'prerender', 'unknown']);
const VALID_BROWSER_CLASSES = new Set([
    'chromium-desktop',
    'chromium-mobile',
    'safari-desktop',
    'safari-mobile',
    'firefox-desktop',
    'firefox-mobile',
    'other',
]);

function toFiniteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 100) / 100 : 0;
}

export function getRouteTemplate(pathname = '/') {
    let path = '/';
    try {
        path = new URL(pathname, 'https://www.riven.rocks').pathname;
    } catch {
        path = String(pathname || '/').split(/[?#]/, 1)[0];
    }

    for (const [matcher, template] of ROUTE_TEMPLATES) {
        const match = path.match(matcher);
        if (!match) continue;
        return typeof template === 'function' ? template(match) : template;
    }
    return '/other';
}

export function getBrowserClass() {
    if (typeof navigator === 'undefined') return 'other';
    const ua = navigator.userAgent || '';
    const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
    if (/Firefox\//i.test(ua)) return mobile ? 'firefox-mobile' : 'firefox-desktop';
    if (/Safari\//i.test(ua) && !/(Chrome|Chromium|CriOS|Edg)\//i.test(ua)) {
        return mobile ? 'safari-mobile' : 'safari-desktop';
    }
    if (/(Chrome|Chromium|CriOS|Edg)\//i.test(ua)) {
        return mobile ? 'chromium-mobile' : 'chromium-desktop';
    }
    return 'other';
}

export function getNavigationType() {
    if (typeof performance === 'undefined') return 'unknown';
    const navigation = performance.getEntriesByType?.('navigation')?.[0];
    const type = navigation?.type === 'back_forward' ? 'back-forward' : navigation?.type;
    return VALID_NAVIGATION_TYPES.has(type) ? type : 'unknown';
}

export function shouldSamplePerformance(rate = 1) {
    const normalized = Math.max(0, Math.min(1, Number(rate) || 0));
    return Math.random() < normalized;
}

export function createPerformanceEvent(input = {}) {
    const name = APPROVED_NAMES.has(input.name) ? input.name : 'long-task';
    const rating = VALID_RATINGS.has(input.rating) ? input.rating : 'unknown';
    const cacheState = VALID_CACHE_STATES.has(input.cacheState) ? input.cacheState : 'none';
    const navigationType = VALID_NAVIGATION_TYPES.has(input.navigationType)
        ? input.navigationType
        : getNavigationType();
    const browserClass = VALID_BROWSER_CLASSES.has(input.browserClass)
        ? input.browserClass
        : getBrowserClass();

    return {
        name,
        value: toFiniteNumber(input.value),
        unit: VALID_UNITS.has(input.unit) ? input.unit : 'ms',
        rating,
        routeTemplate: getRouteTemplate(input.routeTemplate || input.pathname || globalThis.location?.pathname || '/'),
        navigationType,
        cacheState,
        visualBudget: input.visualBudget === 'constrained'
            ? 'constrained'
            : (globalThis.document?.documentElement?.dataset?.visualBudget === 'constrained' ? 'constrained' : 'normal'),
        browserClass,
        release: String(input.release || import.meta.env.VITE_SENTRY_RELEASE || import.meta.env.VITE_APP_RELEASE || 'unknown').slice(0, 80),
    };
}

export function reportPerformanceEvent(input) {
    const event = createPerformanceEvent(input);
    void import('../analytics/posthogBootstrap.js')
        .then(({ capturePosthogPerformance }) => capturePosthogPerformance(event))
        .catch(() => {});
    void import('../sentry.js')
        .then(({ recordPerformanceTrace }) => recordPerformanceTrace(event))
        .catch(() => {});
    return event;
}

function ratingForDuration(value, good, poor) {
    if (value <= good) return 'good';
    if (value > poor) return 'poor';
    return 'needs-improvement';
}

function routeReadyHandler(event) {
    const value = Number(event?.detail?.value);
    reportPerformanceEvent({
        name: 'route-ready',
        value,
        unit: 'ms',
        rating: ratingForDuration(value, 1000, 2500),
        pathname: event?.detail?.pathname,
        cacheState: event?.detail?.cacheState,
    });
}

function visualBudgetTransitionHandler(event) {
    const constrained = event?.detail?.to === 'constrained';
    reportPerformanceEvent({
        name: 'visual-budget-transition',
        value: Number(event?.detail?.fps),
        unit: 'fps',
        rating: constrained ? 'needs-improvement' : 'good',
        visualBudget: constrained ? 'constrained' : 'normal',
    });
}

export function markRouteReady({ pathname = globalThis.location?.pathname, cacheState = 'none' } = {}) {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return;
    const dispatch = () => window.dispatchEvent(new CustomEvent('riven:route-ready', {
        detail: {
            value: performance.now(),
            pathname,
            cacheState,
        },
    }));
    window.requestAnimationFrame?.(() => window.requestAnimationFrame?.(dispatch) || dispatch()) || dispatch();
}

export function startProductionPerformanceReporter() {
    if (typeof window === 'undefined' || typeof performance === 'undefined') return () => {};
    const cleanups = [];
    const sampleRate = Number(import.meta.env.VITE_PERFORMANCE_SAMPLE_RATE ?? 0.25);
    const fpsSampleRate = Number(import.meta.env.VITE_FPS_SAMPLE_RATE ?? 0.05);

    window.addEventListener('riven:route-ready', routeReadyHandler);
    cleanups.push(() => window.removeEventListener('riven:route-ready', routeReadyHandler));
    window.addEventListener('riven:visual-budget-transition', visualBudgetTransitionHandler);
    cleanups.push(() => window.removeEventListener('riven:visual-budget-transition', visualBudgetTransitionHandler));

    if (shouldSamplePerformance(sampleRate)) {
        void import('web-vitals').then(({ onCLS, onINP, onLCP, onTTFB }) => {
            const reportVital = (metric) => reportPerformanceEvent({
                name: metric.name,
                value: metric.value,
                unit: metric.name === 'CLS' ? 'score' : 'ms',
                rating: metric.rating,
            });
            onCLS(reportVital);
            onINP(reportVital);
            onLCP(reportVital);
            onTTFB(reportVital);
        }).catch(() => {});

        if (typeof PerformanceObserver !== 'undefined') {
            try {
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        reportPerformanceEvent({
                            name: 'long-task',
                            value: entry.duration,
                            unit: 'ms',
                            rating: ratingForDuration(entry.duration, 50, 200),
                        });
                    }
                });
                observer.observe({ type: 'longtask', buffered: true });
                cleanups.push(() => observer.disconnect());
            } catch {
                // Long Task API is Chromium-only.
            }
        }
    }

    const handleFps = (event) => {
        if (!shouldSamplePerformance(fpsSampleRate)) return;
        const fps = Number(event?.detail?.fps);
        reportPerformanceEvent({
            name: 'fps',
            value: fps,
            unit: 'fps',
            rating: fps >= 55 ? 'good' : fps < 45 ? 'poor' : 'needs-improvement',
            pathname: event?.detail?.route,
        });
    };
    window.addEventListener('riven:fps-sample', handleFps);
    cleanups.push(() => window.removeEventListener('riven:fps-sample', handleFps));

    return () => cleanups.forEach((cleanup) => cleanup());
}
