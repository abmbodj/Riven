import { describe, expect, it, vi } from 'vitest';
import {
  DEPLOY_UPDATE_RECOVERY_KEY,
  APP_ERROR_DIAGNOSTIC_KEY,
  persistAppErrorDiagnostic,
  recoverStaleDeployAssets,
  readRepeatedCrashDiagnostic,
  attemptDeployUpdateRecovery,
  isDeployUpdateError,
} from './deployUpdateRecovery.js';

function createStorage() {
  const values = new Map();
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

describe('deploy update recovery', () => {
  it('identifies deploy-related lazy chunk failures', () => {
    expect(isDeployUpdateError(new Error('Failed to fetch dynamically imported module'))).toBe(true);
    expect(isDeployUpdateError(new Error('ChunkLoadError: Loading chunk 42 failed.'))).toBe(true);
    expect(isDeployUpdateError(new Error('Loading chunk dashboard failed'))).toBe(true);
    expect(isDeployUpdateError(new Error('Regular runtime error'))).toBe(false);
  });

  it('reloads once for a matching deploy-churn error and records the attempt', () => {
    const storage = createStorage();
    const location = { reload: vi.fn() };
    const error = new Error('Failed to fetch dynamically imported module');

    expect(attemptDeployUpdateRecovery(error, { storage, location })).toBe(true);
    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem(DEPLOY_UPDATE_RECOVERY_KEY)).toBe('1');

    expect(attemptDeployUpdateRecovery(error, { storage, location })).toBe(false);
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated errors without reloading', () => {
    const storage = createStorage();
    const location = { reload: vi.fn() };

    expect(attemptDeployUpdateRecovery(new Error('Cannot read properties of undefined'), { storage, location })).toBe(false);
    expect(location.reload).not.toHaveBeenCalled();
    expect(storage.getItem(DEPLOY_UPDATE_RECOVERY_KEY)).toBe(null);
  });

  it('clears only Cache Storage and service workers for a confirmed stale asset failure', async () => {
    const cachesApi = {
      keys: vi.fn(async () => ['vite-precache', 'runtime-assets']),
      delete: vi.fn(async () => true),
    };
    const registrations = [{ unregister: vi.fn(async () => true) }];
    const location = { reload: vi.fn() };

    const recovered = await recoverStaleDeployAssets(new Error('ChunkLoadError: Loading chunk 42 failed.'), {
      cachesApi,
      navigatorApi: { serviceWorker: { getRegistrations: vi.fn(async () => registrations) } },
      location,
    });

    expect(recovered).toBe(true);
    expect(cachesApi.delete).toHaveBeenCalledWith('vite-precache');
    expect(cachesApi.delete).toHaveBeenCalledWith('runtime-assets');
    expect(registrations[0].unregister).toHaveBeenCalledTimes(1);
    expect(location.reload).toHaveBeenCalledTimes(1);
  });

  it('persists only non-sensitive error metadata across a reload', () => {
    const storage = createStorage();
    persistAppErrorDiagnostic(new Error('Notes from Biology 101: mitochondria'), { storage });

    expect(JSON.parse(storage.getItem(APP_ERROR_DIAGNOSTIC_KEY))).toEqual(expect.objectContaining({
      kind: 'runtime',
      name: 'Error',
      supportId: expect.any(String),
      fingerprint: expect.any(String),
      repeatCount: 1,
      timestamp: expect.any(String),
    }));
    expect(storage.getItem(APP_ERROR_DIAGNOSTIC_KEY)).not.toContain('mitochondria');
  });

  it('detects a repeated runtime crash and allows explicit cache-only recovery', async () => {
    const storage = createStorage();
    const error = new TypeError('Cannot read properties of undefined');
    persistAppErrorDiagnostic(error, { storage, route: '/notes/note-1' });
    persistAppErrorDiagnostic(error, { storage, route: '/notes/note-1' });

    const diagnostic = readRepeatedCrashDiagnostic({ storage });
    expect(diagnostic).toEqual(expect.objectContaining({ repeatCount: 2, route: '/notes/:id' }));

    const cachesApi = { keys: vi.fn(async () => ['riven-route-assets-v1']), delete: vi.fn(async () => true) };
    const location = { replace: vi.fn() };
    await expect(recoverStaleDeployAssets(error, {
      cachesApi,
      navigatorApi: null,
      location,
      storage,
      allowRepeatedRuntimeError: true,
    })).resolves.toBe(true);
    expect(cachesApi.delete).toHaveBeenCalledWith('riven-route-assets-v1');
    expect(location.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/notes\?safe-recovery=/));
  });

  it('still reloads safely when Cache Storage is unavailable', async () => {
    const location = { reload: vi.fn() };
    await expect(recoverStaleDeployAssets(new Error('ChunkLoadError: Loading chunk 42 failed.'), {
      cachesApi: null,
      navigatorApi: null,
      location,
    })).resolves.toBe(true);
    expect(location.reload).toHaveBeenCalledTimes(1);
  });
});
