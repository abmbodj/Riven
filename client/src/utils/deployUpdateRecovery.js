export const DEPLOY_UPDATE_RECOVERY_KEY = 'riven:deploy-update-recovery-attempted';
export const APP_ERROR_DIAGNOSTIC_KEY = 'riven:last-app-error';
const SAFE_RECOVERY_ROUTE = '/notes';

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

function normalizeRoute(route = '') {
  return String(route || '/')
    .replace(/\/(notes?|classes|decks|guides|exams)\/[^/?#]+/gi, '/$1/:id')
    .replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id')
    .slice(0, 160);
}

function fingerprintError(error, route) {
  const text = `${error?.name || 'Error'}:${String(error?.message || '').slice(0, 120)}:${normalizeRoute(route)}`;
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `rvn-${(hash >>> 0).toString(36)}`;
}

export function persistAppErrorDiagnostic(error, {
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
  now = () => new Date(),
  route = typeof window !== 'undefined' ? window.location?.pathname : '/',
} = {}) {
  if (!canUseStorage(storage)) return false;
  try {
    const previous = JSON.parse(storage.getItem(APP_ERROR_DIAGNOSTIC_KEY) || 'null');
    const fingerprint = fingerprintError(error, route);
    const repeatCount = previous?.fingerprint === fingerprint ? Number(previous.repeatCount || 1) + 1 : 1;
    storage.setItem(APP_ERROR_DIAGNOSTIC_KEY, JSON.stringify({
      kind: isDeployUpdateError(error) ? 'deploy-update' : 'runtime',
      name: String(error?.name || 'Error').slice(0, 80),
      fingerprint,
      supportId: `${fingerprint}-${now().getTime().toString(36)}`,
      repeatCount,
      route: normalizeRoute(route),
      timestamp: now().toISOString(),
    }));
    return true;
  } catch {
    return false;
  }
}

export function readRepeatedCrashDiagnostic({
  storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
} = {}) {
  if (!canUseStorage(storage)) return null;
  try {
    const diagnostic = JSON.parse(storage.getItem(APP_ERROR_DIAGNOSTIC_KEY) || 'null');
    return Number(diagnostic?.repeatCount || 0) >= 2 ? diagnostic : null;
  } catch {
    return null;
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
    allowRepeatedRuntimeError = false,
  } = {},
) {
  if (!isDeployUpdateError(error) && !allowRepeatedRuntimeError) return false;

  const cacheNames = await cachesApi?.keys?.().catch(() => []) || [];
  await Promise.all(cacheNames.map((name) => cachesApi.delete(name).catch(() => false)));
  const registrations = await navigatorApi?.serviceWorker?.getRegistrations?.().catch(() => []) || [];
  await Promise.all(registrations.map((registration) => registration.unregister?.().catch(() => false)));
  try {
    storage?.removeItem?.(DEPLOY_UPDATE_RECOVERY_KEY);
    storage?.removeItem?.(APP_ERROR_DIAGNOSTIC_KEY);
  } catch {
    // Cache recovery must remain safe in private browsing and quota failures.
  }
  if (allowRepeatedRuntimeError && typeof location?.replace === 'function') {
    location.replace(`${SAFE_RECOVERY_ROUTE}?safe-recovery=${Date.now()}`);
  } else {
    location?.reload?.();
  }
  return true;
}
