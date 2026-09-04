import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import {
  createIndexedDbRecordingChunkStore,
  createMemoryRecordingChunkStore,
  decryptRecordingChunk,
  encryptRecordingChunk,
  generateRecordingKey,
  sha256Hex,
} from './recordingChunkStore.js';

describe('recordingChunkStore', () => {
  it('encrypts audio with a unique IV and restores the original blob', async () => {
    const key = await generateRecordingKey();
    const blob = new Blob(['lecture audio'], { type: 'audio/webm' });
    const first = await encryptRecordingChunk(blob, key);
    const second = await encryptRecordingChunk(blob, key);

    expect(Array.from(first.iv)).not.toEqual(Array.from(second.iv));
    expect(new Uint8Array(first.ciphertext)).not.toEqual(new Uint8Array(await blob.arrayBuffer()));

    const restored = await decryptRecordingChunk(first, key);
    expect(restored.type).toBe('audio/webm');
    expect(await restored.text()).toBe('lecture audio');
  });

  it('computes a stable lowercase SHA-256 checksum', async () => {
    expect(await sha256Hex(new Blob(['abc']))).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('persists recoverable sessions and encrypted chunks until upload is verified', async () => {
    const store = createMemoryRecordingChunkStore();
    await store.saveSession({ id: 'session-1', state: 'recording', noteId: 'note-1' });
    await store.putChunk({
      sessionId: 'session-1',
      descriptor: { id: 'session-1:0', sequence: 0, mimeType: 'audio/webm' },
      blob: new Blob(['chunk zero'], { type: 'audio/webm' }),
    });

    expect(await store.listRecoverableSessions()).toEqual([
      expect.objectContaining({ id: 'session-1', state: 'recording' }),
    ]);
    expect(await store.listPendingChunks('session-1')).toHaveLength(1);
    expect(await (await store.getChunk('session-1', 0)).blob.text()).toBe('chunk zero');

    await store.markChunkUploaded('session-1', 0, { storagePath: '1/session-1/0.webm' });
    expect(await store.listPendingChunks('session-1')).toHaveLength(0);
    expect(await store.listChunks('session-1')).toEqual([
      expect.objectContaining({ uploadState: 'verified', storagePath: '1/session-1/0.webm' }),
    ]);

    await store.deleteVerifiedChunk('session-1', 0);
    expect(await store.listChunks('session-1')).toEqual([]);
  });

  it('keeps stopped sessions recoverable until explicitly removed', async () => {
    const store = createMemoryRecordingChunkStore();
    await store.saveSession({ id: 'session-1', state: 'stopped' });
    await store.saveSession({ id: 'session-2', state: 'complete' });

    expect((await store.listRecoverableSessions()).map((session) => session.id)).toEqual(['session-1']);
    await store.deleteSession('session-1');
    expect(await store.getSession('session-1')).toBeNull();
  });

  it('persists encrypted chunks across IndexedDB store instances', async () => {
    const databaseName = `riven-recording-test-${crypto.randomUUID()}`;
    const first = createIndexedDbRecordingChunkStore({ databaseName });
    await first.saveSession({ id: 'session-1', state: 'recording', noteId: 'note-1' });
    await first.putChunk({
      sessionId: 'session-1',
      descriptor: { id: 'session-1:0', sequence: 0, mimeType: 'audio/webm' },
      blob: new Blob(['persisted audio'], { type: 'audio/webm' }),
    });
    await first.close();

    const second = createIndexedDbRecordingChunkStore({ databaseName });
    expect(await second.getSession('session-1')).toMatchObject({ state: 'recording', noteId: 'note-1' });
    expect(await (await second.getChunk('session-1', 0)).blob.text()).toBe('persisted audio');
    expect(await second.listPendingChunks('session-1')).toHaveLength(1);
    await second.close();

    await new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(databaseName);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
});
