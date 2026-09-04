import { registerPlugin } from '@capacitor/core';
import { RECORDING_CHUNK_MS } from '../utils/recordingSessionV2.js';

const ClassroomRecorderPlugin = registerPlugin('ClassroomRecorder');

export function nativeChunkToBlob(chunk) {
  const binary = atob(String(chunk?.dataBase64 || ''));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: chunk?.mimeType || 'application/octet-stream' });
}

export function createNativeClassroomRecorderAdapter(plugin = ClassroomRecorderPlugin) {
  let chunkSubscription = null;
  let interruptionSubscription = null;
  let currentSessionId = null;
  let currentOnChunk = null;

  const removeListeners = async () => {
    await chunkSubscription?.remove?.();
    await interruptionSubscription?.remove?.();
    chunkSubscription = null;
    interruptionSubscription = null;
  };

  const attachListeners = async ({ onChunk, onInterruption = () => {} }) => {
    await removeListeners();
    chunkSubscription = await plugin.addListener('chunkAvailable', (chunk) => {
      const blob = nativeChunkToBlob(chunk);
      if (!blob.size) return;
      onChunk?.({
        ...chunk,
        blob,
        mimeType: chunk.mimeType || 'application/octet-stream',
        recovered: false,
      });
    });
    interruptionSubscription = await plugin.addListener('recordingInterruption', onInterruption);
  };

  const replayChunks = async (sessionId, onChunk) => {
    if (!sessionId || typeof plugin.listChunks !== 'function' || typeof plugin.readChunk !== 'function') {
      return { chunkCount: 0 };
    }
    const result = await plugin.listChunks({ sessionId });
    const chunks = Array.isArray(result?.chunks) ? result.chunks : [];
    for (const descriptor of chunks) {
      if (!Number.isInteger(descriptor?.sequence)) continue;
      const chunk = await plugin.readChunk({ sessionId, sequence: descriptor.sequence });
      const blob = nativeChunkToBlob(chunk);
      if (!blob.size) continue;
      await onChunk?.({
        ...descriptor,
        ...chunk,
        blob,
        mimeType: chunk.mimeType || 'application/octet-stream',
        recovered: true,
      });
    }
    return { chunkCount: chunks.length };
  };

  return {
    async start({ sessionId, onChunk, onInterruption = () => {} }) {
      const permission = await plugin.checkPermissions();
      if (permission?.microphone !== 'granted') {
        const requested = await plugin.requestPermissions();
        if (requested?.microphone !== 'granted') throw new Error('PermissionDeniedError');
      }
      currentSessionId = sessionId;
      currentOnChunk = onChunk;
      await attachListeners({ onChunk, onInterruption });
      return plugin.start({
        sessionId,
        chunkDurationMs: RECORDING_CHUNK_MS,
        sampleRate: 16000,
        channels: 1,
      });
    },
    async recover({ sessionId, onChunk, onInterruption = () => {} }) {
      if (!sessionId) return { chunkCount: 0 };
      currentSessionId = sessionId;
      currentOnChunk = onChunk;
      await attachListeners({ onChunk, onInterruption });
      return replayChunks(sessionId, onChunk);
    },
    acknowledgeChunk: (sessionId, sequence) => plugin.acknowledgeChunk({ sessionId, sequence }),
    pause: () => plugin.pause(),
    resume: () => plugin.resume(),
    getStatus: () => plugin.getStatus(),
    async stop() {
      try {
        const result = await plugin.stop();
        await replayChunks(currentSessionId, currentOnChunk);
        return result;
      } finally {
        await removeListeners();
        currentSessionId = null;
        currentOnChunk = null;
      }
    },
    async reset() {
      try {
        await plugin.stop().catch(() => {});
      } finally {
        await removeListeners();
      }
    },
  };
}
