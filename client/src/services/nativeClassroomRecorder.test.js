import { describe, expect, it, vi } from 'vitest';

import { createNativeClassroomRecorderAdapter, nativeChunkToBlob } from './nativeClassroomRecorder.js';

describe('native classroom recorder bridge', () => {
  it('converts 16 kHz linear PCM chunks without changing their bytes', async () => {
    const blob = nativeChunkToBlob({ dataBase64: 'AQIDBA==', mimeType: 'application/octet-stream' });
    expect(blob.type).toBe('application/octet-stream');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it('starts five-second background capture and forwards durable chunks', async () => {
    const listeners = {};
    const plugin = {
      checkPermissions: vi.fn(async () => ({ microphone: 'granted' })),
      requestPermissions: vi.fn(),
      addListener: vi.fn(async (name, callback) => {
        listeners[name] = callback;
        return { remove: vi.fn() };
      }),
      start: vi.fn(async () => ({ started: true })),
      pause: vi.fn(async () => ({})),
      resume: vi.fn(async () => ({})),
      stop: vi.fn(async () => ({ durationMs: 5000 })),
      getStatus: vi.fn(async () => ({ state: 'recording' })),
    };
    const onChunk = vi.fn();
    const adapter = createNativeClassroomRecorderAdapter(plugin);

    await adapter.start({ sessionId: 'local-1', onChunk });
    expect(plugin.start).toHaveBeenCalledWith({
      sessionId: 'local-1', chunkDurationMs: 5000, sampleRate: 16000, channels: 1,
    });

    listeners.chunkAvailable({ sequence: 0, dataBase64: 'YXVkaW8=', durationMs: 5000 });
    expect(onChunk).toHaveBeenCalledWith(expect.objectContaining({
      sequence: 0,
      blob: expect.any(Blob),
      durationMs: 5000,
    }));
    await adapter.pause();
    await adapter.resume();
    await adapter.stop();
    expect(plugin.pause).toHaveBeenCalled();
    expect(plugin.resume).toHaveBeenCalled();
    expect(plugin.stop).toHaveBeenCalled();
  });

  it('reattaches listeners and replays unacknowledged native chunks after a reload', async () => {
    const listeners = {};
    const plugin = {
      addListener: vi.fn(async (name, callback) => {
        listeners[name] = callback;
        return { remove: vi.fn() };
      }),
      listChunks: vi.fn(async () => ({ chunks: [{ sequence: 2 }, { sequence: 3 }] })),
      readChunk: vi.fn(async ({ sequence }) => ({
        sequence,
        dataBase64: sequence === 2 ? 'AQI=' : 'AwQ=',
        mimeType: 'application/octet-stream',
        durationMs: 5000,
      })),
      acknowledgeChunk: vi.fn(async () => ({})),
    };
    const onChunk = vi.fn();
    const adapter = createNativeClassroomRecorderAdapter(plugin);

    const result = await adapter.recover({ sessionId: 'local-1', onChunk });

    expect(result).toEqual({ chunkCount: 2 });
    expect(plugin.readChunk).toHaveBeenNthCalledWith(1, { sessionId: 'local-1', sequence: 2 });
    expect(plugin.readChunk).toHaveBeenNthCalledWith(2, { sessionId: 'local-1', sequence: 3 });
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenCalledWith(expect.objectContaining({ sequence: 2, recovered: true }));

    listeners.chunkAvailable({ sequence: 4, dataBase64: 'BQY=', durationMs: 5000 });
    expect(onChunk).toHaveBeenCalledWith(expect.objectContaining({ sequence: 4, recovered: false }));

    await adapter.acknowledgeChunk('local-1', 2);
    expect(plugin.acknowledgeChunk).toHaveBeenCalledWith({ sessionId: 'local-1', sequence: 2 });
  });
});
