import { describe, expect, it } from 'vitest';
import {
  RECORDING_CHUNK_MS,
  RECORDING_SESSION_STATES,
  applyRecordingEvent,
  buildChunkDescriptor,
  findMissingChunkSequences,
  mergeTranscriptSegments,
  resolveAudioExpiry,
} from './recordingSessionV2.js';

describe('recordingSessionV2', () => {
  it('supports pause, reconnect, and transcript-ready transitions without losing the session', () => {
    const recording = applyRecordingEvent({ state: 'preflight' }, { type: 'START' });
    const paused = applyRecordingEvent(recording, { type: 'PAUSE', atMs: 15_000 });
    const resumed = applyRecordingEvent(paused, { type: 'RESUME', atMs: 25_000 });
    const reconnecting = applyRecordingEvent(resumed, { type: 'NETWORK_LOST' });
    const connected = applyRecordingEvent(reconnecting, { type: 'NETWORK_RESTORED' });
    const stopped = applyRecordingEvent(connected, { type: 'STOP', atMs: 60_000 });
    const ready = applyRecordingEvent(stopped, { type: 'TRANSCRIPT_READY' });

    expect(recording.state).toBe(RECORDING_SESSION_STATES.RECORDING);
    expect(paused).toMatchObject({ state: 'paused', pausedAtMs: 15_000 });
    expect(resumed).toMatchObject({ state: 'recording', pausedAtMs: null });
    expect(reconnecting).toMatchObject({ state: 'reconnecting', resumeState: 'recording' });
    expect(connected.state).toBe('recording');
    expect(stopped).toMatchObject({ state: 'stopped', stoppedAtMs: 60_000 });
    expect(ready.state).toBe('transcript_ready');
  });

  it('rejects invalid transitions instead of silently corrupting state', () => {
    expect(() => applyRecordingEvent({ state: 'idle' }, { type: 'PAUSE' }))
      .toThrow('Cannot PAUSE while recording session is idle');
  });

  it('builds stable five-second chunk descriptors', () => {
    expect(RECORDING_CHUNK_MS).toBe(5_000);
    expect(buildChunkDescriptor({
      sessionId: 'session-1',
      sequence: 3,
      startedAtMs: 15_000,
      durationMs: 5_000,
      source: 'mixed',
      mimeType: 'audio/webm;codecs=opus',
      byteSize: 4096,
      checksum: 'sha256-value',
    })).toEqual({
      id: 'session-1:3',
      sessionId: 'session-1',
      sequence: 3,
      startedAtMs: 15_000,
      endedAtMs: 20_000,
      durationMs: 5_000,
      source: 'mixed',
      mimeType: 'audio/webm;codecs=opus',
      byteSize: 4096,
      checksum: 'sha256-value',
    });
  });

  it('reports missing chunk sequences deterministically', () => {
    expect(findMissingChunkSequences([
      { sequence: 0 },
      { sequence: 1 },
      { sequence: 3 },
      { sequence: 6 },
    ])).toEqual([2, 4, 5]);
  });

  it('reconciles overlapping transcript windows by stable segment id and revision', () => {
    const merged = mergeTranscriptSegments(
      [
        { id: 'a', startMs: 0, endMs: 2_000, text: 'Welcome', revision: 1, confidence: 0.9 },
        { id: 'b', startMs: 2_000, endMs: 4_000, text: 'to biology', revision: 1, confidence: 0.7 },
      ],
      [
        { id: 'b', startMs: 2_000, endMs: 4_000, text: 'to cell biology', revision: 2, confidence: 0.95 },
        { id: 'c', startMs: 4_000, endMs: 6_000, text: 'today', revision: 1, confidence: 0.8 },
      ],
    );

    expect(merged.map((segment) => segment.id)).toEqual(['a', 'b', 'c']);
    expect(merged[1]).toMatchObject({ text: 'to cell biology', revision: 2, confidence: 0.95 });
  });

  it('starts audio expiry only after successful enhancement', () => {
    const completedAt = new Date('2026-09-03T12:00:00.000Z');

    expect(resolveAudioExpiry({ enhancementCompletedAt: null, keepAudio: false })).toBeNull();
    expect(resolveAudioExpiry({ enhancementCompletedAt: completedAt, keepAudio: false }))
      .toBe('2026-09-04T12:00:00.000Z');
    expect(resolveAudioExpiry({ enhancementCompletedAt: completedAt, keepAudio: true }))
      .toBe('2026-10-03T12:00:00.000Z');
  });
});
