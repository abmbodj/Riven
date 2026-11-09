import { buildDeepgramBatchUrl } from './deepgramBatchCore.mjs';

const toUtterances = (payload) => {
  const utterances = Array.isArray(payload?.results?.utterances) ? payload.results.utterances : [];
  if (utterances.length) return utterances;
  const alternative = payload?.results?.channels?.[0]?.alternatives?.[0];
  const sentences = alternative?.paragraphs?.paragraphs?.flatMap((paragraph) => paragraph?.sentences || []) || [];
  if (sentences.length) return sentences;
  const transcript = String(alternative?.transcript || '').trim();
  if (!transcript) return [];
  const words = Array.isArray(alternative?.words) ? alternative.words : [];
  return [{
    start: words[0]?.start || 0,
    end: words.at(-1)?.end || 0,
    transcript,
    confidence: alternative?.confidence,
    speaker: words[0]?.speaker,
  }];
};

/** @param {{ callbackUrl?: string, languages?: string[], keyterms?: unknown[], rawLinear16?: boolean }} [options] */
export function buildDeepgramCallbackUrl({ callbackUrl, languages, keyterms, rawLinear16 = false } = {}) {
  const url = new URL(buildDeepgramBatchUrl({ languages, keyterms, rawLinear16 }));
  url.searchParams.set('callback', String(callbackUrl || ''));
  url.searchParams.set('callback_method', 'post');
  return url.toString();
}

export function normalizeDeepgramCallback(payload) {
  const segments = toUtterances(payload).map((utterance, index) => {
    const start = Math.max(0, Number(utterance?.start || 0));
    const end = Math.max(start, Number(utterance?.end || start));
    const startMs = Math.round(start * 1000);
    const endMs = Math.round(end * 1000);
    return {
      id: `deepgram-replay:${startMs}:${endMs}:${index}`,
      startMs,
      endMs,
      text: String(utterance?.transcript || utterance?.text || '').trim(),
      confidence: Number.isFinite(utterance?.confidence) ? Number(utterance.confidence) : null,
      speaker: utterance?.speaker == null ? null : String(utterance.speaker),
      language: utterance?.language || null,
    };
  }).filter((segment) => segment.text);

  return {
    requestId: payload?.metadata?.request_id || payload?.request_id || null,
    text: segments.map((segment) => segment.text).join(' '),
    segments,
  };
}

/**
 * @param {{
 * apiKey?: string, audio?: Blob | ReadableStream<Uint8Array>, mimeType?: string,
 * callbackUrl?: string, languages?: string[], keyterms?: unknown[], rawLinear16?: boolean,
 * fetchFn?: typeof fetch
 * }} [options]
 */
export async function submitDeepgramRecordingForCallback({
  apiKey,
  audio,
  mimeType = 'audio/webm',
  callbackUrl,
  languages = ['en'],
  keyterms = [],
  rawLinear16 = false,
  fetchFn = fetch,
} = {}) {
  if (!String(apiKey || '').trim()) {
    const error = new Error('Deepgram is not configured');
    error.status = 503;
    error.code = 'DEEPGRAM_NOT_CONFIGURED';
    throw error;
  }
  if (!audio || !String(callbackUrl || '').startsWith('https://')) {
    const error = new Error('Durable recording callback configuration is invalid');
    error.status = 500;
    error.code = 'DEEPGRAM_CALLBACK_INVALID';
    throw error;
  }

  const response = await fetchFn(buildDeepgramCallbackUrl({ callbackUrl, languages, keyterms, rawLinear16 }), {
    method: 'POST',
    headers: {
      Authorization: `Token ${String(apiKey).trim()}`,
      'Content-Type': rawLinear16 ? 'application/octet-stream' : mimeType,
    },
    body: audio,
  });
  if (!response.ok) {
    const error = new Error(`Deepgram durable transcription submission failed (${response.status})`);
    error.status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 502;
    error.code = response.status === 429 || response.status >= 500
      ? 'DEEPGRAM_TRANSIENT_FAILURE'
      : 'DEEPGRAM_SUBMISSION_FAILED';
    error.provider_status = response.status;
    throw error;
  }
  const payload = await response.json().catch(() => ({}));
  const requestId = payload?.request_id || payload?.metadata?.request_id || null;
  if (!requestId) {
    const error = new Error('Deepgram accepted transcription without a request id');
    error.status = 502;
    error.code = 'DEEPGRAM_INVALID_RESPONSE';
    throw error;
  }
  return { requestId };
}
