import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NativeDeepLinkBridge from './NativeDeepLinkBridge.jsx';

const {
  appUrlOpenListeners,
  authState,
  capacitorState,
  consumePendingPushRouteMock,
  launchUrlState,
  resetListeners,
} = vi.hoisted(() => {
  const listeners = [];

  return {
    appUrlOpenListeners: listeners,
    authState: {
      isLoggedIn: true,
      loading: false,
    },
    capacitorState: {
      native: true,
    },
    consumePendingPushRouteMock: vi.fn(() => null),
    launchUrlState: {
      url: undefined,
    },
    resetListeners: () => {
      listeners.splice(0, listeners.length);
    },
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorState.native,
  },
}));

vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn(async (eventName, callback) => {
      if (eventName === 'appUrlOpen') {
        appUrlOpenListeners.push(callback);
      }

      return {
        remove: vi.fn(() => {
          const index = appUrlOpenListeners.indexOf(callback);
          if (index >= 0) {
            appUrlOpenListeners.splice(index, 1);
          }
        }),
      };
    }),
    getLaunchUrl: vi.fn(async () => (launchUrlState.url ? { url: launchUrlState.url } : undefined)),
  },
}));

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => authState,
}));

vi.mock('../utils/pushNotifications.js', () => ({
  consumePendingPushRoute: consumePendingPushRouteMock,
}));

function NoteRoute() {
  const { id } = useParams();
  return <div data-testid="note-editor-route">{id}</div>;
}

function MessagesRoute() {
  const { userId } = useParams();
  return <div data-testid="messages-route">{userId}</div>;
}

function renderHarness(initialEntries = ['/']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <NativeDeepLinkBridge />
      <Routes>
        <Route path="/" element={<div data-testid="home-route">home</div>} />
        <Route path="/note/:id" element={<NoteRoute />} />
        <Route path="/messages/:userId" element={<MessagesRoute />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('NativeDeepLinkBridge', () => {
  beforeEach(() => {
    capacitorState.native = true;
    authState.isLoggedIn = true;
    authState.loading = false;
    consumePendingPushRouteMock.mockReset();
    consumePendingPushRouteMock.mockReturnValue(null);
    launchUrlState.url = undefined;
    resetListeners();
  });

  afterEach(() => {
    launchUrlState.url = undefined;
    resetListeners();
  });

  it('opens the note editor route when a native riven note URL is received', async () => {
    renderHarness();

    await waitFor(() => {
      expect(appUrlOpenListeners).toHaveLength(1);
    });

    await act(async () => {
      appUrlOpenListeners[0]({ url: 'riven://note/note-42' });
      await Promise.resolve();
    });

    expect(await screen.findByTestId('note-editor-route')).toHaveTextContent('note-42');
  });

  it('opens the note editor route from the native launch URL', async () => {
    launchUrlState.url = 'riven://note/note-99';

    renderHarness();

    await waitFor(() => {
      expect(screen.getByTestId('note-editor-route')).toHaveTextContent('note-99');
    });
  });

  it('consumes a pending push route after auth finishes bootstrapping', async () => {
    authState.loading = false;
    authState.isLoggedIn = true;
    consumePendingPushRouteMock.mockReturnValue('/messages/12');

    renderHarness();

    await waitFor(() => {
      expect(screen.getByTestId('messages-route')).toHaveTextContent('12');
    });
  });
});
