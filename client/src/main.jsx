import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { ToastProvider } from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initDevFpsMeter } from './utils/devFpsMeter.js'
import { loadAdsForWeb } from './utils/loadAdsForWeb.js'

loadAdsForWeb()

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
