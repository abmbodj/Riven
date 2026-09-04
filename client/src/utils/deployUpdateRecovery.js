export const DEPLOY_UPDATE_RECOVERY_KEY = 'riven:deploy-update-recovery-attempted';
export const APP_ERROR_DIAGNOSTIC_KEY = 'riven:last-app-error';

const DEPLOY_UPDATE_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /ChunkLoadError/i,
  /Loading chunk .* failed/i,
  /Importing a module script failed/i,
];

function getErrorText(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;

  const reason = error.reason;
  return [
    error.name,
    error.message,
    typeof reason === 'string' ? reason : reason?.message,
    error.stack,
  ]
    .filter(Boolean)
    .join('\n');
}

function canUseStorage(storage) {
  return storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function';
}

export function persistAppErrorDiagnostic(error, {
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  now = () => new Date(),
} = {}) {
  if (!canUseStorage(storage)) return false;
  try {
    storage.setItem(APP_ERROR_DIAGNOSTIC_KEY, JSON.stringify({
      kind: isDeployUpdateError(error) ? 'deploy-update' : 'runtime',
      name: String(error?.name || 'Error').slice(0, 80),
      timestamp: now().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function isDeployUpdateError(error) {
  const text = getErrorText(error);
  return DEPLOY_UPDATE_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export function attemptDeployUpdateRecovery(
  error,
  {
    storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    location = typeof window !== 'undefined' ? window.location : null,
  } = {}
) {
  if (!isDeployUpdateError(error) || !canUseStorage(storage)) {
    return false;
  }

  if (storage.getItem(DEPLOY_UPDATE_RECOVERY_KEY) === '1') {
    return false;
  }

  storage.setItem(DEPLOY_UPDATE_RECOVERY_KEY, '1');

  if (location && typeof location.reload === 'function') {
    location.reload();
  }

  return true;
}

export async function recoverStaleDeployAssets(
  error,
  {
    cachesApi = typeof caches !== 'undefined' ? caches : null,
    navigatorApi = typeof navigator !== 'undefined' ? navigator : null,
    location = typeof window !== 'undefined' ? window.location : null,
    storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  } = {},
) {
  if (!isDeployUpdateError(error)) return false;

  const cacheNames = await cachesApi?.keys?.().catch(() => []) || [];
  await Promise.all(cacheNames.map((name) => cachesApi.delete(name).catch(() => false)));
  const registrations = await navigatorApi?.serviceWorker?.getRegistrations?.().catch(() => []) || [];
  await Promise.all(registrations.map((registration) => registration.unregister?.().catch(() => false)));
  try {
    storage?.removeItem?.(DEPLOY_UPDATE_RECOVERY_KEY);
  } catch {
    // Cache recovery must remain safe in private browsing and quota failures.
  }
  location?.reload?.();
  return true;
}
