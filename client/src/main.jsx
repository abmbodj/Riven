import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import gsap from 'gsap'
import './index.css'
import App from './App.jsx'
import { initPosthog } from './analytics/posthogBootstrap.js'
import { initClientSentry } from './sentry.js'

import { ToastProvider } from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initDevFpsMeter } from './utils/devFpsMeter.js'
import { loadAdsForWeb } from './utils/loadAdsForWeb.js'

function afterFirstPaint(callback) {
  if (typeof window === 'undefined') {
    callback()
    return
  }

  const scheduleIdle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 1))
  window.requestAnimationFrame(() => {
    scheduleIdle(callback, { timeout: 2000 })
  })
}

loadAdsForWeb()
afterFirstPaint(() => {
  void initPosthog()
  void initClientSentry()
})

const disposeFps = initDevFpsMeter()
if (import.meta.hot) {
    import.meta.hot.dispose(() => disposeFps?.())
}

// Stop GSAP's ticker (and everything driven by it, incl. ScrollTrigger) while
// the tab is hidden — tweens resume from the same position on refocus.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) gsap.ticker.sleep()
    else gsap.ticker.wake() // idempotent even if never slept
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
