/**
 * Browser / Capacitor WebView SDK. Skips init in dev or when DSN is unset.
 */
let sentryPromise = null;
let sentryInitialized = false;

function loadSentry() {
    if (!sentryPromise) {
        sentryPromise = import('@sentry/react');
    }
    return sentryPromise;
}

export async function initClientSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!import.meta.env.PROD || !dsn) return;
    if (sentryInitialized) return;

    const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.02);
    const Sentry = await loadSentry();

    Sentry.init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        release: import.meta.env.VITE_SENTRY_RELEASE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.02,
    });
    sentryInitialized = true;
}

export function captureException(error, context) {
    if (!import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return;

    void initClientSentry()
        .then(() => loadSentry())
        .then((Sentry) => {
            Sentry.captureException(error, context);
        });
}

export function recordPerformanceTrace(event) {
    if (!event || !import.meta.env.PROD || !import.meta.env.VITE_SENTRY_DSN) return;

    void initClientSentry()
        .then(() => loadSentry())
        .then((Sentry) => {
            Sentry.startSpan({
                name: `performance.${event.name}`,
                op: 'ui.performance',
                attributes: {
                    'riven.route_template': event.routeTemplate,
                    'riven.cache_state': event.cacheState,
                    'riven.release': event.release,
                    'riven.visual_budget': event.visualBudget,
                    'riven.browser_class': event.browserClass,
                    'riven.rating': event.rating,
                    'riven.value': event.value,
                    'riven.unit': event.unit,
                },
            }, () => {});
        })
        .catch(() => {});
}
