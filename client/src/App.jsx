import { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import MobileWarning from './components/MobileWarning';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProviders } from './AppProviders.jsx';
import { RootLayout } from './components/layout/RootLayout.jsx';
import { routesConfig } from './routes/config.jsx';
import { PageLoader } from './components/ui/PageLoader.jsx';

function App() {
  return (
    <AppProviders>
      <BrowserRouter>
        <MobileWarning />
        <RootLayout>
          <ErrorBoundary>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                {routesConfig.map((route) => (
                  <Route key={route.path} path={route.path} element={route.element} />
                ))}
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </RootLayout>
      </BrowserRouter>
    </AppProviders>
  );
}

export default App;
