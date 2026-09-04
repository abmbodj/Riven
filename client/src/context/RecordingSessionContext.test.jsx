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
  recordingApiMock,
  chunkStoreMock,
  transcriptionState,
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
      getDisplayMedia: vi.fn(),
    },
    recordingApiMock: {
      createRecordingSession: vi.fn(async () => ({ id: 'server-session-1' })),
      createTranscriptionToken: vi.fn(async () => ({ token: 'temporary-token' })),
      uploadRecordingChunk: vi.fn(async () => ({ upload_state: 'verified' })),
      upsertTranscriptSegments: vi.fn(async () => []),
      updateRecordingSession: vi.fn(async () => ({})),
      finalizeRecordingSession: vi.fn(async () => ({})),
      getTranscriptSegments: vi.fn(async () => []),
    },
    chunkStoreMock: {
      saveSession: vi.fn(async (value) => value),
      putChunk: vi.fn(async ({ descriptor }) => descriptor),
      markChunkUploaded: vi.fn(async () => {}),
      getSession: vi.fn(async () => null),
      listChunks: vi.fn(async () => []),
      listPendingChunks: vi.fn(async () => []),
      deleteVerifiedChunk: vi.fn(async () => {}),
    },
    transcriptionState: { options: null, client: null },
  };
});

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorState.native,
  },
  registerPlugin: vi.fn(() => ({})),
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

  pause = vi.fn(() => {
    this.state = 'paused';
  });

  resume = vi.fn(() => {
    this.state = 'recording';
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
      <div data-testid="note-error">{recorder.error || 'none'}</div>
      <div data-testid="note-title">{noteTitle}</div>
      <div data-testid="transcript-count">{recorder.transcriptSegments?.length || 0}</div>
      <div data-testid="requires-continuation">{String(Boolean(recorder.requiresContinuation))}</div>
      <button type="button" onClick={() => recorder.start('note-42', 'Biology Lecture', { classId: 'class-1' })}>
        Start recording
      </button>
      <button type="button" onClick={() => recorder.start('note-42', 'Biology Lecture', { classId: 'class-1', includeTabAudio: true })}>
        Start with tab audio
      </button>
      <button type="button" onClick={() => recorder.pause()}>
        Pause recording
      </button>
      <button type="button" onClick={() => recorder.resume()}>
        Resume recording
      </button>
      <button type="button" onClick={() => recorder.continueRecording()}>
        Continue long recording
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
  const createTranscriptionClient = (options) => {
    transcriptionState.options = options;
    const client = {
      connect: vi.fn(async () => {}),
      send: vi.fn(),
      finalizeAndClose: vi.fn(async () => {}),
      close: vi.fn(),
    };
    transcriptionState.client = client;
    return client;
  };
  const nativeRecorder = {
    start: async () => voiceRecorderMock.startRecording(),
    pause: async () => {},
    resume: async () => {},
    stop: async () => {
      const result = await voiceRecorderMock.stopRecording();
      const value = result?.value || {};
      if (value.recordDataBase64) {
        const binary = atob(value.recordDataBase64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        chunkStoreMock.putChunk({
          sessionId: 'native-test',
          descriptor: { sequence: 0 },
          blob: new Blob([bytes], { type: value.mimeType || 'audio/aac' }),
        });
        return { chunkCount: 1 };
      }
      return { chunkCount: 0 };
    },
    getStatus: async () => {
      const status = await voiceRecorderMock.getCurrentStatus();
      return { state: String(status?.status || 'NONE').toLowerCase() };
    },
    recover: async () => ({ chunkCount: 0 }),
    acknowledgeChunk: async () => {},
    reset: async () => {},
  };

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RecordingSessionProvider services={{
        apiClient: recordingApiMock,
        chunkStore: chunkStoreMock,
        createTranscriptionClient,
        nativeRecorder,
      }}>
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
    mediaDevicesMock.getDisplayMedia.mockReset();
    Object.values(recordingApiMock).forEach((mock) => mock.mockClear());
    Object.values(chunkStoreMock).forEach((mock) => mock.mockClear());
    chunkStoreMock.getSession.mockResolvedValue(null);
    transcriptionState.options = null;
    transcriptionState.client = null;
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

  it('records durable five-second chunks, streams them, and saves final transcript segments', async () => {
    renderHarness();

    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));
    await waitFor(() => expect(screen.getByTestId('note-state')).toHaveTextContent('recording'));

    const mediaRecorder = MockMediaRecorder.instances[0];
    expect(mediaRecorder.start).toHaveBeenCalledWith(5000);
    expect(recordingApiMock.createRecordingSession).toHaveBeenCalledWith(expect.objectContaining({
      noteId: 'note-42',
      classId: 'class-1',
    }));

    mediaRecorder.emitChunk('a sufficiently large classroom audio chunk');
    await waitFor(() => expect(chunkStoreMock.putChunk).toHaveBeenCalledTimes(1));
    expect(transcriptionState.client.send).toHaveBeenCalledWith(expect.any(Blob));
    await waitFor(() => expect(recordingApiMock.uploadRecordingChunk).toHaveBeenCalledTimes(1));

    act(() => {
      transcriptionState.options.onSegment({
        id: 'segment-1', text: 'Photosynthesis stores energy.', startMs: 0, endMs: 1200,
        confidence: 0.98, isFinal: true, revision: 1,
      });
    });
    expect(screen.getByTestId('transcript-count')).toHaveTextContent('1');
    await waitFor(() => expect(recordingApiMock.upsertTranscriptSegments).toHaveBeenCalledWith(
      'server-session-1',
      [expect.objectContaining({ id: 'segment-1' })],
    ));
  });

  it('pauses and resumes a web recording without ending the session', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));
    await waitFor(() => expect(screen.getByTestId('note-state')).toHaveTextContent('recording'));

    fireEvent.click(screen.getByRole('button', { name: /pause recording/i }));
    expect(screen.getByTestId('note-state')).toHaveTextContent('paused');
    expect(MockMediaRecorder.instances[0].pause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /resume recording/i }));
    expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    expect(MockMediaRecorder.instances[0].resume).toHaveBeenCalledTimes(1);
  });

  it('flushes final transcript events and chunk uploads before finalizing a web recording', async () => {
    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));
    await waitFor(() => expect(screen.getByTestId('note-state')).toHaveTextContent('recording'));

    MockMediaRecorder.instances[0].emitChunk('classroom audio '.repeat(100));
    await waitFor(() => expect(recordingApiMock.uploadRecordingChunk).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: /stop recording/i }));

    await waitFor(() => expect(transcriptionState.client.finalizeAndClose).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(recordingApiMock.finalizeRecordingSession).toHaveBeenCalledWith(
      'server-session-1',
      expect.objectContaining({ chunkCount: 1, uploadedCount: 1 }),
    ));
    expect(screen.getByTestId('note-state')).toHaveTextContent('stopped');
  });

  it('requires an explicit continuation after four hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-04T12:00:00Z'));
    renderHarness();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /start recording/i }));
      await flushMicrotasks();
    });
    expect(screen.getByTestId('note-state')).toHaveTextContent('recording');

    await act(async () => {
      vi.setSystemTime(new Date('2026-09-04T16:00:01Z'));
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });

    expect(screen.getByTestId('note-state')).toHaveTextContent('paused');
    expect(screen.getByTestId('requires-continuation')).toHaveTextContent('true');
    expect(MockMediaRecorder.instances[0].pause).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: /continue long recording/i }));
    expect(screen.getByTestId('note-state')).toHaveTextContent('recording');
    expect(screen.getByTestId('requires-continuation')).toHaveTextContent('false');
    expect(MockMediaRecorder.instances[0].resume).toHaveBeenCalledTimes(1);
  });

  it('mixes optional tab audio with the microphone on supported desktop browsers', async () => {
    const microphoneTrack = { stop: vi.fn(), kind: 'audio' };
    const tabAudioTrack = { stop: vi.fn(), kind: 'audio' };
    const tabVideoTrack = { stop: vi.fn(), kind: 'video' };
    const mixedTrack = { stop: vi.fn(), kind: 'audio' };
    mediaDevicesMock.getUserMedia.mockResolvedValueOnce({ getTracks: () => [microphoneTrack] });
    mediaDevicesMock.getDisplayMedia.mockResolvedValueOnce({
      getTracks: () => [tabAudioTrack, tabVideoTrack],
      getAudioTracks: () => [tabAudioTrack],
      getVideoTracks: () => [tabVideoTrack],
    });
    const connect = vi.fn();
    const close = vi.fn();
    window.AudioContext = class MockAudioContext {
      createMediaStreamDestination = () => ({ stream: { getAudioTracks: () => [mixedTrack] } });
      createMediaStreamSource = () => ({ connect });
      close = close;
    };
    window.MediaStream = class MockMediaStream {
      constructor(tracks) { this.tracks = tracks; }
      getTracks = () => this.tracks;
    };

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: /start with tab audio/i }));
    await waitFor(() => expect(screen.getByTestId('note-state')).toHaveTextContent('recording'));

    expect(mediaDevicesMock.getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: true });
    expect(connect).toHaveBeenCalledTimes(2);
    expect(tabVideoTrack.stop).toHaveBeenCalledTimes(1);
    expect(recordingApiMock.createRecordingSession).toHaveBeenCalledWith(expect.objectContaining({
      sourceConfig: expect.objectContaining({ tabAudio: true }),
    }));
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

  it('requires an app update when an old iOS build does not contain the classroom recorder', async () => {
    capacitorState.native = true;
    voiceRecorderMock.startRecording.mockRejectedValueOnce(
      new Error('ClassroomRecorder plugin is not implemented on ios'),
    );

    renderHarness();
    fireEvent.click(screen.getByRole('button', { name: /start recording/i }));

    await waitFor(() => {
      expect(screen.getByTestId('note-state')).toHaveTextContent('error');
      expect(screen.getByTestId('note-error')).toHaveTextContent('update_required');
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

  it('recreates and finalizes a native server session after a process relaunch', async () => {
    capacitorState.native = true;
    const localSessionId = 'native-local-recovery';
    localStorage.setItem('riven-active-recording-session', JSON.stringify({
      activeNoteId: 'note-42',
      activeNoteTitle: 'Recovered Biology',
      localSessionId,
      startedAt: Date.now() - 20_000,
      recordingOptions: { classId: 'class-1', sessionKind: 'lecture' },
    }));
    chunkStoreMock.getSession.mockResolvedValue({
      id: localSessionId,
      noteId: 'note-42',
      classId: 'class-1',
      sourceConfig: { microphone: true, platform: 'ios' },
    });
    voiceRecorderMock.getCurrentStatus.mockResolvedValue({ status: 'STOPPED', sessionId: localSessionId });

    renderHarness(['/classes']);

    await waitFor(() => expect(recordingApiMock.createRecordingSession).toHaveBeenCalledWith(
      expect.objectContaining({ clientSessionId: localSessionId, noteId: 'note-42' }),
    ));
    await waitFor(() => expect(recordingApiMock.finalizeRecordingSession).toHaveBeenCalledWith(
      'server-session-1',
      expect.any(Object),
    ));
    expect(screen.getByTestId('global-session')).toHaveTextContent('stopped:note-42');
  });

  it('salvages encrypted pending web chunks after a reload', async () => {
    const descriptor = {
      sequence: 0,
      startedAtMs: 0,
      endedAtMs: 5000,
      durationMs: 5000,
      source: 'microphone',
      mimeType: 'audio/webm',
      byteSize: 12,
      checksum: 'checksum-1',
      uploadState: 'pending',
    };
    chunkStoreMock.getSession = vi.fn(async () => ({
      id: 'local-recovery-1',
      noteId: 'note-42',
      noteTitle: 'Recovered Biology',
      serverSessionId: 'server-session-1',
      uploadedChunkCount: 0,
    }));
    chunkStoreMock.listChunks.mockResolvedValueOnce([descriptor]);
    chunkStoreMock.getChunk = vi.fn(async () => ({ ...descriptor, blob: new Blob(['recovered audio']) }));
    localStorage.setItem('riven-active-recording-session', JSON.stringify({
      activeNoteId: 'note-42',
      activeNoteTitle: 'Recovered Biology',
      localSessionId: 'local-recovery-1',
      recordingSessionId: 'server-session-1',
      startedAt: Date.now() - 5000,
    }));

    renderHarness(['/classes']);

    await waitFor(() => expect(recordingApiMock.uploadRecordingChunk).toHaveBeenCalledWith(
      'server-session-1',
      expect.objectContaining({ sequence: 0, checksum: 'checksum-1' }),
      expect.any(Blob),
    ));
    await waitFor(() => expect(recordingApiMock.finalizeRecordingSession).toHaveBeenCalledWith(
      'server-session-1',
      expect.objectContaining({ chunkCount: 1, uploadedCount: 1 }),
    ));
    expect(screen.getByTestId('global-session')).toHaveTextContent('stopped:note-42');
    expect(chunkStoreMock.deleteVerifiedChunk).toHaveBeenCalledWith('local-recovery-1', 0);
    expect(localStorage.getItem('riven-active-recording-session')).toBeNull();
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
