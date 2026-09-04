import { describe, expect, it, vi } from 'vitest';

import { requestDeepgramTemporaryToken } from '../../supabase/functions/_shared/transcriptionTokenCore.mjs';

describe('requestDeepgramTemporaryToken', () => {
  it('exchanges the server key for a short-lived client token without returning the key', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      access_token: 'temporary-token',
      expires_in: 30,
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await requestDeepgramTemporaryToken({ apiKey: 'server-secret', fetchFn });

    expect(fetchFn).toHaveBeenCalledWith('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: { Authorization: 'Token server-secret' },
    });
    expect(result).toEqual({ token: 'temporary-token', expiresIn: 30 });
    expect(JSON.stringify(result)).not.toContain('server-secret');
  });

  it('rejects missing configuration and upstream failures with safe messages', async () => {
    await expect(requestDeepgramTemporaryToken({ apiKey: '', fetchFn: vi.fn() }))
      .rejects.toThrow('Deepgram is not configured');

    const fetchFn = vi.fn().mockResolvedValue(new Response('provider details', { status: 503 }));
    await expect(requestDeepgramTemporaryToken({ apiKey: 'secret', fetchFn }))
      .rejects.toThrow('Transcription service is temporarily unavailable');
  });
});
