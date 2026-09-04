import { openDB } from 'idb';

const RECOVERABLE_STATES = new Set([
  'preflight',
  'recording',
  'paused',
  'reconnecting',
  'stopped',
  'transcript_ready',
  'enhancing',
  'failed',
]);

const resolveCrypto = () => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle || typeof cryptoApi.getRandomValues !== 'function') {
    throw new Error('Secure recording storage is unavailable on this device');
  }
  return cryptoApi;
};

export async function generateRecordingKey() {
  return resolveCrypto().subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function sha256Hex(blob) {
  const buffer = blob instanceof Blob ? await blob.arrayBuffer() : blob;
  const digest = await resolveCrypto().subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function encryptRecordingChunk(blob, key) {
  if (!(blob instanceof Blob)) throw new Error('Recording chunk must be a Blob');
  const cryptoApi = resolveCrypto();
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const ciphertext = await cryptoApi.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    await blob.arrayBuffer(),
  );
  return {
    ciphertext,
    iv,
    mimeType: blob.type || 'application/octet-stream',
    byteSize: blob.size,
  };
}

export async function decryptRecordingChunk(record, key) {
  const plaintext = await resolveCrypto().subtle.decrypt(
    { name: 'AES-GCM', iv: record.iv },
    key,
    record.ciphertext,
  );
  return new Blob([plaintext], { type: record.mimeType || 'application/octet-stream' });
}

export function createMemoryRecordingChunkStore() {
  const sessions = new Map();
  const chunks = new Map();
  const keys = new Map();

  const getSessionKey = async (sessionId) => {
    if (!keys.has(sessionId)) keys.set(sessionId, await generateRecordingKey());
    return keys.get(sessionId);
  };

  const chunkKey = (sessionId, sequence) => `${sessionId}:${sequence}`;

  return {
    async saveSession(session) {
      if (!session?.id) throw new Error('Recording session requires an id');
      sessions.set(session.id, { ...session, persistedAt: new Date().toISOString() });
      return sessions.get(session.id);
    },

    async getSession(sessionId) {
      const session = sessions.get(sessionId);
      return session ? { ...session } : null;
    },

    async listRecoverableSessions() {
      return [...sessions.values()]
        .filter((session) => RECOVERABLE_STATES.has(session.state))
        .sort((left, right) => String(left.persistedAt).localeCompare(String(right.persistedAt)))
        .map((session) => ({ ...session }));
    },

    async putChunk({ sessionId, descriptor, blob }) {
      if (!sessionId || !descriptor || !(blob instanceof Blob)) {
        throw new Error('Session id, descriptor, and audio blob are required');
      }
      const key = await getSessionKey(sessionId);
      const encrypted = await encryptRecordingChunk(blob, key);
      const checksum = descriptor.checksum || await sha256Hex(blob);
      const record = {
        ...descriptor,
        ...encrypted,
        sessionId,
        checksum,
        uploadState: 'pending',
        storagePath: null,
      };
      chunks.set(chunkKey(sessionId, descriptor.sequence), record);
      return { ...descriptor, checksum, uploadState: 'pending' };
    },

    async getChunk(sessionId, sequence) {
      const record = chunks.get(chunkKey(sessionId, sequence));
      if (!record) return null;
      const key = await getSessionKey(sessionId);
      return {
        ...record,
        blob: await decryptRecordingChunk(record, key),
      };
    },

    async listChunks(sessionId) {
      return [...chunks.values()]
        .filter((record) => record.sessionId === sessionId)
        .sort((left, right) => left.sequence - right.sequence)
        .map(({ ciphertext: _ciphertext, iv: _iv, ...record }) => ({ ...record }));
    },

    async listPendingChunks(sessionId) {
      const records = await this.listChunks(sessionId);
      return records.filter((record) => record.uploadState !== 'verified');
    },

    async markChunkUploaded(sessionId, sequence, { storagePath }) {
      const key = chunkKey(sessionId, sequence);
      const record = chunks.get(key);
      if (!record) throw new Error('Recording chunk was not found');
      chunks.set(key, { ...record, uploadState: 'verified', storagePath });
    },

    async deleteVerifiedChunk(sessionId, sequence) {
      const key = chunkKey(sessionId, sequence);
      const record = chunks.get(key);
      if (record?.uploadState !== 'verified') {
        throw new Error('Only verified recording chunks may be removed locally');
      }
      chunks.delete(key);
    },

    async deleteSession(sessionId) {
      sessions.delete(sessionId);
      keys.delete(sessionId);
      for (const [key, record] of chunks.entries()) {
        if (record.sessionId === sessionId) chunks.delete(key);
      }
    },
  };
}

export function createIndexedDbRecordingChunkStore({ databaseName = 'riven-recordings-v2' } = {}) {
  let databasePromise = null;

  const getDatabase = () => {
    if (!databasePromise) {
      databasePromise = openDB(databaseName, 1, {
        upgrade(database) {
          if (!database.objectStoreNames.contains('sessions')) {
            database.createObjectStore('sessions', { keyPath: 'id' });
          }
          if (!database.objectStoreNames.contains('keys')) {
            database.createObjectStore('keys', { keyPath: 'sessionId' });
          }
          if (!database.objectStoreNames.contains('chunks')) {
            const chunkStore = database.createObjectStore('chunks', { keyPath: 'id' });
            chunkStore.createIndex('by_session', 'sessionId');
          }
        },
      });
    }
    return databasePromise;
  };

  const getSessionKey = async (sessionId) => {
    const database = await getDatabase();
    const stored = await database.get('keys', sessionId);
    if (stored?.key) return stored.key;
    const key = await generateRecordingKey();
    await database.put('keys', { sessionId, key });
    return key;
  };

  const listChunkRecords = async (sessionId) => {
    const database = await getDatabase();
    const records = await database.getAllFromIndex('chunks', 'by_session', sessionId);
    return records.sort((left, right) => left.sequence - right.sequence);
  };

  return {
    async saveSession(session) {
      if (!session?.id) throw new Error('Recording session requires an id');
      const record = { ...session, persistedAt: new Date().toISOString() };
      const database = await getDatabase();
      await database.put('sessions', record);
      return record;
    },

    async getSession(sessionId) {
      const database = await getDatabase();
      return (await database.get('sessions', sessionId)) || null;
    },

    async listRecoverableSessions() {
      const database = await getDatabase();
      const sessions = await database.getAll('sessions');
      return sessions
        .filter((session) => RECOVERABLE_STATES.has(session.state))
        .sort((left, right) => String(left.persistedAt).localeCompare(String(right.persistedAt)));
    },

    async putChunk({ sessionId, descriptor, blob }) {
      if (!sessionId || !descriptor || !(blob instanceof Blob)) {
        throw new Error('Session id, descriptor, and audio blob are required');
      }
      const key = await getSessionKey(sessionId);
      const encrypted = await encryptRecordingChunk(blob, key);
      const checksum = descriptor.checksum || await sha256Hex(blob);
      const record = {
        ...descriptor,
        ...encrypted,
        id: descriptor.id || `${sessionId}:${descriptor.sequence}`,
        sessionId,
        checksum,
        uploadState: 'pending',
        storagePath: null,
      };
      const database = await getDatabase();
      await database.put('chunks', record);
      return { ...descriptor, checksum, uploadState: 'pending' };
    },

    async getChunk(sessionId, sequence) {
      const database = await getDatabase();
      const record = await database.get('chunks', `${sessionId}:${sequence}`);
      if (!record) return null;
      const key = await getSessionKey(sessionId);
      return { ...record, blob: await decryptRecordingChunk(record, key) };
    },

    async listChunks(sessionId) {
      const records = await listChunkRecords(sessionId);
      return records.map(({ ciphertext: _ciphertext, iv: _iv, ...record }) => record);
    },

    async listPendingChunks(sessionId) {
      const records = await this.listChunks(sessionId);
      return records.filter((record) => record.uploadState !== 'verified');
    },

    async markChunkUploaded(sessionId, sequence, { storagePath }) {
      const database = await getDatabase();
      const id = `${sessionId}:${sequence}`;
      const record = await database.get('chunks', id);
      if (!record) throw new Error('Recording chunk was not found');
      await database.put('chunks', { ...record, uploadState: 'verified', storagePath });
    },

    async deleteVerifiedChunk(sessionId, sequence) {
      const database = await getDatabase();
      const id = `${sessionId}:${sequence}`;
      const record = await database.get('chunks', id);
      if (record?.uploadState !== 'verified') {
        throw new Error('Only verified recording chunks may be removed locally');
      }
      await database.delete('chunks', id);
    },

    async deleteSession(sessionId) {
      const database = await getDatabase();
      const transaction = database.transaction(['sessions', 'keys', 'chunks'], 'readwrite');
      const chunkStore = transaction.objectStore('chunks');
      const chunkIds = await chunkStore.index('by_session').getAllKeys(sessionId);
      await Promise.all(chunkIds.map((id) => chunkStore.delete(id)));
      await Promise.all([
        transaction.objectStore('sessions').delete(sessionId),
        transaction.objectStore('keys').delete(sessionId),
      ]);
      await transaction.done;
    },

    async close() {
      if (!databasePromise) return;
      const database = await databasePromise;
      database.close();
      databasePromise = null;
    },
  };
}
