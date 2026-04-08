import { useCallback, useEffect, useRef, useState } from 'react';

const SW_URL = '/sw.js';
const SW_SCOPE = '/';
const SKIP_WAITING_MESSAGE = { type: 'SKIP_WAITING' };

function trackInstallingWorker({
  worker,
  hadController,
  registration,
  isDisposedRef,
  markNeedRefresh,
  markOfflineReady,
}) {
  if (!worker) return () => {};

  const handleStateChange = () => {
    if (isDisposedRef.current || worker.state !== 'installed') {
      return;
    }

    if (hadController) {
      markNeedRefresh(registration.waiting ?? worker);
    } else {
      markOfflineReady();
    }
  };

  worker.addEventListener('statechange', handleStateChange);
  return () => worker.removeEventListener('statechange', handleStateChange);
}

export function useRegisterSW(options = {}) {
  const {
    onNeedRefresh,
    onOfflineReady,
    onRegistered,
    onRegisteredSW,
    onRegisterError,
  } = options;
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const registrationRef = useRef(null);
  const trackedInstallingWorkerCleanupRef = useRef(() => {});
  const waitingWorkerRef = useRef(null);
  const notifiedWaitingWorkerRef = useRef(null);
  const isDisposedRef = useRef(false);

  const markNeedRefresh = useCallback((worker) => {
    if (!worker) return;

    waitingWorkerRef.current = worker;

    if (notifiedWaitingWorkerRef.current === worker) {
      return;
    }

    notifiedWaitingWorkerRef.current = worker;
    setNeedRefresh(true);
    onNeedRefresh?.();
  }, [onNeedRefresh]);

  const markOfflineReady = useCallback(() => {
    setOfflineReady(true);
    onOfflineReady?.();
  }, [onOfflineReady]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return undefined;
    }

    const serviceWorkerContainer = navigator.serviceWorker;
    const hadController = Boolean(serviceWorkerContainer.controller);
    isDisposedRef.current = false;

    let removeUpdateFoundListener = () => {};
    let removeControllerChangeListener = () => {};

    const cleanupTrackedWorker = () => {
      trackedInstallingWorkerCleanupRef.current?.();
      trackedInstallingWorkerCleanupRef.current = () => {};
    };

    const clearWaitingWorkerState = () => {
      waitingWorkerRef.current = null;
      notifiedWaitingWorkerRef.current = null;
    };

    const syncRegistrationState = (registration) => {
      if (!registration || isDisposedRef.current) return;

      if (registration.waiting && hadController) {
        markNeedRefresh(registration.waiting);
      } else if (!hadController && registration.active) {
        markOfflineReady();
      }
    };

    const registerServiceWorker = async () => {
      try {
        const registration = await serviceWorkerContainer.register(SW_URL, { scope: SW_SCOPE });
        if (isDisposedRef.current) return;

        registrationRef.current = registration;
        if (onRegisteredSW) {
          onRegisteredSW(SW_URL, registration);
        } else {
          onRegistered?.(registration);
        }
        syncRegistrationState(registration);

        const handleUpdateFound = () => {
          cleanupTrackedWorker();
          trackedInstallingWorkerCleanupRef.current = trackInstallingWorker(
            {
              worker: registration.installing,
              hadController,
              registration,
              isDisposedRef,
              markNeedRefresh,
              markOfflineReady,
            }
          );
        };

        const handleControllerChange = () => {
          if (isDisposedRef.current) return;

          clearWaitingWorkerState();
          setNeedRefresh(false);
        };

        registration.addEventListener('updatefound', handleUpdateFound);
        serviceWorkerContainer.addEventListener('controllerchange', handleControllerChange);

        removeUpdateFoundListener = () => registration.removeEventListener('updatefound', handleUpdateFound);
        removeControllerChangeListener = () => serviceWorkerContainer.removeEventListener('controllerchange', handleControllerChange);

        if (registration.installing) {
          handleUpdateFound();
        }
      } catch (error) {
        if (!isDisposedRef.current) {
          onRegisterError?.(error);
        }
      }
    };

    void registerServiceWorker();

    return () => {
      isDisposedRef.current = true;
      registrationRef.current = null;
      cleanupTrackedWorker();
      removeUpdateFoundListener();
      removeControllerChangeListener();
    };
  }, [markNeedRefresh, markOfflineReady, onRegisterError, onRegistered, onRegisteredSW]);

  const updateServiceWorker = useCallback(async () => {
    const waitingWorker = registrationRef.current?.waiting ?? waitingWorkerRef.current;

    if (!waitingWorker || typeof waitingWorker.postMessage !== 'function') {
      return false;
    }

    waitingWorker.postMessage(SKIP_WAITING_MESSAGE);
    return true;
  }, []);

  return {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  };
}
