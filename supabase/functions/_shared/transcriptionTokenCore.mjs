const DEEPGRAM_GRANT_URL = 'https://api.deepgram.com/v1/auth/grant';

export async function requestDeepgramTemporaryToken({ apiKey, fetchFn = fetch }) {
  if (!apiKey?.trim()) {
    const error = new Error('Deepgram is not configured');
    error.status = 503;
    throw error;
  }

  const response = await fetchFn(DEEPGRAM_GRANT_URL, {
    method: 'POST',
    headers: { Authorization: `Token ${apiKey.trim()}` },
  });

  if (!response.ok) {
    const error = new Error('Transcription service is temporarily unavailable');
    error.status = 503;
    throw error;
  }

  const payload = await response.json();
  const token = String(payload?.access_token || '').trim();
  const expiresIn = Number(payload?.expires_in || 30);
  if (!token) {
    const error = new Error('Transcription service returned an invalid token');
    error.status = 502;
    throw error;
  }

  return {
    token,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : 30,
  };
}
