/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    storage: { from: vi.fn() },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

const jsonResponse = (body) => ({
  ok: true,
  status: 200,
  headers: { get: () => 'application/json' },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

const encodeJwtPart = (value) => btoa(JSON.stringify(value))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
const supabaseToken = [
  encodeJwtPart({ alg: 'HS256', typ: 'JWT' }),
  encodeJwtPart({ aud: 'authenticated', sub: 'auth-user', exp: 4102444800 }),
  'signature',
].join('.');

const createInsertChain = (data) => {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert, select, single };
};

describe('authApi classroom audio notes v2', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://supabase.test');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    vi.stubEnv('VITE_API_URL', '');
    supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
    authApi.setToken('legacy-token');
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse({ id: 42, email: 'student@example.com' }));
  });

  it('creates a durable recording session with the classroom configuration', async () => {
    const chain = createInsertChain({ id: 'session-1', state: 'preflight' });
    const upsert = vi.fn().mockReturnValue({ select: chain.select });
    supabase.from.mockReturnValue({ upsert });

    const result = await authApi.createRecordingSession({
      noteId: 'note-1',
      classId: 'class-1',
      clientSessionId: 'device-session-1',
      sessionKind: 'problem_solving',
      sourceConfig: { microphone: true, tabAudio: false },
      languageConfig: { primary: 'en', secondary: ['es'] },
    });

    expect(supabase.from).toHaveBeenCalledWith('recording_sessions');
    expect(upsert).toHaveBeenCalledWith({
      user_id: 42,
      note_id: 'note-1',
      class_id: 'class-1',
      client_session_id: 'device-session-1',
      session_kind: 'problem_solving',
      source_config: { microphone: true, tabAudio: false },
      language_config: { primary: 'en', secondary: ['es'] },
    }, { onConflict: 'user_id,client_session_id' });
    expect(result).toEqual({ id: 'session-1', state: 'preflight' });
  });

  it('uploads a chunk before recording its verified manifest row', async () => {
    const storageUpload = vi.fn().mockResolvedValue({ error: null });
    supabase.storage.from.mockReturnValue({ upload: storageUpload });
    const chain = createInsertChain({ id: 'chunk-1', upload_state: 'verified' });
    const upsert = vi.fn().mockReturnValue({ select: chain.select });
    supabase.from.mockReturnValue({ upsert });
    const blob = new Blob(['audio'], { type: 'audio/webm' });

    const result = await authApi.uploadRecordingChunk('session-1', {
      sequence: 3,
      startedAtMs: 15000,
      endedAtMs: 20000,
      durationMs: 5000,
      source: 'mixed',
      checksum: 'abc123',
      mimeType: 'audio/webm',
      byteSize: blob.size,
    }, blob);

    expect(supabase.storage.from).toHaveBeenCalledWith('recording-chunks');
    expect(storageUpload).toHaveBeenCalledWith('42/session-1/3.webm', blob, {
      contentType: 'audio/webm',
      upsert: true,
    });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      session_id: 'session-1',
      sequence: 3,
      storage_path: '42/session-1/3.webm',
      upload_state: 'verified',
    }), { onConflict: 'session_id,sequence' });
    expect(result).toEqual({ id: 'chunk-1', upload_state: 'verified' });
  });

  it('uploads a timestamped class source and records its evidence metadata', async () => {
    const storageUpload = vi.fn().mockResolvedValue({ error: null });
    supabase.storage.from.mockReturnValue({ upload: storageUpload });
    const chain = createInsertChain({ id: 'asset-1', asset_kind: 'slide_pdf' });
    const existingEq = vi.fn().mockResolvedValue({ data: [{ byte_size: 1024 }], error: null });
    const existingSelect = vi.fn().mockReturnValue({ eq: existingEq });
    supabase.from.mockImplementation((table) => (
      table === 'recording_assets' && existingSelect.mock.calls.length === 0
        ? { select: existingSelect }
        : chain
    ));
    const file = new File(['slide text'], 'Week 3 Slides.pdf', { type: 'application/pdf' });

    const result = await authApi.uploadRecordingAsset('session-1', file, {
      capturedAtMs: 125000,
      extractedText: 'Cellular respiration overview',
    });

    expect(supabase.storage.from).toHaveBeenCalledWith('note-assets');
    expect(storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^42\/session-1\/.+\.pdf$/),
      file,
      { contentType: 'application/pdf', upsert: false },
    );
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      session_id: 'session-1',
      asset_kind: 'slide_pdf',
      captured_at_ms: 125000,
      extracted_text: 'Cellular respiration overview',
      accessible_label: 'Week 3 Slides.pdf',
    }));
    expect(result).toEqual({ id: 'asset-1', asset_kind: 'slide_pdf' });
  });

  it('enforces the 50 MB aggregate source limit before uploading', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ byte_size: 49 * 1024 * 1024 }],
      error: null,
    });
    supabase.from.mockReturnValue({ select: vi.fn().mockReturnValue({ eq }) });
    const file = new File([new Uint8Array(2 * 1024 * 1024)], 'large-deck.pdf', { type: 'application/pdf' });

    await expect(authApi.uploadRecordingAsset('session-1', file)).rejects.toThrow(/50MB total/i);
    expect(supabase.storage.from).not.toHaveBeenCalled();
  });

  it('upserts revisioned transcript segments and starts transcript-based enhancement', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ provider_segment_id: 'dg-1' }], error: null });
    const upsert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ upsert });

    const segments = await authApi.upsertTranscriptSegments('session-1', [{
      id: 'dg-1',
      startMs: 100,
      endMs: 900,
      text: 'The derivative is two x.',
      confidence: 0.98,
      speaker: '0',
      revision: 2,
      isFinal: true,
    }]);

    expect(upsert).toHaveBeenCalledWith([expect.objectContaining({
      user_id: 42,
      session_id: 'session-1',
      provider_segment_id: 'dg-1',
      original_text: 'The derivative is two x.',
      speaker_key: '0',
      revision: 2,
    })], { onConflict: 'session_id,provider_segment_id' });
    expect(segments).toEqual([{ provider_segment_id: 'dg-1' }]);

    authApi.setToken(supabaseToken);
    supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: supabaseToken } } });
    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ token: 'short-lived', expires_in: 30 }));
    expect(await authApi.createTranscriptionToken()).toEqual({ token: 'short-lived', expires_in: 30 });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://supabase.test/functions/v1/transcription-token',
      expect.objectContaining({ method: 'POST' }),
    );

    globalThis.fetch.mockResolvedValueOnce(jsonResponse({ id: 'job-1', status: 'queued' }));
    await authApi.enhanceRecordedNote({ noteId: 'note-1', sessionId: 'session-1', userNotes: 'my jot' });
    expect(globalThis.fetch).toHaveBeenLastCalledWith(
      'https://supabase.test/functions/v1/create-ai-job',
      expect.objectContaining({
        body: JSON.stringify({
          kind: 'note_enhancement',
          payload: {
            noteId: 'note-1',
            sessionId: 'session-1',
            userNotesSnapshot: 'my jot',
            schemaVersion: 2,
          },
        }),
      }),
    );
  });

  it('saves transcript corrections and teaches confirmed vocabulary only to that class', async () => {
    const segmentSingle = vi.fn().mockResolvedValue({
      data: { id: 'segment-row-1', corrected_text: 'mitochondrial matrix', revision: 3 }, error: null,
    });
    const segmentSelect = vi.fn().mockReturnValue({ single: segmentSingle });
    const segmentQuery = { select: segmentSelect };
    const segmentEq = vi.fn().mockReturnValue(segmentQuery);
    segmentQuery.eq = segmentEq;
    const segmentUpdate = vi.fn().mockReturnValue({ eq: segmentEq });
    const memorySingle = vi.fn().mockResolvedValue({ data: { id: 'term-1' }, error: null });
    const memorySelect = vi.fn().mockReturnValue({ single: memorySingle });
    const memoryUpsert = vi.fn().mockReturnValue({ select: memorySelect });
    supabase.from.mockImplementation((table) => (
      table === 'transcript_segments' ? { update: segmentUpdate } : { upsert: memoryUpsert }
    ));

    await authApi.correctTranscriptSegment('segment-row-1', {
      correctedText: 'mitochondrial matrix',
      originalText: 'mitochondria matrix',
      speakerRole: 'Instructor',
      revision: 2,
      classId: 'class-1',
      sessionId: 'session-1',
    });

    expect(segmentUpdate).toHaveBeenCalledWith({
      corrected_text: 'mitochondrial matrix',
      speaker_role: 'Instructor',
      revision: 3,
    });
    expect(memoryUpsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 42,
      class_id: 'class-1',
      term: 'mitochondria matrix',
      corrected_form: 'mitochondrial matrix',
      source_kind: 'transcript_correction',
    }), { onConflict: 'class_id,term' });
  });
});
