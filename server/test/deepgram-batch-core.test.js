import { describe, expect, it, vi } from 'vitest';

import {
  buildDeepgramBatchUrl,
  transcribeDeepgramRecording,
} from '../../supabase/functions/_shared/deepgramBatchCore.mjs';

describe('Deepgram durable recording recovery', () => {
  it('builds a Nova-3 batch request with current diarization and classroom keyterms', () => {
    const url = new URL(buildDeepgramBatchUrl({
      languages: ['en', 'es'],
      keyterms: ['mitochondrial matrix', 'Krebs cycle'],
      rawLinear16: true,
    }));

    expect(url.searchParams.get('model')).toBe('nova-3');
    expect(url.searchParams.get('language')).toBe('multi');
    expect(url.searchParams.get('diarize_model')).toBe('latest');
    expect(url.searchParams.get('encoding')).toBe('linear16');
    expect(url.searchParams.get('sample_rate')).toBe('16000');
    expect(url.searchParams.getAll('keyterm')).toEqual(['mitochondrial matrix', 'Krebs cycle']);
  });

  it('transcribes durable audio into timestamped speaker utterances', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        metadata: { request_id: 'dg-batch-1' },
        results: {
          utterances: [
            { start: 1.2, end: 3.4, transcript: 'The derivative is two x.', confidence: 0.96, speaker: 0 },
            { start: 3.5, end: 5.1, transcript: 'Then apply the chain rule.', confidence: 0.93, speaker: 1 },
          ],
        },
      }),
    });
    const audio = new Blob(['durable classroom audio'], { type: 'audio/webm' });

    const result = await transcribeDeepgramRecording({
      apiKey: 'server-key',
      audio,
      mimeType: 'audio/webm',
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('https://api.deepgram.com/v1/listen?'),
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Token server-key', 'Content-Type': 'audio/webm' },
        body: audio,
      }),
    );
    expect(result.text).toBe('The derivative is two x. Then apply the chain rule.');
    expect(result.segments).toEqual([
      expect.objectContaining({ id: 'deepgram-batch:1200:3400:0', start: 1.2, end: 3.4, speaker: '0' }),
      expect.objectContaining({ id: 'deepgram-batch:3500:5100:1', start: 3.5, end: 5.1, speaker: '1' }),
    ]);
  });

  it('accepts a streaming body so multi-hour recovery does not buffer the whole recording', async () => {
    const audio = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('chunk-one'));
        controller.enqueue(new TextEncoder().encode('chunk-two'));
        controller.close();
      },
    });
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        results: {
          utterances: [{ start: 0, end: 1, transcript: 'Recovered lecture.' }],
        },
      }),
    });

    await transcribeDeepgramRecording({
      apiKey: 'server-key',
      audio,
      mimeType: 'application/octet-stream',
      rawLinear16: true,
      fetchFn,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('encoding=linear16'),
      expect.objectContaining({ body: audio }),
    );
  });
});
