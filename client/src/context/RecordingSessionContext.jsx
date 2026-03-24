import { createContext, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { openDB } from 'idb';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { LiveActivity } from 'capacitor-live-activity';

const AUDIO_DB_NAME = 'riven-audio';
const AUDIO_DB_VERSION = 1;
const CHUNKS_STORE = 'audioChunks';
const FLUSH_INTERVAL_MS = 5 * 60 * 1000;
const CHUNK_INTERVAL_MS = 10_000;
const MIME_TYPE = 'audio/webm;codecs=opus';
const FALLBACK_MIME = 'audio/webm';
const ACTIVE_SESSION_STORAGE_KEY = 'riven-active-recording-session';
const LIVE_ACTIVITY_ID = 'active-note-recording';
const LIVE_ACTIVITY_STATUS = 'Recording note';

const INITIAL_SESSION = {
    activeNoteId: null,
    activeNoteTitle: '',
    state: 'idle',
    duration: 0,
    startedAt: null,
    error: null,
    hasRecoveryData: false,
    recoveryNoteId: null,
    audioPath: null,
};

export const RecordingSessionContext = createContext(null);

function getAudioDB() {
    return openDB(AUDIO_DB_NAME, AUDIO_DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
                db.createObjectStore(CHUNKS_STORE, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
}

function b64toBlob(b64Data, contentType = '', sliceSize = 512) {
    const byteCharacters = atob(b64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
        const slice = byteCharacters.slice(offset, offset + sliceSize);
        const byteNumbers = new Array(slice.length);

        for (let index = 0; index < slice.length; index += 1) {
            byteNumbers[index] = slice.charCodeAt(index);
        }

        byteArrays.push(new Uint8Array(byteNumbers));
    }

    return new Blob(byteArrays, { type: contentType });
}

async function storeChunks(noteId, chunks) {
    if (!noteId) return;

    const db = await getAudioDB();
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    const all = await tx.store.getAll();

    for (const entry of all) {
        if (entry.noteId === noteId) {
            await tx.store.delete(entry.id);
        }
    }

    for (const chunk of chunks) {
        await tx.store.add({ noteId, blob: chunk, timestamp: Date.now() });
    }

    await tx.done;
}

async function getStoredChunks(noteId) {
    if (!noteId) return [];
    const db = await getAudioDB();
    const all = await db.getAll(CHUNKS_STORE);
    return all.filter((entry) => entry.noteId === noteId);
}

async function clearStoredChunks(noteId) {
    if (!noteId) return;

    const db = await getAudioDB();
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    const all = await tx.store.getAll();

    for (const entry of all) {
        if (entry.noteId === noteId) {
            await tx.store.delete(entry.id);
        }
    }

    await tx.done;
}

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

export function RecordingSessionProvider({ children }) {
    const [session, setSession] = useState(INITIAL_SESSION);
    const sessionRef = useRef(INITIAL_SESSION);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const audioBlobRef = useRef(null);
    const durationTimerRef = useRef(null);
    const flushTimerRef = useRef(null);
    const liveActivityAvailableRef = useRef(null);
    const durationRef = useRef(0);
    const recoveryLookupRef = useRef(0);

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

    const stopFlushTimer = useCallback(() => {
        if (flushTimerRef.current) {
            window.clearInterval(flushTimerRef.current);
            flushTimerRef.current = null;
        }
    }, []);

    const releaseWebMediaResources = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
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
        },
        contentState: {
            noteTitle: noteTitle || 'Untitled',
            status: LIVE_ACTIVITY_STATUS,
            startedAt: String(Math.floor(startedAt / 1000)),
        },
    }), []);

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
        if (snapshot.state === 'recording' && snapshot.activeNoteId) {
            persistActiveSessionSnapshot({
                activeNoteId: snapshot.activeNoteId,
                activeNoteTitle: snapshot.activeNoteTitle,
                startedAt: snapshot.startedAt,
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
    }, [setSessionSnapshot, updateLiveActivity]);

    const startDurationTicker = useCallback((startedAt) => {
        stopDurationTimer();

        const tick = () => {
            const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
            updateDuration(elapsedSeconds, startedAt);
        };

        tick();
        durationTimerRef.current = window.setInterval(tick, 1000);
    }, [stopDurationTimer, updateDuration]);

    const resetInMemorySession = useCallback((updater = null) => {
        audioBlobRef.current = null;
        chunksRef.current = [];
        durationRef.current = 0;
        stopDurationTimer();
        stopFlushTimer();
        clearPersistedActiveSession();

        setSessionSnapshot((prev) => {
            const base = {
                ...INITIAL_SESSION,
                recoveryNoteId: prev.recoveryNoteId,
                hasRecoveryData: prev.hasRecoveryData,
            };

            return typeof updater === 'function' ? updater(base, prev) : base;
        });
    }, [setSessionSnapshot, stopDurationTimer, stopFlushTimer]);

    const hydrateRecoveryState = useCallback(async (noteId) => {
        if (!noteId) return;

        const lookupId = recoveryLookupRef.current + 1;
        recoveryLookupRef.current = lookupId;

        try {
            const storedChunks = await getStoredChunks(noteId);
            if (recoveryLookupRef.current !== lookupId) {
                return;
            }

            const hasRecoveryForNote = storedChunks.length > 0
                && !(sessionRef.current.state === 'recording' && sessionRef.current.activeNoteId === noteId);

            setSessionSnapshot((prev) => {
                const nextRecoveryNoteId = hasRecoveryForNote
                    ? noteId
                    : prev.recoveryNoteId === noteId
                        ? null
                        : prev.recoveryNoteId;
                const nextHasRecoveryData = hasRecoveryForNote
                    ? true
                    : prev.recoveryNoteId === noteId
                        ? false
                        : prev.hasRecoveryData;

                if (prev.recoveryNoteId === nextRecoveryNoteId && prev.hasRecoveryData === nextHasRecoveryData) {
                    return prev;
                }

                return {
                    ...prev,
                    recoveryNoteId: nextRecoveryNoteId,
                    hasRecoveryData: nextHasRecoveryData,
                };
            });
        } catch {
            // Ignore IndexedDB read failures.
        }
    }, [setSessionSnapshot]);

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

        await hydrateRecoveryState(noteId);
    }, [hydrateRecoveryState, persistRecordingState, setSession, updateLiveActivity]);

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

    const finalizeStoppedSession = useCallback((noteId) => {
        stopDurationTimer();
        stopFlushTimer();
        clearPersistedActiveSession();

        setSessionSnapshot((prev) => ({
            ...prev,
            state: 'stopped',
            startedAt: null,
            error: null,
            hasRecoveryData: prev.recoveryNoteId === noteId ? false : prev.hasRecoveryData,
            recoveryNoteId: prev.recoveryNoteId === noteId ? null : prev.recoveryNoteId,
            audioPath: null,
        }));
    }, [setSessionSnapshot, stopDurationTimer, stopFlushTimer]);

    const startWeb = useCallback(async (noteId) => {
        if (!navigator.mediaDevices?.getUserMedia) {
            const error = new Error('NotSupportedError');
            error.code = 'NOT_SUPPORTED';
            throw error;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : FALLBACK_MIME;
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunksRef.current.push(event.data);
            }
        };

        recorder.onerror = () => {
            releaseWebMediaResources();
            stopDurationTimer();
            stopFlushTimer();
            clearPersistedActiveSession();

            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'error',
                startedAt: null,
                error: 'recording_failed',
            }));
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            audioBlobRef.current = blob;
            releaseWebMediaResources();
            stopDurationTimer();
            stopFlushTimer();
            clearPersistedActiveSession();

            if (blob.size < 1000) {
                setSessionSnapshot((prev) => ({
                    ...prev,
                    state: 'idle',
                    startedAt: null,
                    error: 'no_audio',
                }));
                return;
            }

            finalizeStoppedSession(noteId);
            clearStoredChunks(noteId).catch(() => {});
        };

        recorder.start(CHUNK_INTERVAL_MS);
    }, [finalizeStoppedSession, releaseWebMediaResources, setSessionSnapshot, stopDurationTimer, stopFlushTimer]);

    const startNative = useCallback(async () => {
        const permission = await VoiceRecorder.hasAudioRecordingPermission();
        if (!permission.value) {
            const request = await VoiceRecorder.requestAudioRecordingPermission();
            if (!request.value) {
                throw new Error('PermissionDeniedError');
            }
        }

        await VoiceRecorder.startRecording();
    }, []);

    const start = useCallback(async (noteId, noteTitle = 'Untitled') => {
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
        durationRef.current = 0;
        stopDurationTimer();
        stopFlushTimer();
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
            hasRecoveryData: prev.recoveryNoteId === noteId ? false : prev.hasRecoveryData,
            recoveryNoteId: prev.recoveryNoteId === noteId ? null : prev.recoveryNoteId,
        }));

        try {
            if (isNative) {
                await startNative();
            } else {
                await startWeb(noteId);
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
            await startLiveActivity(nextSnapshot.activeNoteId, nextSnapshot.activeNoteTitle, startedAt);
            startDurationTicker(startedAt);
        } catch (error) {
            releaseWebMediaResources();
            stopDurationTimer();
            stopFlushTimer();
            clearPersistedActiveSession();
            await stopLiveActivity();

            setSessionSnapshot((prev) => ({
                ...prev,
                state: 'error',
                startedAt: null,
                duration: 0,
                error: error?.name === 'NotAllowedError'
                    || error?.name === 'PermissionDeniedError'
                    || error?.message === 'PermissionDeniedError'
                    ? 'permission_denied'
                    : 'recording_failed',
            }));
        }
    }, [
        isNative,
        persistRecordingState,
        releaseWebMediaResources,
        setSession,
        setSessionSnapshot,
        startDurationTicker,
        startLiveActivity,
        startNative,
        startWeb,
        stopDurationTimer,
        stopFlushTimer,
        stopLiveActivity,
    ]);

    const stopNative = useCallback(async () => {
        try {
            const result = await VoiceRecorder.stopRecording();
            await stopLiveActivity();

            if (result.value && result.value.recordDataBase64) {
                audioBlobRef.current = b64toBlob(result.value.recordDataBase64, result.value.mimeType);
                finalizeStoppedSession(sessionRef.current.activeNoteId);
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
        if (sessionRef.current.state !== 'recording') {
            return;
        }

        clearPersistedActiveSession();

        if (isNative) {
            void stopNative();
            return;
        }

        if (mediaRecorderRef.current?.state === 'recording') {
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
        stopFlushTimer();

        setSessionSnapshot((prev) => ({
            ...prev,
            state: newState,
            startedAt: null,
            error: newState === 'error' ? prev.error || 'recording_failed' : null,
        }));
    }, [setSessionSnapshot, stopDurationTimer, stopFlushTimer]);

    const reset = useCallback(() => {
        releaseWebMediaResources();
        void stopLiveActivity();
        resetInMemorySession();
    }, [releaseWebMediaResources, resetInMemorySession, stopLiveActivity]);

    const discardRecovery = useCallback(async (noteId) => {
        await clearStoredChunks(noteId).catch(() => {});

        setSessionSnapshot((prev) => {
            if (prev.recoveryNoteId !== noteId) {
                return prev;
            }

            return {
                ...prev,
                recoveryNoteId: null,
                hasRecoveryData: false,
            };
        });
    }, [setSessionSnapshot]);

    const recover = useCallback(async (noteId, noteTitle = 'Untitled') => {
        const storedChunks = await getStoredChunks(noteId);
        if (storedChunks.length === 0) {
            setSessionSnapshot((prev) => ({
                ...prev,
                recoveryNoteId: prev.recoveryNoteId === noteId ? null : prev.recoveryNoteId,
                hasRecoveryData: prev.recoveryNoteId === noteId ? false : prev.hasRecoveryData,
            }));
            return null;
        }

        audioBlobRef.current = new Blob(storedChunks.map((entry) => entry.blob), { type: FALLBACK_MIME });
        clearStoredChunks(noteId).catch(() => {});

        setSessionSnapshot((prev) => ({
            ...prev,
            activeNoteId: noteId,
            activeNoteTitle: noteTitle || prev.activeNoteTitle || 'Untitled',
            state: 'stopped',
            startedAt: null,
            duration: prev.activeNoteId === noteId ? prev.duration : 0,
            error: null,
            recoveryNoteId: prev.recoveryNoteId === noteId ? null : prev.recoveryNoteId,
            hasRecoveryData: prev.recoveryNoteId === noteId ? false : prev.hasRecoveryData,
            audioPath: null,
        }));

        return audioBlobRef.current;
    }, [setSessionSnapshot]);

    const getBlob = useCallback(() => audioBlobRef.current, []);

    const reconcileNativeSession = useCallback(async (persisted = readPersistedActiveSession()) => {
        if (!persisted?.activeNoteId) {
            return;
        }

        try {
            const status = await VoiceRecorder.getCurrentStatus();
            const isStillRecording = status?.status === 'RECORDING' || status?.status === 'PAUSED';

            if (!isStillRecording) {
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
                state: 'recording',
                startedAt,
                error: null,
            };

            sessionRef.current = nextSnapshot;
            setSession(nextSnapshot);
            persistRecordingState(nextSnapshot);
            void updateLiveActivity(nextSnapshot.activeNoteId, nextSnapshot.activeNoteTitle, startedAt);
            startDurationTicker(startedAt);
        } catch {
            clearPersistedActiveSession();
        }
    }, [persistRecordingState, setSession, setSessionSnapshot, startDurationTicker, stopDurationTimer, stopLiveActivity, updateLiveActivity]);

    useEffect(() => {
        const persisted = readPersistedActiveSession();
        if (!persisted) return;

        if (isNative) {
            void reconcileNativeSession(persisted);
            return;
        }

        clearPersistedActiveSession();
    }, [isNative, reconcileNativeSession]);

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
        if (isNative) return undefined;

        const flushPendingChunks = () => {
            const { activeNoteId, state } = sessionRef.current;
            if (state === 'recording' && activeNoteId && chunksRef.current.length > 0) {
                storeChunks(activeNoteId, chunksRef.current).catch(() => {});
            }
        };

        const reconcileWebRecording = () => {
            const { activeNoteId, state } = sessionRef.current;
            if (state !== 'recording') {
                return;
            }

            if (mediaRecorderRef.current?.state === 'recording') {
                persistRecordingState();
                return;
            }

            clearPersistedActiveSession();

            if (activeNoteId && chunksRef.current.length > 0) {
                storeChunks(activeNoteId, chunksRef.current).catch(() => {});
            }
        };

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                flushPendingChunks();
                return;
            }

            reconcileWebRecording();
        };

        const handlePageHide = () => {
            flushPendingChunks();
            reconcileWebRecording();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('pagehide', handlePageHide);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('pagehide', handlePageHide);
        };
    }, [isNative, persistRecordingState]);

    useEffect(() => {
        return () => {
            if (!isNative && sessionRef.current.activeNoteId && chunksRef.current.length > 0) {
                storeChunks(sessionRef.current.activeNoteId, chunksRef.current).catch(() => {});
            }

            stopDurationTimer();
            stopFlushTimer();
            releaseWebMediaResources();
        };
    }, [isNative, releaseWebMediaResources, stopDurationTimer, stopFlushTimer]);

    useEffect(() => {
        if (isNative) return;
        if (session.state !== 'recording') return;
        if (!session.activeNoteId) return;

        stopFlushTimer();
        flushTimerRef.current = window.setInterval(() => {
            if (chunksRef.current.length > 0) {
                storeChunks(session.activeNoteId, chunksRef.current).catch(() => {});
            }
        }, FLUSH_INTERVAL_MS);

        return stopFlushTimer;
    }, [isNative, session.activeNoteId, session.state, stopFlushTimer]);

    const value = useMemo(() => ({
        ...session,
        start,
        stop,
        reset,
        recover,
        discardRecovery,
        getBlob,
        setProcessingState,
        setAudioPath,
        syncNoteContext,
    }), [
        discardRecovery,
        getBlob,
        recover,
        reset,
        session,
        setAudioPath,
        setProcessingState,
        start,
        stop,
        syncNoteContext,
    ]);

    return (
        <RecordingSessionContext.Provider value={value}>
            {children}
        </RecordingSessionContext.Provider>
    );
}
