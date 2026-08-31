import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRegisterSW } from './pwaRegister.js';

function createEventTarget() {
  const listeners = new Map();

  return {
    addEventListener(type, listener) {
      const next = listeners.get(type) ?? new Set();
      next.add(listener);
      listeners.set(type, next);
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener);
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.forEach((listener) => listener(event));
    },
  };
}

function createInstallingWorker() {
  const target = createEventTarget();
  return {
    state: 'installing',
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    dispatch(type, event) {
      target.dispatch(type, event);
    },
  };
}

function createWaitingWorker() {
  return {
    postMessage: vi.fn(),
  };
}

function createRegistration({ waiting = null, installing = null } = {}) {
  const target = createEventTarget();
  return {
    waiting,
    installing,
    active: {},
    update: vi.fn().mockResolvedValue(undefined),
    addEventListener: target.addEventListener,
    removeEventListener: target.removeEventListener,
    dispatch(type, event) {
      target.dispatch(type, event);
    },
  };
}

describe('useRegisterSW', () => {
  const originalServiceWorker = navigator.serviceWorker;
  const registerMock = vi.fn();
  let swContainer;

  beforeEach(() => {
    registerMock.mockReset();
    swContainer = {
      controller: { scriptURL: '/sw.js' },
      register: registerMock,
      ...createEventTarget(),
    };

    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: swContainer,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: originalServiceWorker,
    });
  });

  it('does not register until startup work marks it enabled', async () => {
    const registration = createRegistration();
    registerMock.mockResolvedValue(registration);
    const { rerender } = renderHook(
      ({ enabled }) => useRegisterSW({ enabled }),
      { initialProps: { enabled: false } },
    );

    await act(async () => Promise.resolve());
    expect(registerMock).not.toHaveBeenCalled();

    rerender({ enabled: true });
    await waitFor(() => expect(registerMock).toHaveBeenCalledTimes(1));
  });

  it('marks a waiting worker as needing refresh', async () => {
    const registration = createRegistration({ waiting: createWaitingWorker() });
    registerMock.mockResolvedValue(registration);

    const { result } = renderHook(() => useRegisterSW());

    await waitFor(() => {
      expect(result.current.needRefresh[0]).toBe(true);
    });
  });

  it('sends SKIP_WAITING to the waiting worker when updateServiceWorker is called', async () => {
    const waiting = createWaitingWorker();
    const registration = createRegistration({ waiting });
    registerMock.mockResolvedValue(registration);

    const { result } = renderHook(() => useRegisterSW());

    await waitFor(() => {
      expect(result.current.needRefresh[0]).toBe(true);
    });

    await act(async () => {
      await result.current.updateServiceWorker();
    });

    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('does not re-open needRefresh on controllerchange after the prompt was cleared', async () => {
    const waiting = createWaitingWorker();
    const registration = createRegistration({ waiting });
    registerMock.mockResolvedValue(registration);

    const { result } = renderHook(() => useRegisterSW());

    await waitFor(() => {
      expect(result.current.needRefresh[0]).toBe(true);
    });

    act(() => {
      result.current.needRefresh[1](false);
      swContainer.dispatch('controllerchange', { type: 'controllerchange' });
    });

    expect(result.current.needRefresh[0]).toBe(false);
  });

  it('marks needRefresh when an installing worker finishes and becomes waiting', async () => {
    const installing = createInstallingWorker();
    const registration = createRegistration({ installing, waiting: null });
    registerMock.mockResolvedValue(registration);

    const { result } = renderHook(() => useRegisterSW());

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      registration.dispatch('updatefound', { type: 'updatefound' });
      registration.waiting = createWaitingWorker();
      installing.state = 'installed';
      installing.dispatch('statechange', { type: 'statechange' });
    });

    expect(result.current.needRefresh[0]).toBe(true);
  });
});
