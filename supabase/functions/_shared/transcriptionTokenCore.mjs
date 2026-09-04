const DEEPGRAM_GRANT_URL = 'https://api.deepgram.com/v1/auth/grant';

const createGrantError = (code, message, providerStatus, retryable, providerCategory) => {
  const error = new Error(message);
  // Keep the edge response stable while preserving only safe classification metadata
  // for logs/Sentry. Never include Deepgram's response body.
  error.status = 503;
  error.code = code;
  error.provider_status = providerStatus;
  error.provider_category = providerCategory;
  error.retryable = retryable;
  return error;
};

export async function requestDeepgramTemporaryToken({ apiKey, fetchFn = fetch }) {
  if (!apiKey?.trim()) {
    throw createGrantError(
      'DEEPGRAM_NOT_CONFIGURED',
      'Live transcription is not configured',
      undefined,
      false,
      'configuration',
    );
  }

  let response;
  try {
    response = await fetchFn(DEEPGRAM_GRANT_URL, {
      method: 'POST',
      headers: { Authorization: `Token ${apiKey.trim()}` },
    });
  } catch (error) {
    throw createGrantError(
      'DEEPGRAM_TRANSIENT_FAILURE',
      'Transcription service is temporarily unavailable',
      undefined,
      true,
      'transient',
    );
  }

  if (!response.ok) {
    const providerStatus = Number(response.status);
    if (providerStatus === 401 || providerStatus === 403) {
      throw createGrantError(
        'DEEPGRAM_PERMISSION_DENIED',
        'Live transcription credential needs attention',
        providerStatus,
        false,
        'permission',
      );
    }
    if (providerStatus === 429 || providerStatus >= 500) {
      throw createGrantError(
        'DEEPGRAM_TRANSIENT_FAILURE',
        'Transcription service is temporarily unavailable',
        providerStatus,
        true,
        'transient',
      );
    }
    throw createGrantError(
      'DEEPGRAM_CONFIGURATION_ERROR',
      'Live transcription configuration needs attention',
      providerStatus,
      false,
      'configuration',
    );
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw createGrantError(
      'DEEPGRAM_INVALID_TOKEN_RESPONSE',
      'Transcription service returned an invalid token',
      200,
      true,
      'invalid_response',
    );
  }
  const token = String(payload?.access_token || '').trim();
  const expiresIn = Number(payload?.expires_in || 30);
  if (!token) {
    throw createGrantError(
      'DEEPGRAM_INVALID_TOKEN_RESPONSE',
      'Transcription service returned an invalid token',
      200,
      true,
      'invalid_response',
    );
  }

  return {
    token,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : 30,
  };
}
