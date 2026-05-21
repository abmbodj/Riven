import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </StrictMode>,
)
