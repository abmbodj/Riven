import { useCallback, useEffect, useRef, useState } from 'react';

const SW_URL = '/sw.js';
const SW_SCOPE = '/';

function trackInstallingWorker(worker, hadController, setNeedRefresh, setOfflineReady) {
  if (!worker) return () => {};

  const handleStateChange = () => {
    if (worker.state === 'installed') {
      if (hadController) {
        setNeedRefresh(true);
      } else {
        setOfflineReady(true);
      }
    }
  };

  worker.addEventListener('statechange', handleStateChange);
  return () => worker.removeEventListener('statechange', handleStateChange);
}

export function useRegisterSW(options = {}) {
  const {
    onNeedRefresh,
    onRegisteredSW,
    onRegisterError,
  } = options;
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const registrationRef = useRef(null);
  const trackedInstallingWorkerCleanupRef = useRef(() => {});
  const markUpdateReady = useCallback(() => {
    setNeedRefresh(true);
    onNeedRefresh?.();
  }, [onNeedRefresh]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    let isDisposed = false;
    const hadController = Boolean(navigator.serviceWorker.controller);
    let removeUpdateFoundListener = () => {};
    let removeControllerChangeListener = () => {};

    const cleanupTrackedWorker = () => {
      trackedInstallingWorkerCleanupRef.current?.();
      trackedInstallingWorkerCleanupRef.current = () => {};
    };

    const syncRegistrationState = (registration) => {
      if (!registration || isDisposed) return;
      if (registration.waiting && hadController) {
        markUpdateReady();
      } else if (!hadController && registration.active) {
        setOfflineReady(true);
      }
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
        if (isDisposed) return;

        registrationRef.current = registration;
        onRegisteredSW?.(SW_URL, registration);
        syncRegistrationState(registration);

        const handleUpdateFound = () => {
          cleanupTrackedWorker();
          trackedInstallingWorkerCleanupRef.current = trackInstallingWorker(
            registration.installing,
            hadController,
            markUpdateReady,
            setOfflineReady
          );
        };

        const handleControllerChange = () => {
          if (hadController) {
            markUpdateReady();
          }
        };

        registration.addEventListener('updatefound', handleUpdateFound);
        navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

        removeUpdateFoundListener = () => registration.removeEventListener('updatefound', handleUpdateFound);
        removeControllerChangeListener = () => navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);

        if (registration.installing) {
          handleUpdateFound();
        }
      } catch (error) {
        if (!isDisposed) {
          onRegisterError?.(error);
        }
      }
    };

    void registerServiceWorker();

    return () => {
      isDisposed = true;
      cleanupTrackedWorker();
      removeUpdateFoundListener();
      removeControllerChangeListener();
    };
  }, [markUpdateReady, onRegisterError, onRegisteredSW]);

  const updateServiceWorker = useCallback(async () => {
    if (registrationRef.current && typeof registrationRef.current.update === 'function') {
      await registrationRef.current.update();
    }
  }, []);

  return {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  };
}
