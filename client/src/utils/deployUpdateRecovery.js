const DEPLOY_UPDATE_RECOVERY_KEY = 'riven:deploy-update-recovery-attempted';

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

function isDeployUpdateError(error) {
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
