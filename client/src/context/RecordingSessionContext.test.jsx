import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingSessionProvider } from './RecordingSessionContext.jsx';
import useRecordingSession from '../hooks/useRecordingSession.js';

const {
  appStateListeners,
  liveActivityMock,
  recorderStore,
  voiceRecorderMock,
  capacitorState,
  mediaDevicesMock,
  resetRecorderStore,
} = vi.hoisted(() => {
  const listeners = [];
  const store = [];

  return {
    appStateListeners: listeners,
    liveActivityMock: {
      start: vi.fn(async () => ({ activityId: 'live-activity-1' })),
      update: vi.fn(async () => ({})),
      stop: vi.fn(async () => ({})),
    },
    recorderStore: store,
    voiceRecorderMock: {
      hasAudioRecordingPermission: vi.fn(async () => ({ value: true })),
      requestAudioRecordingPermission: vi.fn(async () => ({ value: true })),
      startRecording: vi.fn(async () => ({ value: true })),
      stopRecording: vi.fn(async () => ({ value: { recordDataBase64: 'dGVzdA==', mimeType: 'audio/aac' } })),
      getCurrentStatus: vi.fn(async () => ({ status: 'NONE' })),
    },
    capacitorState: {
      native: false,
    },
    mediaDevicesMock: {
      getUserMedia: vi.fn(async () => ({
        getTracks: () => [{ stop: vi.fn() }],
      })),
    },
    resetRecorderStore: () => {
      store.splice(0, store.length);
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
    addListener: vi.fn(async (_eventName, callback) => {
      appStateListeners.push(callback);
      return {
        remove: vi.fn(() => {
          const index = appStateListeners.indexOf(callback);
          if (index >= 0) {
            appStateListeners.splice(index, 1);
          }
        }),
      };
    }),
  },
}));

vi.mock('capacitor-voice-recorder', () => ({
  VoiceRecorder: voiceRecorderMock,
}));

vi.mock('capacitor-live-activity', () => ({
  LiveActivity: liveActivityMock,
}));

vi.mock('idb', () => ({
  openDB: vi.fn(async () => ({
    objectStoreNames: {
      contains: () => true,
    },
    createObjectStore: vi.fn(),
    transaction: () => ({
      store: {
        getAll: vi.fn(async () => recorderStore.map((entry) => ({ ...entry }))),
        add: vi.fn(async (entry) => {
          recorderStore.push({ ...entry, id: recorderStore.length + 1 });
        }),
        delete: vi.fn(async (id) => {
          const index = recorderStore.findIndex((entry) => entry.id === id);
          if (index >= 0) {
            recorderStore.splice(index, 1);
          }
        }),
      },
      done: Promise.resolve(),
    }),
    getAll: vi.fn(async () => recorderStore.map((entry) => ({ ...entry }))),
  })),
}));

class MockMediaRecorder {
  static instances = [];

  static isTypeSupported = vi.fn(() => true);

  constructor() {
    this.state = 'inactive';
    this.ondataavailable = null;
    this.onerror = null;
    this.onstop = null;
    MockMediaRecorder.instances.push(this);
  }

  start = vi.fn(() => {
    this.state = 'recording';
  });

  stop = vi.fn(() => {
    this.state = 'inactive';
    this.onstop?.();
  });

  emitChunk(text = 'chunk-data') {
    this.ondataavailable?.({ data: new Blob([text], { type: 'audio/webm' }) });
  }
}

function NoteRouteHarness() {
  const navigate = useNavigate();
  const recorder = useRecordingSession({
    noteId: 'note-42',
    noteTitle: 'Biology Lecture',
  });

  return (
    <div>
      <div data-testid="note-state">{recorder.state}</div>
      <button type="button" onClick={() => recorder.start('note-42', 'Biology Lecture')}>
        Start recording
      </button>
      <button type="button" onClick={() => navigate('/classes')}>
        Go classes
      </button>
    </div>
  );
}

function GlobalRouteHarness() {
  const recorder = useRecordingSession();

  return (
    <div data-testid="global-session">
      {`${recorder.state}:${recorder.activeNoteId || 'none'}`}
    </div>
  );
}

function renderHarness(initialEntries = ['/note/note-42']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RecordingSessionProvider>
        <Routes>
          <Route path="/note/:id" element={<NoteRouteHarness />} />
          <Route path="/classes" element={<GlobalRouteHarness />} />
        </Routes>
      </RecordingSessionProvider>
    </MemoryRouter>
  );
}

describe('RecordingSessionProvider', () => {
  beforeEach(() => {
    capacitorState.native = false;
    resetRecorderStore();
    appStateListeners.splice(0, appStateListeners.length);
    localStorage.clear();
    MockMediaRecorder.instances = [];
    mediaDevicesMock.getUserMedia.mockClear();
    liveActivityMock.start.mockClear();
    liveActivityMock.update.mockClear();
    liveActivityMock.stop.mockClear();
    voiceRecorderMock.hasAudioRecordingPermission.mockClear();
    voiceRecorderMock.requestAudioRecordingPermission.mockClear();
    voiceRecorderMock.startRecording.mockClear();
    voiceRecorderMock.stopRecording.mockClear();
    voiceRecorderMock.getCurrentStatus.mockReset();
    voiceRecorderMock.getCurrentStatus.mockResolvedValue({ status: 'NONE' });

    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      writable: true,
      value: mediaDevicesMock,
    });

    Object.defineProperty(window, 'MediaRecorder', {
      configurable: true,
      writable: true,
      value: MockMediaRecorder,
    });
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('keeps the recording session alive across route changes', async () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => {
      expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    });

    fireEvent.click(screen.getByRole('button', { name: /go classes/i }));

    expect(await screen.findByTestId('global-session')).toHaveTextContent('recording:note-42');
  });

  it('restores a native recording session when the app becomes active again', async () => {
    capacitorState.native = true;
    localStorage.setItem('riven-active-recording-session', JSON.stringify({
      activeNoteId: 'note-42',
      activeNoteTitle: 'Biology Lecture',
      startedAt: Date.now() - 20_000,
    }));
    voiceRecorderMock.getCurrentStatus.mockResolvedValue({ status: 'RECORDING' });

    renderHarness(['/classes']);

    await waitFor(() => {
      expect(screen.getByTestId('global-session')).toHaveTextContent('recording:note-42');
    });
  });

  it('clears stale persisted native session metadata when no recording is active', async () => {
    capacitorState.native = true;
    localStorage.setItem('riven-active-recording-session', JSON.stringify({
      activeNoteId: 'note-42',
      activeNoteTitle: 'Biology Lecture',
      startedAt: Date.now() - 20_000,
    }));
    voiceRecorderMock.getCurrentStatus.mockResolvedValue({ status: 'NONE' });

    renderHarness(['/classes']);

    await waitFor(() => {
      expect(localStorage.getItem('riven-active-recording-session')).toBeNull();
    });

    expect(screen.getByTestId('global-session')).toHaveTextContent('idle:none');
  });

  it('flushes pending web chunks on pagehide', async () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => {
      expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    });

    await act(async () => {
      MockMediaRecorder.instances[0].emitChunk('pending chunk');
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(recorderStore.some((entry) => entry.noteId === 'note-42')).toBe(true);
    });
  });
});
