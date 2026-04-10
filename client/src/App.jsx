import { Suspense } from 'react';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter, HashRouter, useRoutes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProviders } from './AppProviders.jsx';
import { RootLayout } from './components/layout/RootLayout.jsx';
import PushNotificationBridge from './components/PushNotificationBridge.jsx';
import WebAppUpdateManager from './components/WebAppUpdateManager.jsx';
import { routesConfig } from './routes/config.jsx';
import { PageLoader } from './components/ui/PageLoader.jsx';
import { PosthogPageviewTracker } from './analytics/PosthogPageviewTracker.jsx';

const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

function App() {
  return (
    <AppProviders>
      <WebAppUpdateManager>
        <AppRouter>
<PushNotificationBridge />
          <PosthogPageviewTracker />
          <RootLayout>
            <ErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </ErrorBoundary>
          </RootLayout>
        </AppRouter>
      </WebAppUpdateManager>
    </AppProviders>
  );
}

function AppRoutes() {
  const element = useRoutes(routesConfig);
  return element;
}


export default App;
