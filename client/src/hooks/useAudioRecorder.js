import { useState, useRef, useCallback, useEffect } from 'react';
import { openDB } from 'idb';
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
        for (let i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
    }
    return new Blob(byteArrays, { type: contentType });
}

async function storeChunks(noteId, chunks) {
    const db = await getAudioDB();
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
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
    const liveActivityIdRef = useRef(null);
    const durationRef = useRef(0);
    const isRecordingRef = useRef(false);

    const isNative = Capacitor.isNativePlatform();

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

    const updateLiveActivity = useCallback(async (seconds) => {
        if (isNative && liveActivityIdRef.current) {
            try {
                await LiveActivity.update({
                    activityId: liveActivityIdRef.current,
                    contentState: { duration: seconds }
                });
            } catch (err) {
                console.log('Failed to update live activity', err);
            }
        }
    }, [isNative]);

    const startLiveActivity = useCallback(async () => {
        if (!isNative) return null;
        try {
            const { activityId } = await LiveActivity.start({
                attributes: { type: 'audioRecording', title: 'Recording Note' },
                contentState: { duration: 0 }
            });
            return activityId;
        } catch (err) {
            console.log('Failed to start live activity', err);
            return null;
        }
    }, [isNative]);

    const stopLiveActivity = useCallback(async () => {
        if (!isNative || !liveActivityIdRef.current) return;
        try {
            await LiveActivity.stop({
                activityId: liveActivityIdRef.current,
                finalContentState: { duration: durationRef.current }
            });
            liveActivityIdRef.current = null;
        } catch (err) {
            console.log('Failed to stop live activity', err);
        }
    }, [isNative]);

    const startWeb = async () => {
        if (!navigator.mediaDevices?.getUserMedia) {
            setState('error');
            setError('not_supported');
            return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mimeType = MediaRecorder.isTypeSupported(MIME_TYPE) ? MIME_TYPE : FALLBACK_MIME;
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = () => {
            const blob = new Blob(chunksRef.current, { type: mimeType });
            audioBlobRef.current = blob;
            cleanup();

            if (blob.size < 1000) {
                setState('idle');
                setError('no_audio');
                return;
            }

            setState('stopped');
            clearStoredChunks(noteId).catch(() => {});
            setHasRecoveryData(false);
        };

        recorder.onerror = () => {
            cleanup();
            setState('error');
            setError('recording_failed');
        };

        recorder.start(CHUNK_INTERVAL_MS);
    };

    const startNative = async () => {
        const canRecord = await VoiceRecorder.hasAudioRecordingPermission();
        if (!canRecord.value) {
            const request = await VoiceRecorder.requestAudioRecordingPermission();
            if (!request.value) {
                throw new Error('PermissionDeniedError');
            }
        }
        await VoiceRecorder.startRecording();
    };

    const start = useCallback(async () => {
        if (state === 'recording') return;

        setState('requesting_permission');
        setError(null);
        setDuration(0);
        durationRef.current = 0;
        chunksRef.current = [];
        audioBlobRef.current = null;

        try {
            if (isNative) {
                await startNative();
            } else {
                await startWeb();
            }

            setState('recording');
            liveActivityIdRef.current = await startLiveActivity();

            const startTime = Date.now();
            durationTimerRef.current = setInterval(() => {
                const secs = Math.floor((Date.now() - startTime) / 1000);
                setDuration(secs);
                durationRef.current = secs;
                updateLiveActivity(secs);
            }, 1000);

            if (!isNative) {
                flushTimerRef.current = setInterval(() => {
                    if (chunksRef.current.length > 0) {
                        storeChunks(noteId, chunksRef.current).catch(() => {});
                    }
                }, FLUSH_INTERVAL_MS);
            }
        } catch (err) {
            cleanup();
            stopLiveActivity();
            setState('error');
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError' || err.message === 'PermissionDeniedError') {
                setError('permission_denied');
            } else {
                setError('recording_failed');
            }
        }
    }, [state, noteId, cleanup, isNative, startLiveActivity, updateLiveActivity, stopLiveActivity]);

    const stopWeb = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    const stopNative = async () => {
        try {
            const result = await VoiceRecorder.stopRecording();
            cleanup();
            stopLiveActivity();
            
            if (result.value && result.value.recordDataBase64) {
                const blob = b64toBlob(result.value.recordDataBase64, result.value.mimeType);
                audioBlobRef.current = blob;
                setState('stopped');
                setHasRecoveryData(false);
            } else {
                setState('idle');
                setError('no_audio');
            }
        } catch (err) {
            cleanup();
            stopLiveActivity();
            setState('error');
            setError('recording_failed');
        }
    };

    const stop = useCallback(() => {
        if (isNative) {
            stopNative();
        } else {
            stopWeb();
        }
    }, [isNative, stopWeb, stopLiveActivity, cleanup]);

    const getBlob = useCallback(() => audioBlobRef.current, []);

    const setProcessingState = useCallback((newState) => {
        if (['uploading', 'processing', 'complete', 'error'].includes(newState)) {
            setState(newState);
        }
    }, []);

    const reset = useCallback(() => {
        cleanup();
        stopLiveActivity();
        setState('idle');
        setDuration(0);
        setError(null);
        chunksRef.current = [];
        audioBlobRef.current = null;
    }, [cleanup, stopLiveActivity]);

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

    useEffect(() => {
        isRecordingRef.current = state === 'recording';
    }, [state]);

    useEffect(() => {
        return () => {
            if (!isNative && mediaRecorderRef.current?.state === 'recording' && chunksRef.current.length > 0) {
                storeChunks(noteId, chunksRef.current).catch(() => {});
            }
            if (isNative && isRecordingRef.current) {
                VoiceRecorder.stopRecording().catch(() => {});
            }
            cleanup();
        };
    }, [noteId, cleanup, isNative]);

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
