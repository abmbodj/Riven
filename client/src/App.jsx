import { lazy, Suspense, useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BrowserRouter, HashRouter, useLocation, useRoutes } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import { AppProviders } from './AppProviders.jsx';
import { RootLayout } from './components/layout/RootLayout.jsx';
import WebAppUpdateManager from './components/WebAppUpdateManager.jsx';
import { routesConfig } from './routes/config.jsx';
import { PageLoader } from './components/ui/PageLoader.jsx';
import { markRouteReady } from './performance/performanceReporter.js';

const AppRouter = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;
const PushNotificationBridge = lazy(() => import('./components/PushNotificationBridge.jsx'));
const GroupMeetupReminderBridge = lazy(() => import('./components/GroupMeetupReminderBridge.jsx'));
const PosthogPageviewTracker = lazy(() => (
  import('./analytics/PosthogPageviewTracker.jsx')
    .then((module) => ({ default: module.PosthogPageviewTracker }))
));
const NotificationSyncBridge = lazy(() => import('./components/NotificationSyncBridge.jsx'));

function DeferredServices() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const activate = () => {
      const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1));
      schedule(() => setReady(true), { timeout: 2000 });
    };
    window.addEventListener('riven:route-ready', activate, { once: true });
    const fallback = window.setTimeout(activate, 5000);
    return () => {
      window.removeEventListener('riven:route-ready', activate);
      window.clearTimeout(fallback);
    };
  }, []);

  if (!ready) return null;
  return (
    <Suspense fallback={null}>
      <PushNotificationBridge />
      <GroupMeetupReminderBridge />
      <PosthogPageviewTracker />
      <NotificationSyncBridge />
    </Suspense>
  );
}

function App() {
  return (
    <AppProviders>
      <WebAppUpdateManager>
        <AppRouter>
          <DeferredServices />
          <RootLayout>
            <RouteAwareErrorBoundary>
              <Suspense fallback={<PageLoader />}>
                <AppRoutes />
              </Suspense>
            </RouteAwareErrorBoundary>
          </RootLayout>
        </AppRouter>
      </WebAppUpdateManager>
    </AppProviders>
  );
}

function RouteAwareErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary key={pathname}>{children}</ErrorBoundary>;
}

function AppRoutes() {
  const location = useLocation();
  const element = useRoutes(routesConfig);

  useEffect(() => {
    if (location.pathname !== '/dashboard') {
      markRouteReady({ pathname: location.pathname });
    }
  }, [location.pathname]);

  return element;
}


export default App;
