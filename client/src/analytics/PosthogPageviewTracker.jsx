import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { capturePosthogPageview } from './posthogBootstrap.js'

/**
 * SPA / HashRouter: emit $pageview on route changes (capture_pageview is disabled in init).
 */
export function PosthogPageviewTracker() {
    const location = useLocation()

    useEffect(() => {
        if (!import.meta.env.VITE_PUBLIC_POSTHOG_KEY) return
        capturePosthogPageview()
    }, [location.pathname, location.search, location.hash])

    return null
}
