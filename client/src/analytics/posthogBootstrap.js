const KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'
let posthogPromise = null
let initialized = false

function onOnboardingEvent(event) {
    const d = event?.detail
    if (!d || typeof d.name !== 'string') return
    const payload =
        typeof d.payload === 'object' && d.payload !== null ? d.payload : {}
    void getPosthog().then((posthog) => posthog?.capture('riven_onboarding', {
        ...payload,
        step: d.name,
        ts: d.ts,
    }))
}

async function getPosthog() {
    if (!KEY) return null

    if (!posthogPromise) {
        posthogPromise = import('posthog-js').then((module) => module.default)
    }

    const posthog = await posthogPromise
    if (!initialized) {
        posthog.init(KEY, {
            api_host: HOST,
            person_profiles: 'identified_only',
            capture_pageview: false,
            capture_pageleave: true,
        })
        initialized = true
    }

    return posthog
}

/**
 * Initialize PostHog when VITE_PUBLIC_POSTHOG_KEY is set.
 * Registers a listener for `riven:onboarding` custom events (see onboardingAnalytics.js).
 */
export function initPosthog() {
    if (!KEY) return Promise.resolve(null)

    const promise = getPosthog()

    if (typeof window !== 'undefined') {
        window.addEventListener('riven:onboarding', onOnboardingEvent)
    }

    return promise
}

export function capturePosthogPageview() {
    if (!KEY || typeof window === 'undefined') return

    void getPosthog().then((posthog) => posthog?.capture('$pageview', {
        $current_url: window.location.href,
    }))
}
