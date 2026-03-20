import posthog from 'posthog-js'

const KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY
const HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com'

function onOnboardingEvent(event) {
    const d = event?.detail
    if (!d || typeof d.name !== 'string') return
    const payload =
        typeof d.payload === 'object' && d.payload !== null ? d.payload : {}
    posthog.capture('riven_onboarding', {
        ...payload,
        step: d.name,
        ts: d.ts,
    })
}

/**
 * Initialize PostHog when VITE_PUBLIC_POSTHOG_KEY is set.
 * Registers a listener for `riven:onboarding` custom events (see onboardingAnalytics.js).
 */
export function initPosthog() {
    if (!KEY) return posthog

    posthog.init(KEY, {
        api_host: HOST,
        person_profiles: 'identified_only',
        capture_pageview: false,
        capture_pageleave: true,
    })

    if (typeof window !== 'undefined') {
        window.addEventListener('riven:onboarding', onOnboardingEvent)
    }

    return posthog
}
