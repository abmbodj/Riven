import { describe, it, expect, vi, beforeEach } from 'vitest';

// Regression guard for the "defined in authApi but forgotten in the api.js
// wrapper" bug class. `createNoteAudioSignedUrl` existed in api/authApi.js and
// was called as `api.createNoteAudioSignedUrl(...)` in NoteEditor, but was never
// added to the `api` wrapper object — so it was `undefined`, and opening any
// note with retained audio threw "api.createNoteAudioSignedUrl is not a function"
// straight into the global ErrorBoundary.
vi.mock('./api/authApi', () => ({
    getToken: vi.fn(() => 'fake-token'),
    createNoteAudioSignedUrl: vi.fn(async () => 'https://signed.example/audio.webm'),
}));

import { api } from './api';
import * as serverApi from './api/authApi';

describe('api.js notes-audio wrapper', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        serverApi.getToken.mockReturnValue('fake-token');
    });

    it('exposes createNoteAudioSignedUrl as a function', () => {
        expect(typeof api.createNoteAudioSignedUrl).toBe('function');
    });

    it('delegates to the server API (with both args) when logged in', async () => {
        serverApi.createNoteAudioSignedUrl.mockResolvedValue('https://signed.example/x.webm');

        const result = await api.createNoteAudioSignedUrl('notes/123/audio.webm', 3600);

        expect(serverApi.createNoteAudioSignedUrl).toHaveBeenCalledWith('notes/123/audio.webm', 3600);
        expect(result).toBe('https://signed.example/x.webm');
    });

    it('resolves null without calling the server API when logged out', async () => {
        serverApi.getToken.mockReturnValue(null);

        const result = await api.createNoteAudioSignedUrl('notes/123/audio.webm');

        expect(result).toBeNull();
        expect(serverApi.createNoteAudioSignedUrl).not.toHaveBeenCalled();
    });
});
