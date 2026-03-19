import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

import { ToastProvider } from './components/Toast.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { initDevFpsMeter } from './utils/devFpsMeter.js'

// #region agent log
{
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null
    fetch('http://127.0.0.1:7311/ingest/53f62ef3-2a00-4279-bbe9-6c0ad7e975d5', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '41ce24' },
        body: JSON.stringify({
            sessionId: '41ce24',
            runId: 'pre-fix',
            hypothesisId: 'H2_H3',
            location: 'main.jsx:bootstrap',
            message: 'client_bootstrap',
            data: {
                mode: import.meta.env.MODE,
                baseUrl: import.meta.env.BASE_URL,
                hasSupabaseUrl: !!import.meta.env.VITE_SUPABASE_URL,
                hasSupabaseAnon: !!import.meta.env.VITE_SUPABASE_ANON_KEY,
                swControlled: !!sw?.controller,
                swScript: sw?.controller?.scriptURL
                    ? String(sw.controller.scriptURL).split('/').slice(-1)[0]
                    : null,
            },
            timestamp: Date.now(),
        }),
    }).catch(() => {})
}
// #endregion

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
