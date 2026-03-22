import * as Sentry from 'npm:@sentry/deno@10.45.0';

let initialized = false;

function ensureSentryInit(): void {
    if (initialized) return;
    const dsn = Deno.env.get('SENTRY_DSN');
    if (!dsn) return;

    const tracesSampleRate = parseFloat(Deno.env.get('SENTRY_TRACES_SAMPLE_RATE') || '0.1');
    Sentry.init({
        dsn,
        environment: Deno.env.get('SENTRY_ENVIRONMENT') ?? 'production',
        release: Deno.env.get('SENTRY_RELEASE'),
        defaultIntegrations: false,
        tracesSampleRate: Number.isFinite(tracesSampleRate) ? tracesSampleRate : 0.1,
    });
    initialized = true;
}

/**
 * Report an error from a Supabase Edge Function to Sentry.
 * Uses withScope so request metadata is not leaked across warm invocations (see Supabase + Sentry docs).
 * No-op when SENTRY_DSN is unset.
 */
export async function reportEdgeException(
    error: unknown,
    context?: {
        request?: Request;
        functionName?: string;
        tags?: Record<string, string | number | boolean | null | undefined>;
        extras?: Record<string, unknown>;
    },
): Promise<void> {
    if (!Deno.env.get('SENTRY_DSN')) return;

    ensureSentryInit();
    if (!initialized) return;

    const err = error instanceof Error
        ? error
        : new Error(typeof error === 'string' ? error : JSON.stringify(error));

    Sentry.withScope((scope) => {
        scope.setTag('runtime', 'supabase-edge');
        if (context?.functionName) scope.setTag('function', context.functionName);

        const region = Deno.env.get('SB_REGION');
        if (region) scope.setTag('region', region);

        const executionId = Deno.env.get('SB_EXECUTION_ID');
        if (executionId) scope.setTag('execution_id', executionId);

        if (context?.request) {
            const req = context.request;
            try {
                const url = new URL(req.url);
                scope.setContext('request', {
                    method: req.method,
                    pathname: url.pathname,
                });
            } catch {
                scope.setContext('request', { method: req.method });
            }
        }

        Object.entries(context?.tags || {}).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                scope.setTag(key, String(value));
            }
        });

        if (context?.extras && Object.keys(context.extras).length > 0) {
            scope.setContext('extra', context.extras);
        }

        Sentry.captureException(err);
    });

    await Sentry.flush(2000);
}
