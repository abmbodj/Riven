import useRecordingSession from './useRecordingSession.js';

export default function useAudioRecorder(noteId) {
    return useRecordingSession({ noteId });
}
