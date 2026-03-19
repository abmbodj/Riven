import { Suspense, useLayoutEffect, useRef } from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProviders } from './AppProviders.jsx';
import { RootLayout } from './components/layout/RootLayout.jsx';
import { routesConfig } from './routes/config.jsx';
import { PageLoader } from './components/ui/PageLoader.jsx';

function App() {
  const bootLogged = useRef(false);
  useLayoutEffect(() => {
    if (bootLogged.current) return;
    bootLogged.current = true;
    // #region agent log
    fetch('http://127.0.0.1:7311/ingest/53f62ef3-2a00-4279-bbe9-6c0ad7e975d5', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '41ce24' },
      body: JSON.stringify({
        sessionId: '41ce24',
        runId: 'pre-fix',
        hypothesisId: 'H1',
        location: 'App.jsx:mount',
        message: 'app_component_mounted',
        data: { path: typeof window !== 'undefined' ? window.location.pathname : null },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <AppProviders>
      <BrowserRouter>
        <RootLayout>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <AppRoutes />
            </Suspense>
          </ErrorBoundary>
        </RootLayout>
      </BrowserRouter>
    </AppProviders>
  );
}

function AppRoutes() {
  const element = useRoutes(routesConfig);
  return element;
}


export default App;
