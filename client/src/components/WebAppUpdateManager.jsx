import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { AppUpdateContext } from '../context/AppUpdateContext.jsx';
import { useRegisterSW } from '../lib/pwaRegister.js';
import { attemptDeployUpdateRecovery } from '../utils/deployUpdateRecovery.js';

const UPDATE_CHECK_INTERVAL_MS = 60_000;
const RELOAD_FALLBACK_DELAY_MS = 1_500;

function scheduleReloadForActivatedWorker() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined' || !navigator.serviceWorker) {
    return null;
  }

  const serviceWorkerContainer = navigator.serviceWorker;
  let didReload = false;
  let fallbackTimerId = null;

  const cleanup = () => {
    serviceWorkerContainer.removeEventListener('controllerchange', handleControllerChange);
    if (fallbackTimerId !== null) {
      window.clearTimeout(fallbackTimerId);
      fallbackTimerId = null;
    }
  };

  const reload = () => {
    if (didReload) return;
    didReload = true;
    cleanup();
    window.location.reload();
  };

  const handleControllerChange = () => reload();

  serviceWorkerContainer.addEventListener('controllerchange', handleControllerChange);
  fallbackTimerId = window.setTimeout(reload, RELOAD_FALLBACK_DELAY_MS);

  return {
    cancel: cleanup,
    reload,
  };
}

export default function WebAppUpdateManager({ children }) {
  const isWebRuntime = typeof window !== 'undefined' && !Capacitor.isNativePlatform();
  const registrationRef = useRef(null);
  const [registrationEnabled, setRegistrationEnabled] = useState(false);
  const [dismissedUpdate, setDismissedUpdate] = useState(false);
  const [isRefreshingUpdate, setIsRefreshingUpdate] = useState(false);

  const checkForUpdate = useCallback(async () => {
    if (!isWebRuntime || typeof navigator !== 'undefined' && navigator.onLine === false) {
      return;
    }

    const registration = registrationRef.current;
    if (!registration || typeof registration.update !== 'function') {
      return;
    }

    try {
      await registration.update();
    } catch (error) {
      console.warn('[WebAppUpdateManager] Failed to check for a newer deployment', error);
    }
  }, [isWebRuntime]);

  const handleRegisteredSW = useCallback((_, registration) => {
    registrationRef.current = registration ?? null;
    if (registration && typeof registration.update === 'function') {
      void registration.update().catch((error) => {
        console.warn('[WebAppUpdateManager] Initial deployment update check failed', error);
      });
    }
  }, []);

  const handleNeedRefresh = useCallback(() => {
    setDismissedUpdate(false);
    setIsRefreshingUpdate(false);
  }, []);

  const { needRefresh: [needRefresh] = [false], updateServiceWorker } = useRegisterSW({
    enabled: registrationEnabled,
    onNeedRefresh: handleNeedRefresh,
    onRegisteredSW: handleRegisteredSW,
    onRegisterError(error) {
      console.warn('[WebAppUpdateManager] Service worker registration failed', error);
    },
  });

  useEffect(() => {
    if (!isWebRuntime) return undefined;
    const enable = () => {
      const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 1));
      schedule(() => setRegistrationEnabled(true), { timeout: 2500 });
    };
    window.addEventListener('riven:route-ready', enable, { once: true });
    const fallback = window.setTimeout(enable, 5000);
    return () => {
      window.removeEventListener('riven:route-ready', enable);
      window.clearTimeout(fallback);
    };
  }, [isWebRuntime]);

  useEffect(() => {
    if (!needRefresh) {
      setIsRefreshingUpdate(false);
    }
  }, [needRefresh]);

  useEffect(() => {
    if (!isWebRuntime || !registrationEnabled) return undefined;

    void checkForUpdate();

    const handleFocus = () => {
      void checkForUpdate();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkForUpdate();
      }
    }, UPDATE_CHECK_INTERVAL_MS);

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [checkForUpdate, isWebRuntime, registrationEnabled]);

  useEffect(() => {
    if (!isWebRuntime) return undefined;

    const handleWindowError = (event) => {
      attemptDeployUpdateRecovery(event?.error ?? event?.message ?? event);
    };

    const handleUnhandledRejection = (event) => {
      const recovered = attemptDeployUpdateRecovery(event?.reason ?? event);
      if (recovered) {
        event.preventDefault?.();
      }
    };

    window.addEventListener('error', handleWindowError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isWebRuntime]);

  const dismissUpdate = useCallback(() => {
    setDismissedUpdate(true);
  }, []);

  const refreshToLatestVersion = useCallback(async () => {
    if (!isWebRuntime || isRefreshingUpdate) {
      return false;
    }

    setIsRefreshingUpdate(true);

    const reloadGuard = scheduleReloadForActivatedWorker();

    try {
      const activatedWaitingWorker = await updateServiceWorker?.();

      if (!activatedWaitingWorker) {
        throw new Error('No waiting service worker was available to activate.');
      }

      if (!reloadGuard) {
        setIsRefreshingUpdate(false);
      }
      return true;
    } catch (error) {
      console.warn('[WebAppUpdateManager] Failed to activate the waiting service worker', error);
      if (reloadGuard) {
        reloadGuard.reload();
      } else {
        setIsRefreshingUpdate(false);
      }
      return false;
    }
  }, [isRefreshingUpdate, isWebRuntime, updateServiceWorker]);

  const value = useMemo(() => ({
    isUpdateAvailable: Boolean(isWebRuntime && needRefresh && !dismissedUpdate),
    isRefreshingUpdate,
    dismissUpdate,
    refreshToLatestVersion,
  }), [dismissUpdate, dismissedUpdate, isRefreshingUpdate, isWebRuntime, needRefresh, refreshToLatestVersion]);

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
}
