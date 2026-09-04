import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { LiveActivity } from 'capacitor-live-activity';
import { api } from '../api.js';
import { createDeepgramStreamingClient } from '../services/deepgramLive.js';
import { createNativeClassroomRecorderAdapter } from '../services/nativeClassroomRecorder.js';
import {
    createIndexedDbRecordingChunkStore,
    createMemoryRecordingChunkStore,
} from '../utils/recordingChunkStore.js';
import {
    buildChunkDescriptor,
    mergeTranscriptSegments,
    RECORDING_CHUNK_MS,
} from '../utils/recordingSessionV2.js';
import { ThemeContext } from './themeContext';

const MIME_TYPE = 'audio/webm;codecs=opus';
const FALLBACK_MIME = 'audio/webm';
const ACTIVE_SESSION_STORAGE_KEY = 'riven-active-recording-session';
const LIVE_ACTIVITY_ID = 'active-note-recording';
const LIVE_ACTIVITY_STATUS = 'Recording note';
const FOUR_HOURS_SECONDS = 4 * 60 * 60;

const requiresNativeRecorderUpdate = (error) => {
    const code = String(error?.code || '').toLowerCase();
    const message = String(error?.message || error || '').toLowerCase();
    return code === 'unimplemented'
        || code === 'not_implemented'
        || message.includes('classroomrecorder') && message.includes('not implemented')
        || message.includes('classroom recorder') && message.includes('not available');
};

const INITIAL_SESSION = {
    activeNoteId: null,
    activeNoteTitle: '',
    state: 'idle',
    duration: 0,
    startedAt: null,
    error: null,
    audioPath: null,
    recordingSessionId: null,
    localSessionId: null,
    transcriptSegments: [],
    transcriptState: 'idle',
    chunkCount: 0,
    uploadedChunkCount: 0,
    requiresContinuation: false,
};

export const RecordingSessionContext = createContext(null);

function readPersistedActiveSession() {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function persistActiveSessionSnapshot(snapshot) {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
        // Ignore localStorage write failures.
    }
}

function clearPersistedActiveSession() {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.removeItem(ACTIVE_SESSION_STORAGE_KEY);
    } catch {
        // Ignore localStorage delete failures.
    }
}

const createDefaultChunkStore = () => (
    typeof globalThis.indexedDB === 'undefined'
        ? createMemoryRecordingChunkStore()
        : createIndexedDbRecordingChunkStore()
);

export function RecordingSessionProvider({ children, services = null }) {
    const { activeTheme } = useContext(ThemeContext) || {};
    const [session, setSession] = useState(INITIAL_SESSION);
    const sessionRef = useRef(INITIAL_SESSION);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const auxiliaryStreamsRef = useRef([]);
    const audioContextRef = useRef(null);
    const chunksRef = useRef([]);
    const capturedByteCountRef = useRef(0);
    const audioBlobRef = useRef(null);
    const durationTimerRef = useRef(null);
    const liveActivityAvailableRef = useRef(null);
    const durationRef = useRef(0);
    const localSessionIdRef = useRef(null);
    const serverSessionPromiseRef = useRef(null);
    const chunkSequenceRef = useRef(0);
    const uploadedChunkCountRef = useRef(0);
    const handledChunkSequencesRef = useRef(new Set());
    const longRecordingGateReachedRef = useRef(false);
    const recordingOptionsRef = useRef({});
    const uploadPromisesRef = useRef(new Set());
    const transcriptUploadPromisesRef = useRef(new Set());
    const transcriptionClientRef = useRef(null);
    const serviceRef = useRef(null);

    if (!serviceRef.current) {
        serviceRef.current = {
            apiClient: api,
            chunkStore: createDefaultChunkStore(),
            createTranscriptionClient: createDeepgramStreamingClient,
            nativeRecorder: createNativeClassroomRecorderAdapter(),
            ...(services || {}),
        };
    }

    const isNative = Capacitor.isNativePlatform();

    const setSessionSnapshot = useCallback((updater) => {
        setSession((prev) => {
            const next = typeof updater === 'function' ? updater(prev) : updater;
            sessionRef.current = next;
            return next;
        });
    }, []);

    const stopDurationTimer = useCallback(() => {
        if (durationTimerRef.current) {
            window.clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
    }, []);

    const releaseWebMediaResources = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        }
        auxiliaryStreamsRef.current.forEach((stream) => {
            stream?.getTracks?.().forEach((track) => track.stop());
        });
        auxiliaryStreamsRef.current = [];
        if (audioContextRef.current) {
            void audioContextRef.current.close?.();
            audioContextRef.current = null;
        }

        mediaRecorderRef.current = null;
    }, []);

    const isLiveActivityAvailable = useCallback(async () => {
        if (!isNative) return false;
        if (typeof liveActivityAvailableRef.current === 'boolean') {
            return liveActivityAvailableRef.current;
        }

        try {
            const result = await LiveActivity.isAvailable();
            liveActivityAvailableRef.current = Boolean(result?.value);
        } catch {
            liveActivityAvailableRef.current = false;
        }

        return liveActivityAvailableRef.current;
    }, [isNative]);

    const buildLiveActivityPayload = useCallback((noteId, noteTitle = 'Untitled', startedAt = Date.now()) => ({
        id: LIVE_ACTIVITY_ID,
        attributes: {
            kind: 'noteRecording',
            noteId,
            ...(activeTheme && {
                bgColor: activeTheme.bg_color,
                surfaceColor: activeTheme.surface_color,
                textColor: activeTheme.text_color,
                secondaryTextColor: activeTheme.secondary_text_color,
                borderColor: activeTheme.border_color,
                accentColor: activeTheme.accent_color,
            }),
        },
        contentState: {
            noteTitle: noteTitle || 'Untitled',
            status: LIVE_ACTIVITY_STATUS,
            startedAt: String(Math.floor(startedAt / 1000)),
        },
    }), [activeTheme]);

    const updateLiveActivity = useCallback(async (noteId, noteTitle, startedAt) => {
        if (!noteId || !startedAt) return;
        if (!(await isLiveActivityAvailable())) return;

        try {
            await LiveActivity.updateActivity(
                buildLiveActivityPayload(noteId, noteTitle, startedAt),
            );
        } catch (error) {
            console.log('Failed to update live activity', error);
        }
    }, [buildLiveActivityPayload, isLiveActivityAvailable]);

    const startLiveActivity = useCallback(async (noteId, noteTitle, startedAt) => {
        if (!noteId || !startedAt) return;
        if (!(await isLiveActivityAvailable())) return;

        const payload = buildLiveActivityPayload(noteId, noteTitle, startedAt);

        try {
            await LiveActivity.endActivity(payload);
            await LiveActivity.startActivity(payload);
        } catch (error) {
            console.log('Failed to start live activity', error);
        }
    }, [buildLiveActivityPayload, isLiveActivityAvailable]);

    const stopLiveActivity = useCallback(async (snapshot = sessionRef.current) => {
        if (!snapshot?.activeNoteId || !snapshot?.startedAt) return;
        if (!(await isLiveActivityAvailable())) return;

        try {
            await LiveActivity.endActivity(
                buildLiveActivityPayload(snapshot.activeNoteId, snapshot.activeNoteTitle, snapshot.startedAt),
            );
        } catch (error) {
            console.log('Failed to stop live activity', error);
        }
    }, [buildLiveActivityPayload, isLiveActivityAvailable]);

    const persistRecordingState = useCallback((snapshot = sessionRef.current) => {
        if ((snapshot.state === 'recording' || snapshot.state === 'paused') && snapshot.activeNoteId) {
            persistActiveSessionSnapshot({
                activeNoteId: snapshot.activeNoteId,
                activeNoteTitle: snapshot.activeNoteTitle,
                startedAt: snapshot.startedAt,
                localSessionId: snapshot.localSessionId,
                recordingSessionId: snapshot.recordingSessionId,
                recordingOptions: recordingOptionsRef.current,
            });
            return;
        }

        clearPersistedActiveSession();
    }, []);

    const updateDuration = useCallback((seconds, startedAt = sessionRef.current.startedAt) => {
        durationRef.current = seconds;

        setSessionSnapshot((prev) => {
            if (prev.duration === seconds && prev.startedAt === startedAt) {
                return prev;
            }

            return {
                ...prev,
                duration: seconds,
                startedAt,
            };
        });
    }, [setSessionSnapshot]);

    const startDurationTicker = useCallback((startedAt) => {
        stopDurationTimer();

        const tick = () => {
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
            if (elapsedSeconds >= FOUR_HOURS_SECONDS && !longRecordingGateReachedRef.current) {
                longRecordingGateReachedRef.current = true;
                durationRef.current = elapsedSeconds;
                if (isNative) {
                    void serviceRef.current.nativeRecorder.pause();
                } else if (mediaRecorderRef.current?.state === 'recording') {
                    mediaRecorderRef.current.pause();
                }
                stopDurationTimer();
                setSessionSnapshot((prev) => ({
                    ...prev,
                    duration: elapsedSeconds,
                    state: 'paused',
                    requiresContinuation: true,
                }));
                void serverSessionPromiseRef.current?.then((remote) => (
                    remote?.id ? serviceRef.current.apiClient.updateRecordingSession(remote.id, { state: 'paused' }) : null
                )).catch(() => {});
                return;
            }
            updateDuration(elapsedSeconds, startedAt);
        };

        tick();
        durationTimerRef.current = window.setInterval(tick, 1000);
    }, [isNative, setSessionSnapshot, stopDurationTimer, updateDuration]);

    const resetInMemorySession = useCallback((updater = null) => {
        audioBlobRef.current = null;
        chunksRef.current = [];
        capturedByteCountRef.current = 0;
        durationRef.current = 0;
        localSessionIdRef.current = null;
        serverSessionPromiseRef.current = null;
        chunkSequenceRef.current = 0;
        uploadedChunkCountRef.current = 0;
        handledChunkSequencesRef.current.clear();
        longRecordingGateReachedRef.current = false;
        recordingOptionsRef.current = {};
        uploadPromisesRef.current.clear();
        transcriptUploadPromisesRef.current.clear();
        transcriptionClientRef.current?.close?.();
        transcriptionClientRef.current = null;
        stopDurationTimer();
        clearPersistedActiveSession();

        setSessionSnapshot((prev) => {
            const base = { ...INITIAL_SESSION };
            return typeof updater === 'function' ? updater(base, prev) : base;
        });
    }, [setSessionSnapshot, stopDurationTimer]);

    const syncNoteContext = useCallback(async (noteId, noteTitle = 'Untitled') => {
        if (!noteId) return;

        const safeTitle = noteTitle || 'Untitled';
        const current = sessionRef.current;
        if (current.activeNoteId === noteId && safeTitle !== current.activeNoteTitle) {
            const nextSnapshot = {
                ...current,
                activeNoteTitle: safeTitle,
            };

            sessionRef.current = nextSnapshot;
            setSession(nextSnapshot);
            persistRecordingState(nextSnapshot);

            if (nextSnapshot.state === 'recording' && nextSnapshot.startedAt) {
                void updateLiveActivity(nextSnapshot.activeNoteId, safeTitle, nextSnapshot.startedAt);
            }
        }
    }, [persistRecordingState, setSession, updateLiveActivity]);

    const setAudioPath = useCallback((audioPath) => {
        setSessionSnapshot((prev) => {
            if (prev.audioPath === audioPath) {
                return prev;
            }

            return {
                ...prev,
                audioPath,
            };
        });
    }, [setSessionSnapshot]);

    const finalizeRemoteSession = useCallback(async () => {
        const remoteSession = await serverSessionPromiseRef.current?.catch(() => null);
        await Promise.allSettled([...uploadPromisesRef.current]);
        await Promise.allSettled([...transcriptUploadPromisesRef.current]);
        const pendingChunks = await serviceRef.current.chunkStore.listPendingChunks(localSessionIdRef.current);
        if (pendingChunks.length) throw new Error('recording_upload_incomplete');
        if (!remoteSession?.id) {
            if (chunkSequenceRef.current > 0) throw new Error('recording_session_unavailable');
            return;
        }
        await serviceRef.current.apiClient.finalizeRecordingSession(remoteSession.id, {
            durationMs: durationRef.current * 1000,
            chunkCount: chunkSequenceRef.current,
            uploadedCount: uploadedChunkCountRef.current,
        });
    }, []);

    const finalizeStoppedSession = useCallback(async () => {
        stopDurationTimer();
        setSessionSnapshot((prev) => ({ ...prev, state: 'uploading', startedAt: null }));
        const transcriptionClient = transcriptionClientRef.current;
        transcriptionClientRef.current = null;
        try {
            if (typeof transcriptionClient?.finalizeAndClose === 'function') {
                await transcriptionClient.finalizeAndClose();
            } else {
                transcriptionClient?.close?.();
            }
            await finalizeRemoteSession();
            clearPersistedActiveSession();
            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'stopped',
                startedAt: null,
                error: null,
                audioPath: null,
            }));
            await serviceRef.current.chunkStore.saveSession({
                ...sessionRef.current,
                id: localSessionIdRef.current,
                state: 'stopped',
            }).catch(() => {});
        } catch {
            const recoverySnapshot = {
                ...sessionRef.current,
                state: 'error',
                startedAt: null,
                error: 'recovery_failed',
            };
            setSessionSnapshot(recoverySnapshot);
            await serviceRef.current.chunkStore.saveSession({
                ...recoverySnapshot,
                id: localSessionIdRef.current,
                state: 'failed',
            }).catch(() => {});
            persistActiveSessionSnapshot({
                activeNoteId: recoverySnapshot.activeNoteId,
                activeNoteTitle: recoverySnapshot.activeNoteTitle,
                localSessionId: localSessionIdRef.current,
                recordingSessionId: recoverySnapshot.recordingSessionId,
                recordingOptions: recordingOptionsRef.current,
            });
        }
    }, [finalizeRemoteSession, setSessionSnapshot, stopDurationTimer]);

    const handleTranscriptSegment = useCallback((segment) => {
        setSessionSnapshot((prev) => ({
            ...prev,
            transcriptSegments: mergeTranscriptSegments(prev.transcriptSegments, [segment]),
            transcriptState: segment.isFinal ? 'live' : prev.transcriptState,
        }));
        if (!segment.isFinal) return;
        const transcriptUpload = serverSessionPromiseRef.current?.then((remoteSession) => {
            if (!remoteSession?.id) return null;
            return serviceRef.current.apiClient.upsertTranscriptSegments(remoteSession.id, [segment]);
        });
        if (transcriptUpload) {
            transcriptUploadPromisesRef.current.add(transcriptUpload);
            transcriptUpload.catch(() => {}).finally(() => transcriptUploadPromisesRef.current.delete(transcriptUpload));
        }
    }, [setSessionSnapshot]);

    const initializeTranscriptionPipeline = useCallback((options = {}) => {
        if (transcriptionClientRef.current) return transcriptionClientRef.current;
        const transcriptionClient = serviceRef.current.createTranscriptionClient({
            tokenProvider: () => serviceRef.current.apiClient.createTranscriptionToken(),
            onSegment: handleTranscriptSegment,
            onState: (transcriptState) => {
                setSessionSnapshot((prev) => ({ ...prev, transcriptState }));
            },
            onError: () => {
                setSessionSnapshot((prev) => ({ ...prev, transcriptState: 'offline' }));
            },
        });
        transcriptionClientRef.current = transcriptionClient;
        void transcriptionClient.connect({
            languages: [
                options.languageConfig?.primary || 'en',
                ...(options.languageConfig?.secondary || []),
            ],
            keyterms: options.keyterms || [],
            source: options.includeTabAudio ? 'mixed' : 'microphone',
            ...(isNative ? { encoding: 'linear16', sampleRate: 16000, channels: 1 } : {}),
        }).catch(() => {});
        return transcriptionClient;
    }, [handleTranscriptSegment, isNative, setSessionSnapshot]);

    const initializeRecordingPipeline = useCallback((noteId, noteTitle, options, localSessionId) => {
        const sourceConfig = {
            microphone: true,
            tabAudio: Boolean(options.includeTabAudio),
            platform: isNative ? 'ios' : 'web',
        };
        void serviceRef.current.chunkStore.saveSession({
            id: localSessionId,
            noteId,
            noteTitle: noteTitle || 'Untitled',
            classId: options.classId || null,
            state: 'preflight',
            sourceConfig,
            recordingOptions: options,
        }).catch(() => {});

        const serverPromise = serviceRef.current.apiClient.createRecordingSession({
            noteId,
            classId: options.classId || null,
            clientSessionId: localSessionId,
            sessionKind: options.sessionKind || 'lecture',
            sourceConfig,
            languageConfig: options.languageConfig || { primary: 'en', secondary: [] },
        }).then((remoteSession) => {
            setSessionSnapshot((prev) => ({ ...prev, recordingSessionId: remoteSession.id }));
            const activeSnapshot = sessionRef.current;
            if (['recording', 'paused', 'requesting_permission'].includes(activeSnapshot.state)) {
                persistActiveSessionSnapshot({
                    activeNoteId: noteId,
                    activeNoteTitle: noteTitle || 'Untitled',
                    startedAt: activeSnapshot.startedAt,
                    localSessionId,
                    recordingSessionId: remoteSession.id,
                    recordingOptions: options,
                });
            }
            void serviceRef.current.chunkStore.saveSession({
                ...sessionRef.current,
                id: localSessionId,
                serverSessionId: remoteSession.id,
            }).catch(() => {});
            return remoteSession;
        }).catch(() => null);
        serverSessionPromiseRef.current = serverPromise;

        initializeTranscriptionPipeline(options);
    }, [initializeTranscriptionPipeline, isNative, setSessionSnapshot]);

    const handleWebChunk = useCallback(async (blob, mimeType, source, nativeChunk = null) => {
        if (!blob?.size || !localSessionIdRef.current) return;
        const suppliedSequence = Number.isInteger(nativeChunk?.sequence) ? nativeChunk.sequence : null;
        const sequence = suppliedSequence ?? chunkSequenceRef.current;
        if (handledChunkSequencesRef.current.has(sequence)) return;
        handledChunkSequencesRef.current.add(sequence);
        capturedByteCountRef.current += blob.size;
        transcriptionClientRef.current?.send?.(blob);

        chunkSequenceRef.current = Math.max(chunkSequenceRef.current, sequence + 1);
        const durationMs = Math.max(1, nativeChunk?.durationMs || RECORDING_CHUNK_MS);
        const descriptor = buildChunkDescriptor({
            sessionId: localSessionIdRef.current,
            sequence,
            startedAtMs: nativeChunk?.startedAtMs ?? sequence * RECORDING_CHUNK_MS,
            durationMs,
            source,
            mimeType,
            byteSize: blob.size,
        });
        const storedDescriptor = await serviceRef.current.chunkStore.putChunk({
            sessionId: localSessionIdRef.current,
            descriptor,
            blob,
        });
        setSessionSnapshot((prev) => ({ ...prev, chunkCount: chunkSequenceRef.current }));

        const uploadPromise = serverSessionPromiseRef.current?.then(async (remoteSession) => {
            if (!remoteSession?.id) return;
            const remoteDescriptor = { ...descriptor, ...storedDescriptor };
            const uploaded = await serviceRef.current.apiClient.uploadRecordingChunk(remoteSession.id, remoteDescriptor, blob);
            await serviceRef.current.chunkStore.markChunkUploaded(localSessionIdRef.current, sequence, {
                storagePath: uploaded?.storage_path || `${remoteSession.id}/${sequence}`,
            });
            await serviceRef.current.chunkStore.deleteVerifiedChunk(localSessionIdRef.current, sequence).catch(() => {});
            if (nativeChunk) {
                await serviceRef.current.nativeRecorder.acknowledgeChunk(localSessionIdRef.current, sequence).catch(() => {});
            }
            uploadedChunkCountRef.current += 1;
            setSessionSnapshot((prev) => ({
                ...prev,
                uploadedChunkCount: uploadedChunkCountRef.current,
            }));
            await serviceRef.current.chunkStore.saveSession({
                ...sessionRef.current,
                id: localSessionIdRef.current,
                serverSessionId: remoteSession.id,
                chunkCount: chunkSequenceRef.current,
                uploadedChunkCount: uploadedChunkCountRef.current,
                state: sessionRef.current.state,
            }).catch(() => {});
        });
        if (uploadPromise) {
            uploadPromisesRef.current.add(uploadPromise);
            uploadPromise.catch(() => {}).finally(() => uploadPromisesRef.current.delete(uploadPromise));
        }
    }, [setSessionSnapshot]);

    const startWeb = useCallback(async (_noteId, options = {}) => {
        if (!navigator.mediaDevices?.getUserMedia) {
            const error = new Error('NotSupportedError');
            error.code = 'NOT_SUPPORTED';
            throw error;
        }

        const microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                channelCount: 1,
            },
        });
        let stream = microphoneStream;
        if (options.includeTabAudio) {
            if (!navigator.mediaDevices.getDisplayMedia) {
                throw new Error('Tab audio capture is not supported in this browser');
            }
            const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
            displayStream.getVideoTracks?.().forEach((track) => track.stop());
            if (!displayStream.getAudioTracks?.().length) {
                displayStream.getTracks?.().forEach((track) => track.stop());
                throw new Error('Select a browser tab and enable Share tab audio');
            }
            const AudioContextImpl = globalThis.AudioContext || globalThis.webkitAudioContext;
            if (!AudioContextImpl || !globalThis.MediaStream) {
                displayStream.getTracks?.().forEach((track) => track.stop());
                throw new Error('Tab audio mixing is not supported in this browser');
            }
            const audioContext = new AudioContextImpl();
            const destination = audioContext.createMediaStreamDestination();
            audioContext.createMediaStreamSource(microphoneStream).connect(destination);
            audioContext.createMediaStreamSource(displayStream).connect(destination);
            stream = new globalThis.MediaStream(destination.stream.getAudioTracks());
            auxiliaryStreamsRef.current = [microphoneStream, displayStream];
            audioContextRef.current = audioContext;
        }
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : FALLBACK_MIME;
        // 64kbps Opus is still tiny but materially improves speech-to-text accuracy over 32kbps.
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 64000 });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                void handleWebChunk(
                    event.data,
                    mimeType,
                    options.includeTabAudio ? 'mixed' : 'microphone',
                );
            }
        };

        recorder.onerror = () => {
            releaseWebMediaResources();
            stopDurationTimer();
            clearPersistedActiveSession();

            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'error',
                startedAt: null,
                error: 'recording_failed',
            }));
        };

        recorder.onstop = () => {
            audioBlobRef.current = null;
            releaseWebMediaResources();
            stopDurationTimer();
            clearPersistedActiveSession();

            if (capturedByteCountRef.current < 1000) {
                setSessionSnapshot((prev) => ({
                    ...prev,
                    state: 'idle',
                    startedAt: null,
                    error: 'no_audio',
                }));
                return;
            }

            void finalizeStoppedSession();
        };

        recorder.start(RECORDING_CHUNK_MS);
    }, [finalizeStoppedSession, handleWebChunk, releaseWebMediaResources, setSessionSnapshot, stopDurationTimer]);

    const startNative = useCallback(async (localSessionId) => {
        await serviceRef.current.nativeRecorder.start({
            sessionId: localSessionId,
            onChunk: (chunk) => {
                return handleWebChunk(
                    chunk.blob,
                    chunk.mimeType || 'application/octet-stream',
                    'microphone',
                    chunk,
                );
            },
            onInterruption: ({ state: interruptionState }) => {
                if (interruptionState === 'paused') {
                    stopDurationTimer();
                    setSessionSnapshot((prev) => ({ ...prev, state: 'paused' }));
                } else if (interruptionState === 'resumed') {
                    const resumedAt = Date.now() - (durationRef.current * 1000);
                    setSessionSnapshot((prev) => ({ ...prev, state: 'recording', startedAt: resumedAt }));
                    startDurationTicker(resumedAt);
                }
            },
        });
    }, [handleWebChunk, setSessionSnapshot, startDurationTicker, stopDurationTimer]);

    const start = useCallback(async (noteId, noteTitle = 'Untitled', options = {}) => {
        if (!noteId) {
            throw new Error('missing_note_id');
        }

        if (sessionRef.current.state === 'recording') {
            if (sessionRef.current.activeNoteId === noteId) {
                return;
            }

            throw new Error('another_recording_active');
        }

        audioBlobRef.current = null;
        chunksRef.current = [];
        capturedByteCountRef.current = 0;
        durationRef.current = 0;
        chunkSequenceRef.current = 0;
        uploadedChunkCountRef.current = 0;
        handledChunkSequencesRef.current.clear();
        longRecordingGateReachedRef.current = false;
        recordingOptionsRef.current = options;
        uploadPromisesRef.current.clear();
        const localSessionId = globalThis.crypto?.randomUUID?.()
            || `recording-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        localSessionIdRef.current = localSessionId;
        stopDurationTimer();
        clearPersistedActiveSession();

        setSessionSnapshot((prev) => ({
            ...prev,
            activeNoteId: noteId,
            activeNoteTitle: noteTitle || 'Untitled',
            state: 'requesting_permission',
            duration: 0,
            startedAt: null,
            error: null,
            audioPath: null,
            localSessionId,
            recordingSessionId: null,
            transcriptSegments: [],
            transcriptState: 'connecting',
            chunkCount: 0,
            uploadedChunkCount: 0,
            requiresContinuation: false,
        }));

        try {
            initializeRecordingPipeline(noteId, noteTitle, options, localSessionId);
            if (isNative) {
                await startNative(localSessionId);
            } else {
                await startWeb(noteId, options);
            }

            const startedAt = Date.now();
            const nextSnapshot = {
                ...sessionRef.current,
                activeNoteId: noteId,
                activeNoteTitle: noteTitle || 'Untitled',
                state: 'recording',
                duration: 0,
                startedAt,
                error: null,
                audioPath: null,
            };

            sessionRef.current = nextSnapshot;
            setSession(nextSnapshot);
            persistRecordingState(nextSnapshot);
            void serverSessionPromiseRef.current?.then((remote) => (
                remote?.id ? serviceRef.current.apiClient.updateRecordingSession(remote.id, {
                    state: 'recording',
                    startedAt: new Date(startedAt).toISOString(),
                }) : null
            )).catch(() => {});
            await startLiveActivity(nextSnapshot.activeNoteId, nextSnapshot.activeNoteTitle, startedAt);
            startDurationTicker(startedAt);
        } catch (error) {
            releaseWebMediaResources();
            stopDurationTimer();
            clearPersistedActiveSession();
            await stopLiveActivity();

            const updateRequired = isNative && requiresNativeRecorderUpdate(error);
            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'error',
                startedAt: null,
                duration: 0,
                error: updateRequired
                    ? 'update_required'
                    : error?.name === 'NotAllowedError'
                    || error?.name === 'PermissionDeniedError'
                    || error?.message === 'PermissionDeniedError'
                    ? 'permission_denied'
                    : 'recording_failed',
            }));
        }
    }, [
        isNative,
        initializeRecordingPipeline,
        persistRecordingState,
        releaseWebMediaResources,
        setSession,
        setSessionSnapshot,
        startDurationTicker,
        startLiveActivity,
        startNative,
        startWeb,
        stopDurationTimer,
        stopLiveActivity,
    ]);

    const pause = useCallback(() => {
        if (sessionRef.current.state !== 'recording') return;
        if (isNative) {
            void serviceRef.current.nativeRecorder.pause();
        } else if (mediaRecorderRef.current?.state === 'recording') {
            mediaRecorderRef.current.pause();
        } else {
            return;
        }
        stopDurationTimer();
        setSessionSnapshot((prev) => ({ ...prev, state: 'paused' }));
        void serverSessionPromiseRef.current?.then((remote) => (
            remote?.id ? serviceRef.current.apiClient.updateRecordingSession(remote.id, { state: 'paused' }) : null
        )).catch(() => {});
    }, [isNative, setSessionSnapshot, stopDurationTimer]);

    const resume = useCallback((confirmedLongRecording = false) => {
        if (sessionRef.current.state !== 'paused') return;
        if (sessionRef.current.requiresContinuation && !confirmedLongRecording) return;
        if (isNative) {
            void serviceRef.current.nativeRecorder.resume();
        } else if (mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.resume();
        } else {
            return;
        }
        const resumedAt = Date.now() - (durationRef.current * 1000);
        setSessionSnapshot((prev) => ({
            ...prev,
            state: 'recording',
            startedAt: resumedAt,
            requiresContinuation: false,
        }));
        startDurationTicker(resumedAt);
        void serverSessionPromiseRef.current?.then((remote) => (
            remote?.id ? serviceRef.current.apiClient.updateRecordingSession(remote.id, { state: 'recording' }) : null
        )).catch(() => {});
    }, [isNative, setSessionSnapshot, startDurationTicker]);

    const continueRecording = useCallback(() => {
        if (!sessionRef.current.requiresContinuation) return;
        resume(true);
    }, [resume]);

    const stopNative = useCallback(async () => {
        try {
            const result = await serviceRef.current.nativeRecorder.stop();
            await stopLiveActivity();

            if (capturedByteCountRef.current > 0 || result?.chunkCount > 0) {
                audioBlobRef.current = null;
                await finalizeStoppedSession();
            } else {
                setSessionSnapshot((prev) => ({
                    ...prev,
                    state: 'idle',
                    startedAt: null,
                    error: 'no_audio',
                }));
            }
        } catch {
            await stopLiveActivity();
            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'error',
                startedAt: null,
                error: 'recording_failed',
            }));
        }
    }, [finalizeStoppedSession, setSessionSnapshot, stopLiveActivity]);

    const stop = useCallback(() => {
        if (!['recording', 'paused'].includes(sessionRef.current.state)) {
            return;
        }

        clearPersistedActiveSession();

        if (isNative) {
            void stopNative();
            return;
        }

        if (mediaRecorderRef.current?.state === 'recording' || mediaRecorderRef.current?.state === 'paused') {
            mediaRecorderRef.current.stop();
            return;
        }

        setSessionSnapshot((prev) => ({
            ...prev,
            state: 'error',
            startedAt: null,
            error: 'recording_failed',
        }));
    }, [isNative, setSessionSnapshot, stopNative]);

    const setProcessingState = useCallback((newState) => {
        if (!['uploading', 'processing', 'complete', 'error'].includes(newState)) {
            return;
        }

        clearPersistedActiveSession();
        stopDurationTimer();

        setSessionSnapshot((prev) => ({
            ...prev,
            state: newState,
            startedAt: null,
            error: newState === 'error' ? prev.error || 'recording_failed' : null,
        }));
    }, [setSessionSnapshot, stopDurationTimer]);

    const reset = useCallback(() => {
        releaseWebMediaResources();
        void stopLiveActivity();
        resetInMemorySession();
    }, [releaseWebMediaResources, resetInMemorySession, stopLiveActivity]);

    const getBlob = useCallback(() => audioBlobRef.current, []);

    const recoverInterruptedWebSession = useCallback(async (persisted) => {
        const localSessionId = persisted?.localSessionId;
        if (!localSessionId || !persisted?.activeNoteId) {
            clearPersistedActiveSession();
            return;
        }

        localSessionIdRef.current = localSessionId;
        setSessionSnapshot((prev) => ({
            ...prev,
            activeNoteId: persisted.activeNoteId,
            activeNoteTitle: persisted.activeNoteTitle || 'Recovered recording',
            localSessionId,
            recordingSessionId: persisted.recordingSessionId || null,
            state: 'reconnecting',
            startedAt: null,
            error: null,
        }));

        try {
            const localSession = await serviceRef.current.chunkStore.getSession(localSessionId);
            if (!localSession) throw new Error('Local recording metadata was not found');
            recordingOptionsRef.current = persisted.recordingOptions || localSession.recordingOptions || {};
            let remoteSession = persisted.recordingSessionId || localSession.serverSessionId
                ? { id: persisted.recordingSessionId || localSession.serverSessionId }
                : null;
            if (!remoteSession?.id) {
                remoteSession = await serviceRef.current.apiClient.createRecordingSession({
                    noteId: persisted.activeNoteId,
                    classId: localSession.classId || null,
                    clientSessionId: localSessionId,
                    sessionKind: recordingOptionsRef.current.sessionKind || 'lecture',
                    sourceConfig: localSession.sourceConfig || { microphone: true, tabAudio: false, platform: 'web' },
                    languageConfig: recordingOptionsRef.current.languageConfig || { primary: 'en', secondary: [] },
                });
            }
            serverSessionPromiseRef.current = Promise.resolve(remoteSession);

            const descriptors = await serviceRef.current.chunkStore.listChunks(localSessionId);
            chunkSequenceRef.current = descriptors.reduce(
                (highest, descriptor) => Math.max(highest, Number(descriptor.sequence) + 1),
                Number(localSession.chunkCount || 0),
            );
            uploadedChunkCountRef.current = Number(localSession.uploadedChunkCount || 0);
            for (const descriptor of descriptors) {
                if (descriptor.uploadState === 'verified') {
                    uploadedChunkCountRef.current += 1;
                    await serviceRef.current.chunkStore.deleteVerifiedChunk(localSessionId, descriptor.sequence).catch(() => {});
                    continue;
                }
                const stored = await serviceRef.current.chunkStore.getChunk(localSessionId, descriptor.sequence);
                if (!stored?.blob) continue;
                const uploaded = await serviceRef.current.apiClient.uploadRecordingChunk(
                    remoteSession.id,
                    descriptor,
                    stored.blob,
                );
                await serviceRef.current.chunkStore.markChunkUploaded(localSessionId, descriptor.sequence, {
                    storagePath: uploaded?.storage_path || `${remoteSession.id}/${descriptor.sequence}`,
                });
                await serviceRef.current.chunkStore.deleteVerifiedChunk(localSessionId, descriptor.sequence);
                uploadedChunkCountRef.current += 1;
            }

            const transcriptRows = await serviceRef.current.apiClient.getTranscriptSegments(remoteSession.id).catch(() => []);
            const transcriptSegments = transcriptRows.map((segment) => ({
                id: segment.provider_segment_id,
                text: segment.corrected_text || segment.original_text,
                originalText: segment.original_text,
                correctedText: segment.corrected_text,
                startMs: segment.started_at_ms,
                endMs: segment.ended_at_ms,
                speaker: segment.speaker_key,
                speakerRole: segment.speaker_role,
                confidence: segment.confidence,
                revision: segment.revision,
                isFinal: true,
            }));
            const durationSeconds = Math.max(
                0,
                Math.round(Number(localSession.duration || 0)),
                Math.ceil((descriptors.at(-1)?.endedAtMs || 0) / 1000),
            );
            durationRef.current = durationSeconds;
            await serviceRef.current.apiClient.finalizeRecordingSession(remoteSession.id, {
                durationMs: durationSeconds * 1000,
                chunkCount: chunkSequenceRef.current,
                uploadedCount: uploadedChunkCountRef.current,
            });
            await serviceRef.current.chunkStore.saveSession({
                ...localSession,
                id: localSessionId,
                serverSessionId: remoteSession.id,
                state: 'stopped',
                chunkCount: chunkSequenceRef.current,
                uploadedChunkCount: uploadedChunkCountRef.current,
            });
            clearPersistedActiveSession();
            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'stopped',
                recordingSessionId: remoteSession.id,
                duration: durationSeconds,
                chunkCount: chunkSequenceRef.current,
                uploadedChunkCount: uploadedChunkCountRef.current,
                transcriptSegments,
                transcriptState: transcriptSegments.length ? 'ready' : 'offline',
                error: null,
            }));
        } catch {
            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'error',
                error: 'recovery_failed',
            }));
        }
    }, [setSessionSnapshot]);

    const reconcileNativeSession = useCallback(async (persisted = readPersistedActiveSession()) => {
        if (!persisted?.activeNoteId) {
            return;
        }

        try {
            const status = await serviceRef.current.nativeRecorder.getStatus();
            const isStillRecording = status?.state === 'recording' || status?.state === 'paused';
            const recoveredLocalSessionId = persisted.localSessionId || status?.sessionId || null;
            if (recoveredLocalSessionId) {
                localSessionIdRef.current = recoveredLocalSessionId;
                const localSession = await serviceRef.current.chunkStore.getSession(recoveredLocalSessionId).catch(() => null);
                recordingOptionsRef.current = persisted.recordingOptions || localSession?.recordingOptions || {};
                let remoteSession = persisted.recordingSessionId || localSession?.serverSessionId
                    ? { id: persisted.recordingSessionId || localSession.serverSessionId }
                    : null;
                if (!remoteSession?.id) {
                    remoteSession = await serviceRef.current.apiClient.createRecordingSession({
                        noteId: persisted.activeNoteId,
                        classId: localSession?.classId || null,
                        clientSessionId: recoveredLocalSessionId,
                        sessionKind: recordingOptionsRef.current.sessionKind || 'lecture',
                        sourceConfig: localSession?.sourceConfig || { microphone: true, tabAudio: false, platform: 'ios' },
                        languageConfig: recordingOptionsRef.current.languageConfig || { primary: 'en', secondary: [] },
                    });
                }
                serverSessionPromiseRef.current = Promise.resolve(remoteSession);
                setSessionSnapshot((prev) => ({ ...prev, recordingSessionId: remoteSession.id }));
                await serviceRef.current.chunkStore.saveSession({
                    ...(localSession || {}),
                    id: recoveredLocalSessionId,
                    noteId: persisted.activeNoteId,
                    serverSessionId: remoteSession.id,
                }).catch(() => {});
                initializeTranscriptionPipeline(recordingOptionsRef.current);
                await serviceRef.current.nativeRecorder.recover({
                    sessionId: recoveredLocalSessionId,
                    onChunk: (chunk) => handleWebChunk(
                        chunk.blob,
                        chunk.mimeType || 'application/octet-stream',
                        'microphone',
                        chunk,
                    ),
                    onInterruption: () => {},
                });
            }

            if (!isStillRecording) {
                // Attempt to recover partial audio before giving up — the native
                // AVAudioRecorder may have written data to disk even after an
                // interruption (phone call, Siri) that stopped the session.
                try {
                    const result = await serviceRef.current.nativeRecorder.stop();
                    if (result?.chunkCount > 0 || capturedByteCountRef.current > 0) {
                        audioBlobRef.current = null;
                        void stopLiveActivity({
                            activeNoteId: persisted.activeNoteId,
                            activeNoteTitle: persisted.activeNoteTitle || 'Untitled',
                            startedAt: persisted.startedAt || Date.now(),
                        });
                        durationRef.current = Math.max(durationRef.current, chunkSequenceRef.current * 5);
                        setSessionSnapshot((prev) => ({
                            ...prev,
                            activeNoteId: persisted.activeNoteId,
                            activeNoteTitle: persisted.activeNoteTitle || 'Untitled',
                            state: 'uploading',
                            duration: Math.max(prev.duration || 0, durationRef.current),
                            startedAt: null,
                            error: null,
                        }));
                        await finalizeStoppedSession();
                        return;
                    }
                } catch {
                    // No recoverable audio — fall through to idle reset below.
                }

                clearPersistedActiveSession();
                void stopLiveActivity({
                    activeNoteId: persisted.activeNoteId,
                    activeNoteTitle: persisted.activeNoteTitle || 'Untitled',
                    startedAt: persisted.startedAt || Date.now(),
                });
                if (sessionRef.current.state === 'recording') {
                    stopDurationTimer();
                    setSessionSnapshot((prev) => ({
                        ...prev,
                        state: 'idle',
                        duration: 0,
                        startedAt: null,
                        error: null,
                    }));
                }
                return;
            }

            const startedAt = persisted.startedAt || Date.now();
            const nextSnapshot = {
                ...sessionRef.current,
                activeNoteId: persisted.activeNoteId,
                activeNoteTitle: persisted.activeNoteTitle || sessionRef.current.activeNoteTitle || 'Untitled',
                state: status?.state === 'paused' ? 'paused' : 'recording',
                startedAt,
                error: null,
                localSessionId: recoveredLocalSessionId,
                recordingSessionId: persisted.recordingSessionId || null,
                chunkCount: chunkSequenceRef.current,
                uploadedChunkCount: uploadedChunkCountRef.current,
            };

            sessionRef.current = nextSnapshot;
            setSession(nextSnapshot);
            persistRecordingState(nextSnapshot);
            void updateLiveActivity(nextSnapshot.activeNoteId, nextSnapshot.activeNoteTitle, startedAt);
            if (nextSnapshot.state === 'recording') startDurationTicker(startedAt);
        } catch {
            clearPersistedActiveSession();
        }
    }, [finalizeStoppedSession, handleWebChunk, initializeTranscriptionPipeline, persistRecordingState, setSession, setSessionSnapshot, startDurationTicker, stopDurationTimer, stopLiveActivity, updateLiveActivity]);

    useEffect(() => {
        const persisted = readPersistedActiveSession();
        if (!persisted) return;

        if (isNative) {
            void reconcileNativeSession(persisted);
            return;
        }

        void recoverInterruptedWebSession(persisted);
    }, [isNative, reconcileNativeSession, recoverInterruptedWebSession]);

    useEffect(() => {
        if (!isNative) return undefined;

        const listener = App.addListener('appStateChange', ({ isActive }) => {
            if (isActive) {
                void reconcileNativeSession();
                return;
            }

            persistRecordingState();
        });

        return () => {
            listener.then((subscription) => subscription.remove());
        };
    }, [isNative, persistRecordingState, reconcileNativeSession]);

    useEffect(() => {
        return () => {
            stopDurationTimer();
            releaseWebMediaResources();
        };
    }, [releaseWebMediaResources, stopDurationTimer]);

    const value = useMemo(() => ({
        ...session,
        start,
        stop,
        reset,
        getBlob,
        setProcessingState,
        setAudioPath,
        syncNoteContext,
        pause,
        resume,
        continueRecording,
    }), [
        getBlob,
        reset,
        session,
        setAudioPath,
        setProcessingState,
        start,
        stop,
        syncNoteContext,
        pause,
        resume,
        continueRecording,
    ]);

    return (
        <RecordingSessionContext.Provider value={value}>
            {children}
        </RecordingSessionContext.Provider>
    );
}
