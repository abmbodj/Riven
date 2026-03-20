import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PostHogProvider } from '@posthog/react'
import './index.css'
import App from './App.jsx'
import { initPosthog } from './analytics/posthogBootstrap.js'
import { initClientSentry } from './sentry.js'

import { ToastProvider } from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initDevFpsMeter } from './utils/devFpsMeter.js'
import { loadAdsForWeb } from './utils/loadAdsForWeb.js'

const posthogClient = initPosthog()

initClientSentry()
loadAdsForWeb()

const disposeFps = initDevFpsMeter()
if (import.meta.hot) {
    import.meta.hot.dispose(() => disposeFps?.())
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <PostHogProvider client={posthogClient}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </PostHogProvider>
    </ErrorBoundary>
  </StrictMode>,
)
