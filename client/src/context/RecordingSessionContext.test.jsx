import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RecordingSessionProvider } from './RecordingSessionContext.jsx';
import useRecordingSession from '../hooks/useRecordingSession.js';

const {
  appStateListeners,
  liveActivityMock,
  voiceRecorderMock,
  capacitorState,
  mediaDevicesMock,
} = vi.hoisted(() => {
  const listeners = [];

  return {
    appStateListeners: listeners,
    liveActivityMock: {
      isAvailable: vi.fn(async () => ({ value: true })),
      startActivity: vi.fn(async () => ({})),
      updateActivity: vi.fn(async () => ({})),
      endActivity: vi.fn(async () => ({})),
    },
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
  const [noteTitle, setNoteTitle] = useState('Biology Lecture');
  const recorder = useRecordingSession({
    noteId: 'note-42',
    noteTitle,
  });

  return (
    <div>
      <div data-testid="note-state">{recorder.state}</div>
      <div data-testid="note-title">{noteTitle}</div>
      <button type="button" onClick={() => recorder.start('note-42', 'Biology Lecture')}>
        Start recording
      </button>
      <button type="button" onClick={() => recorder.stop()}>
        Stop recording
      </button>
      <button type="button" onClick={() => recorder.reset()}>
        Reset recording
      </button>
      <button type="button" onClick={() => setNoteTitle('Chemistry Lecture')}>
        Rename note
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

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('RecordingSessionProvider', () => {
  beforeEach(() => {
    capacitorState.native = false;
    appStateListeners.splice(0, appStateListeners.length);
    localStorage.clear();
    MockMediaRecorder.instances = [];
    mediaDevicesMock.getUserMedia.mockClear();
    liveActivityMock.isAvailable.mockClear();
    liveActivityMock.startActivity.mockClear();
    liveActivityMock.updateActivity.mockClear();
    liveActivityMock.endActivity.mockClear();
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
    vi.useRealTimers();
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
    voiceRecorderMock.stopRecording.mockResolvedValueOnce({ value: {} });
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

  it('starts a native live activity with a stable id and does not update it every second', async () => {
    capacitorState.native = true;
    vi.useFakeTimers();

    renderHarness();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));
      await flushMicrotasks();
    });

    expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    expect(liveActivityMock.startActivity).toHaveBeenCalledWith({
      id: 'active-note-recording',
      attributes: {
        kind: 'noteRecording',
        noteId: 'note-42',
      },
      contentState: expect.objectContaining({
        noteTitle: 'Biology Lecture',
        status: 'Recording note',
        startedAt: expect.any(String),
      }),
    });

    await act(async () => {
      vi.advanceTimersByTime(5_000);
      await flushMicrotasks();
    });

    expect(liveActivityMock.updateActivity).not.toHaveBeenCalled();
  });

  it('updates the native live activity when the active note title changes', async () => {
    capacitorState.native = true;

    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => {
      expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    });

    fireEvent.click(screen.getByRole('button', { name: /rename note/i }));

    await waitFor(() => {
      expect(liveActivityMock.updateActivity).toHaveBeenCalledWith({
        id: 'active-note-recording',
        attributes: {
          kind: 'noteRecording',
          noteId: 'note-42',
        },
        contentState: expect.objectContaining({
          noteTitle: 'Chemistry Lecture',
          status: 'Recording note',
          startedAt: expect.any(String),
        }),
      });
    });
  });

  it('ends the native live activity when recording stops or resets', async () => {
    capacitorState.native = true;

    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => {
      expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    });

    liveActivityMock.endActivity.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));

    await waitFor(() => {
      expect(liveActivityMock.endActivity).toHaveBeenCalledWith({
        id: 'active-note-recording',
        attributes: {
          kind: 'noteRecording',
          noteId: 'note-42',
        },
        contentState: expect.objectContaining({
          noteTitle: 'Biology Lecture',
          status: 'Recording note',
          startedAt: expect.any(String),
        }),
      });
    });

    liveActivityMock.endActivity.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => {
      expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    });

    liveActivityMock.endActivity.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /reset recording/i }));

    await waitFor(() => {
      expect(liveActivityMock.endActivity).toHaveBeenCalledTimes(1);
    });
  });

  it('ends the native live activity when stopping the recorder fails', async () => {
    capacitorState.native = true;
    voiceRecorderMock.stopRecording.mockRejectedValueOnce(new Error('stop failed'));

    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => {
      expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    });

    liveActivityMock.endActivity.mockClear();

    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));

    await waitFor(() => {
      expect(liveActivityMock.endActivity).toHaveBeenCalledTimes(1);
    });
  });
});
