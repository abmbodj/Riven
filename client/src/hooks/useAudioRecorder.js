import { useState, useRef, useCallback, useEffect } from 'react';
import { openDB } from 'idb';

const AUDIO_DB_NAME = 'riven-audio';
const AUDIO_DB_VERSION = 1;
const CHUNKS_STORE = 'audioChunks';
const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const CHUNK_INTERVAL_MS = 10_000; // 10 seconds
const MIME_TYPE = 'audio/webm;codecs=opus';
const FALLBACK_MIME = 'audio/webm';

function getAudioDB() {
    return openDB(AUDIO_DB_NAME, AUDIO_DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
                db.createObjectStore(CHUNKS_STORE, { keyPath: 'id', autoIncrement: true });
            }
        },
    });
}

async function storeChunks(noteId, chunks) {
    const db = await getAudioDB();
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    // Clear previous chunks for this note before storing new batch
    const all = await tx.store.getAll();
    for (const entry of all) {
        if (entry.noteId === noteId) await tx.store.delete(entry.id);
    }
    for (const chunk of chunks) {
        await tx.store.add({ noteId, blob: chunk, timestamp: Date.now() });
    }
    await tx.done;
}

async function getStoredChunks(noteId) {
    const db = await getAudioDB();
    const all = await db.getAll(CHUNKS_STORE);
    return all.filter(entry => entry.noteId === noteId);
}

async function clearStoredChunks(noteId) {
    const db = await getAudioDB();
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    const all = await tx.store.getAll();
    for (const entry of all) {
        if (entry.noteId === noteId) await tx.store.delete(entry.id);
    }
    await tx.done;
}

/**
 * States: idle | requesting_permission | recording | stopped | uploading | processing | complete | error
 */
export default function useAudioRecorder(noteId) {
    const [state, setState] = useState('idle');
    const [duration, setDuration] = useState(0);
    const [error, setError] = useState(null);
    const [hasRecoveryData, setHasRecoveryData] = useState(false);

    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const durationTimerRef = useRef(null);
    const flushTimerRef = useRef(null);
    const audioBlobRef = useRef(null);

    // Check for orphaned chunks on mount
    useEffect(() => {
        if (!noteId) return;
        getStoredChunks(noteId).then(stored => {
            if (stored.length > 0) setHasRecoveryData(true);
        }).catch(() => {});
    }, [noteId]);

    const cleanup = useCallback(() => {
        if (durationTimerRef.current) {
            clearInterval(durationTimerRef.current);
            durationTimerRef.current = null;
        }
        if (flushTimerRef.current) {
            clearInterval(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }
        mediaRecorderRef.current = null;
    }, []);

    const start = useCallback(async () => {
        if (state === 'recording') return;

        setState('requesting_permission');
        setError(null);
        setDuration(0);
        chunksRef.current = [];
        audioBlobRef.current = null;

        if (!navigator.mediaDevices?.getUserMedia) {
            setState('error');
            setError('not_supported');
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : FALLBACK_MIME;
            const recorder = new MediaRecorder(stream, {
                mimeType,
                audioBitsPerSecond: 32000,
            });
            mediaRecorderRef.current = recorder;

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data);
            };

            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, { type: mimeType });
                audioBlobRef.current = blob;
                cleanup();

                if (blob.size < 1000) {
                    // Essentially empty recording
                    setState('idle');
                    setError('no_audio');
                    return;
                }

                setState('stopped');
                // Clear recovery data since we have a complete recording
                clearStoredChunks(noteId).catch(() => {});
                setHasRecoveryData(false);
            };

            recorder.onerror = () => {
                cleanup();
                setState('error');
                setError('recording_failed');
            };

            recorder.start(CHUNK_INTERVAL_MS);
            setState('recording');

            // Duration counter
            const startTime = Date.now();
            durationTimerRef.current = setInterval(() => {
                setDuration(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);

            // Periodic flush to IndexedDB for crash recovery
            flushTimerRef.current = setInterval(() => {
                if (chunksRef.current.length > 0) {
                    storeChunks(noteId, chunksRef.current).catch(() => {});
                }
            }, FLUSH_INTERVAL_MS);
        } catch (err) {
            cleanup();
            setState('error');
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                setError('permission_denied');
            } else {
                setError('recording_failed');
            }
        }
    }, [state, noteId, cleanup]);

    const stop = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    }, []);

    const getBlob = useCallback(() => audioBlobRef.current, []);

    const setProcessingState = useCallback((newState) => {
        if (['uploading', 'processing', 'complete', 'error'].includes(newState)) {
            setState(newState);
        }
    }, []);

    const reset = useCallback(() => {
        cleanup();
        setState('idle');
        setDuration(0);
        setError(null);
        chunksRef.current = [];
        audioBlobRef.current = null;
    }, [cleanup]);

    const discardRecovery = useCallback(async () => {
        await clearStoredChunks(noteId).catch(() => {});
        setHasRecoveryData(false);
    }, [noteId]);

    const recoverAudio = useCallback(async () => {
        const stored = await getStoredChunks(noteId);
        if (stored.length === 0) {
            setHasRecoveryData(false);
            return null;
        }
        const blob = new Blob(stored.map(s => s.blob), { type: FALLBACK_MIME });
        audioBlobRef.current = blob;
        setHasRecoveryData(false);
        setState('stopped');
        return blob;
    }, [noteId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Flush chunks to IndexedDB if recording is in progress
            if (mediaRecorderRef.current?.state === 'recording' && chunksRef.current.length > 0) {
                storeChunks(noteId, chunksRef.current).catch(() => {});
            }
            cleanup();
        };
    }, [noteId, cleanup]);

    return {
        state,
        duration,
        error,
        hasRecoveryData,
        start,
        stop,
        getBlob,
        setProcessingState,
        reset,
        discardRecovery,
        recoverAudio,
    };
}
