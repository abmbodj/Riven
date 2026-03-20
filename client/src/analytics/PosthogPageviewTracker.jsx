import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePostHog } from '@posthog/react'

/**
 * SPA / HashRouter: emit $pageview on route changes (capture_pageview is disabled in init).
 */
export function PosthogPageviewTracker() {
    const location = useLocation()
    const posthog = usePostHog()

    useEffect(() => {
        if (!import.meta.env.VITE_PUBLIC_POSTHOG_KEY) return
        posthog.capture('$pageview', {
            $current_url: window.location.href,
        })
    }, [location.pathname, location.search, location.hash, posthog])

    return null
}
