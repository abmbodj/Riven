const DEEPGRAM_LISTEN_URL = 'https://api.deepgram.com/v1/listen';

const cleanTerms = (terms = []) => [...new Set(terms
  .map((term) => String(term || '').trim())
  .filter(Boolean))]
  .slice(0, 100);

/**
 * @param {{ languages?: string[], keyterms?: unknown[], rawLinear16?: boolean }} [options]
 */
export function buildDeepgramBatchUrl({
  languages = ['en'],
  keyterms = [],
  rawLinear16 = false,
} = {}) {
  const url = new URL(DEEPGRAM_LISTEN_URL);
  const normalizedLanguages = languages.map((language) => String(language || '').trim()).filter(Boolean);
  const params = {
    model: 'nova-3',
    language: normalizedLanguages.length === 1 ? normalizedLanguages[0] : 'multi',
    smart_format: 'true',
    punctuate: 'true',
    paragraphs: 'true',
    utterances: 'true',
    diarize_model: 'latest',
    mip_opt_out: 'true',
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  if (rawLinear16) {
    url.searchParams.set('encoding', 'linear16');
    url.searchParams.set('sample_rate', '16000');
    url.searchParams.set('channels', '1');
  }
  cleanTerms(keyterms).forEach((term) => url.searchParams.append('keyterm', term));
  return url.toString();
}

const normalizeUtterances = (payload) => {
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

/**
 * @param {{
 *   apiKey?: string,
 *   audio?: Blob | ReadableStream<Uint8Array>,
 *   mimeType?: string,
 *   languages?: string[],
 *   keyterms?: unknown[],
 *   rawLinear16?: boolean,
 *   fetchFn?: typeof fetch,
 * }} [options]
 */
export async function transcribeDeepgramRecording({
  apiKey,
  audio,
  mimeType = 'audio/webm',
  languages = ['en'],
  keyterms = [],
  rawLinear16 = false,
  fetchFn = fetch,
} = {}) {
  if (!String(apiKey || '').trim()) {
    const error = new Error('Deepgram is not configured');
    error.status = 503;
    throw error;
  }
  const isBlob = audio instanceof Blob;
  const isReadableStream = typeof ReadableStream !== 'undefined' && audio instanceof ReadableStream;
  if ((!isBlob && !isReadableStream) || (isBlob && audio.size === 0)) {
    const error = new Error('Durable recording audio is unavailable');
    error.status = 409;
    throw error;
  }

  const response = await fetchFn(buildDeepgramBatchUrl({ languages, keyterms, rawLinear16 }), {
    method: 'POST',
    headers: {
      Authorization: `Token ${String(apiKey).trim()}`,
      'Content-Type': rawLinear16 ? 'application/octet-stream' : mimeType,
    },
    body: audio,
  });
  if (!response.ok) {
    const error = new Error(`Deepgram durable transcription failed (${response.status})`);
    error.status = response.status === 429 ? 429 : response.status >= 500 ? 503 : 502;
    throw error;
  }

  const payload = await response.json();
  const segments = normalizeUtterances(payload).map((utterance, index) => {
    const start = Math.max(0, Number(utterance?.start || 0));
    const end = Math.max(start, Number(utterance?.end || start));
    const startMs = Math.round(start * 1000);
    const endMs = Math.round(end * 1000);
    return {
      id: `deepgram-batch:${startMs}:${endMs}:${index}`,
      start,
      end,
      text: String(utterance?.transcript || utterance?.text || '').trim(),
      confidence: Number.isFinite(utterance?.confidence) ? Number(utterance.confidence) : null,
      speaker: utterance?.speaker == null ? null : String(utterance.speaker),
      language: utterance?.language || null,
    };
  }).filter((segment) => segment.text);

  if (!segments.length) {
    const error = new Error('Deepgram returned an empty durable transcript');
    error.status = 502;
    throw error;
  }
  return {
    requestId: payload?.metadata?.request_id || null,
    text: segments.map((segment) => segment.text).join(' '),
    segments,
  };
}
