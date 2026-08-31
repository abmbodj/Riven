import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { initPosthog } from './analytics/posthogBootstrap.js'
import { initClientSentry } from './sentry.js'

import { ToastProvider } from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initDevFpsMeter } from './utils/devFpsMeter.js'
import { startProductionPerformanceReporter } from './performance/performanceReporter.js'
import { applyCachedThemeColors } from './performance/themeBootstrap.js'

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

applyCachedThemeColors()

const syncDocumentVisibility = () => {
  document.documentElement.dataset.documentHidden = document.hidden ? 'true' : 'false'
}
syncDocumentVisibility()
document.addEventListener('visibilitychange', syncDocumentVisibility)

let telemetryStarted = false
const startDeferredTelemetry = () => {
  if (telemetryStarted) return
  telemetryStarted = true
  afterFirstPaint(() => {
    void initPosthog()
    void initClientSentry()
  })
}

const disposePerformanceReporter = startProductionPerformanceReporter()
if (typeof window !== 'undefined') {
  window.addEventListener('riven:route-ready', startDeferredTelemetry, { once: true })
  window.setTimeout(startDeferredTelemetry, 5000)
}

const disposeFps = initDevFpsMeter()
if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      disposeFps?.()
      disposePerformanceReporter?.()
      document.removeEventListener('visibilitychange', syncDocumentVisibility)
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
