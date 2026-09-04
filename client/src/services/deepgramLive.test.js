import { describe, expect, it, vi } from 'vitest';

import {
  buildDeepgramLiveUrl,
  createDeepgramStreamingClient,
  parseDeepgramMessage,
} from './deepgramLive.js';

describe('Deepgram classroom streaming', () => {
  it('builds a privacy-preserving Nova-3 URL with diarization and course keyterms', () => {
    const url = new URL(buildDeepgramLiveUrl({
      languages: ['en', 'es'],
      keyterms: ['mitochondria', 'chain rule'],
    }));

    expect(url.origin).toBe('wss://api.deepgram.com');
    expect(url.searchParams.get('model')).toBe('nova-3');
    expect(url.searchParams.get('language')).toBe('multi');
    expect(url.searchParams.get('diarize_model')).toBe('latest');
    expect(url.searchParams.get('interim_results')).toBe('true');
    expect(url.searchParams.get('mip_opt_out')).toBe('true');
    expect(url.searchParams.getAll('keyterm')).toEqual(['mitochondria', 'chain rule']);
  });

  it('declares raw native PCM encoding explicitly', () => {
    const url = new URL(buildDeepgramLiveUrl({ encoding: 'linear16', sampleRate: 16000, channels: 1 }));
    expect(url.searchParams.get('encoding')).toBe('linear16');
    expect(url.searchParams.get('sample_rate')).toBe('16000');
    expect(url.searchParams.get('channels')).toBe('1');
  });

  it('normalizes final and interim results into stable evidence segments', () => {
    const message = parseDeepgramMessage({
      type: 'Results',
      request_id: 'request-1',
      channel_index: [0, 1],
      start: 12.25,
      duration: 2.5,
      is_final: true,
      speech_final: true,
      channel: {
        alternatives: [{
          transcript: 'The derivative is two x.',
          confidence: 0.97,
          words: [
            { word: 'the', speaker: 1, language: 'en' },
            { word: 'derivative', speaker: 1, language: 'en' },
          ],
        }],
      },
    }, { revision: 4, source: 'mixed' });

    expect(message).toEqual(expect.objectContaining({
      id: 'request-1:0:12250',
      startMs: 12250,
      endMs: 14750,
      text: 'The derivative is two x.',
      confidence: 0.97,
      speaker: '1',
      language: 'en',
      revision: 4,
      isFinal: true,
      speechFinal: true,
      source: 'mixed',
    }));
    expect(parseDeepgramMessage({ type: 'Results', channel: { alternatives: [{ transcript: '' }] } }))
      .toBeNull();
  });

  it('authenticates with a short-lived bearer token and flushes before closing', async () => {
    const sockets = [];
    class FakeWebSocket {
      static OPEN = 1;
      constructor(url, protocols) {
        this.url = url;
        this.protocols = protocols;
        this.readyState = FakeWebSocket.OPEN;
        this.send = vi.fn();
        this.close = vi.fn();
        sockets.push(this);
      }
    }
    const states = [];
    let keepAliveTick;
    const client = createDeepgramStreamingClient({
      tokenProvider: vi.fn().mockResolvedValue({ token: 'jwt-token' }),
      WebSocketImpl: FakeWebSocket,
      onState: (state) => states.push(state),
      setIntervalFn: (callback) => { keepAliveTick = callback; return 1; },
      clearIntervalFn: vi.fn(),
    });

    await client.connect({ keyterms: ['Riven'] });
    expect(sockets[0].protocols).toEqual(['bearer', 'jwt-token']);
    sockets[0].onopen();
    client.send(new Blob(['audio']));
    expect(sockets[0].send).toHaveBeenCalledWith(expect.any(Blob));
    keepAliveTick();
    expect(sockets[0].send).toHaveBeenCalledWith(JSON.stringify({ type: 'KeepAlive' }));

    client.close();
    expect(sockets[0].send).toHaveBeenLastCalledWith(JSON.stringify({ type: 'Finalize' }));
    expect(sockets[0].close).toHaveBeenCalled();
    expect(states).toContain('open');
  });

  it('bounds queued audio while transcription is offline', () => {
    class ClosedWebSocket {
      static OPEN = 1;
    }
    const client = createDeepgramStreamingClient({
      tokenProvider: vi.fn(),
      WebSocketImpl: ClosedWebSocket,
      maxPendingAudioBytes: 10,
    });

    client.send(new Blob(['12345678']));
    client.send(new Blob(['abcdefgh']));

    expect(client.getState()).toEqual(expect.objectContaining({
      pendingAudioCount: 1,
      pendingAudioBytes: 8,
      droppedAudioCount: 1,
    }));
  });

  it('automatically backs off after a transient token failure', async () => {
    const scheduled = [];
    const tokenProvider = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('temporarily unavailable'), { code: 'DEEPGRAM_TRANSIENT_FAILURE' }))
      .mockResolvedValue({ token: 'fresh-token' });
    const client = createDeepgramStreamingClient({
      tokenProvider,
      WebSocketImpl: class FakeWebSocket { static OPEN = 1; },
      setTimeoutFn: (callback) => { scheduled.push(callback); return scheduled.length; },
      clearTimeoutFn: vi.fn(),
    });

    await expect(client.connect()).rejects.toThrow('temporarily unavailable');
    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(tokenProvider).toHaveBeenCalledTimes(2);
  });

  it('lets a student manually retry after live transcription exhausts its reconnects', async () => {
    const sockets = [];
    const scheduled = [];
    class FakeWebSocket {
      static OPEN = 1;
      constructor() {
        this.readyState = FakeWebSocket.OPEN;
        this.send = vi.fn();
        this.close = vi.fn();
        sockets.push(this);
      }
    }
    const client = createDeepgramStreamingClient({
      tokenProvider: vi.fn().mockResolvedValue({ token: 'fresh-token' }),
      WebSocketImpl: FakeWebSocket,
      maxReconnectAttempts: 1,
      setTimeoutFn: (callback) => { scheduled.push(callback); return scheduled.length; },
      clearTimeoutFn: vi.fn(),
    });

    await client.connect();
    sockets[0].onopen();
    sockets[0].onclose();
    expect(scheduled).toHaveLength(1);
    scheduled[0]();
    await Promise.resolve();
    await Promise.resolve();
    sockets[1].onclose();
    expect(client.getState().reconnectAttempts).toBe(1);

    await client.retry();

    expect(sockets).toHaveLength(3);
    expect(client.getState().reconnectAttempts).toBe(0);
  });
});
