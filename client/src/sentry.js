import * as Sentry from '@sentry/react';

/**
 * Browser / Capacitor WebView SDK. Skips init in dev or when DSN is unset.
 */
export function initClientSentry() {
    const dsn = import.meta.env.VITE_SENTRY_DSN;
    if (!import.meta.env.PROD || !dsn) return;

    const tracesSampleRate = Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE ?? 0.02);

    Sentry.init({
        dsn,
        environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || import.meta.env.MODE,
        release: import.meta.env.VITE_SENTRY_RELEASE,
        integrations: [Sentry.browserTracingIntegration()],
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.02,
    });
}

export { captureException } from '@sentry/react';
