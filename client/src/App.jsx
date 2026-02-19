import { Suspense } from 'react';
import { BrowserRouter, useRoutes } from 'react-router-dom';
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
            <AppRoutes />
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
