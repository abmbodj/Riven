import { describe, expect, it, vi } from 'vitest';
import {
  DEPLOY_UPDATE_RECOVERY_KEY,
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
});
