import { useCallback, useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RecordingSessionContext } from '../context/RecordingSessionContext.jsx';

function useRecordingSession(options = {}) {
    const context = useContext(RecordingSessionContext);
    const navigate = useNavigate();

    if (!context) {
        throw new Error('useRecordingSession must be used within a RecordingSessionProvider');
    }

    const noteId = typeof options === 'string' ? options : options.noteId || null;
    const noteTitle = typeof options === 'object' ? options.noteTitle : null;
    const isActiveNote = Boolean(noteId) && context.activeNoteId === noteId;
    const isAnotherNoteRecording = Boolean(noteId)
        && context.state === 'recording'
        && Boolean(context.activeNoteId)
        && context.activeNoteId !== noteId;

    useEffect(() => {
        if (!noteId) return;
        void context.syncNoteContext(noteId, noteTitle || 'Untitled');
    }, [context, noteId, noteTitle]);

    const goToActiveNote = useCallback(() => {
        if (context.activeNoteId) {
            navigate(`/note/${context.activeNoteId}`);
        }
    }, [context.activeNoteId, navigate]);

    const start = useCallback((targetNoteId = noteId, targetNoteTitle = noteTitle, startOptions = {}) => (
        context.start(targetNoteId, targetNoteTitle || 'Untitled', startOptions)
    ), [context, noteId, noteTitle]);

    const getBlob = useCallback(() => {
        if (noteId && !isActiveNote) {
            return null;
        }

        return context.getBlob();
    }, [context, isActiveNote, noteId]);

    const scopedState = noteId && !isActiveNote ? 'idle' : context.state;
    const scopedDuration = noteId && !isActiveNote ? 0 : context.duration;
    const scopedError = noteId && !isActiveNote ? null : context.error;
    const scopedStartedAt = noteId && !isActiveNote ? null : context.startedAt;
    const scopedAudioPath = noteId && !isActiveNote ? null : context.audioPath;

    return useMemo(() => ({
        ...context,
        state: scopedState,
        duration: scopedDuration,
        error: scopedError,
        startedAt: scopedStartedAt,
        audioPath: scopedAudioPath,
        isActiveNote,
        isAnotherNoteRecording,
        start,
        getBlob,
        goToActiveNote,
        globalState: context.state,
    }), [
        context,
        getBlob,
        goToActiveNote,
        isActiveNote,
        isAnotherNoteRecording,
        scopedAudioPath,
        scopedDuration,
        scopedError,
        scopedStartedAt,
        scopedState,
        start,
    ]);
}

export default useRecordingSession;
