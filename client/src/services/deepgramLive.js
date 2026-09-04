const DEEPGRAM_LIVE_URL = 'wss://api.deepgram.com/v1/listen';

export function buildDeepgramLiveUrl({
  languages = ['en'], keyterms = [], tag = 'riven-class', encoding, sampleRate, channels,
} = {}) {
  const url = new URL(DEEPGRAM_LIVE_URL);
  const parameters = {
    model: 'nova-3',
    language: languages.length === 1 ? languages[0] : 'multi',
    smart_format: 'true',
    punctuate: 'true',
    diarize_model: 'latest',
    utterances: 'true',
    interim_results: 'true',
    vad_events: 'true',
    endpointing: '300',
    utterance_end_ms: '1000',
    mip_opt_out: 'true',
    tag,
  };
  Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
  if (encoding) url.searchParams.set('encoding', encoding);
  if (sampleRate) url.searchParams.set('sample_rate', String(sampleRate));
  if (channels) url.searchParams.set('channels', String(channels));
  keyterms
    .map((term) => String(term || '').trim())
    .filter(Boolean)
    .slice(0, 100)
    .forEach((term) => url.searchParams.append('keyterm', term));
  return url.toString();
}

const mostFrequentValue = (values) => {
  const counts = new Map();
  for (const value of values.filter((candidate) => candidate !== undefined && candidate !== null)) {
    counts.set(String(value), (counts.get(String(value)) || 0) + 1);
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null;
};

export function parseDeepgramMessage(payload, { revision = 1, source = 'microphone' } = {}) {
  if (payload?.type !== 'Results') return null;
  const alternative = payload.channel?.alternatives?.[0];
  const text = String(alternative?.transcript || '').trim();
  if (!text) return null;

  const startMs = Math.max(0, Math.round(Number(payload.start || 0) * 1000));
  const endMs = Math.max(startMs, Math.round((Number(payload.start || 0) + Number(payload.duration || 0)) * 1000));
  const requestId = payload.request_id || payload.metadata?.request_id || 'deepgram';
  const channel = Array.isArray(payload.channel_index) ? payload.channel_index[0] : (payload.channel_index || 0);
  const words = Array.isArray(alternative.words) ? alternative.words : [];

  return {
    id: `${requestId}:${channel}:${startMs}`,
    startMs,
    endMs,
    text,
    confidence: Number.isFinite(alternative.confidence) ? alternative.confidence : null,
    speaker: mostFrequentValue(words.map((word) => word.speaker)),
    language: mostFrequentValue(words.map((word) => word.language)) || payload.channel?.detected_language || null,
    revision: Math.max(1, Math.round(revision || 1)),
    isFinal: Boolean(payload.is_final),
    speechFinal: Boolean(payload.speech_final),
    source,
  };
}

export function createDeepgramStreamingClient({
  tokenProvider,
  WebSocketImpl = globalThis.WebSocket,
  onSegment = () => {},
  onState = () => {},
  onError = () => {},
  maxReconnectAttempts = 5,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
  setIntervalFn = globalThis.setInterval,
  clearIntervalFn = globalThis.clearInterval,
  maxPendingAudioBytes = 5 * 1024 * 1024,
} = {}) {
  if (typeof tokenProvider !== 'function') throw new Error('A transcription token provider is required');
  if (!WebSocketImpl) throw new Error('WebSocket transcription is unavailable on this device');

  let socket = null;
  let options = {};
  let revision = 0;
  let reconnectAttempts = 0;
  let intentionallyClosed = false;
  let keepAliveTimer = null;
  let reconnectTimer = null;
  const pendingAudio = [];
  let pendingAudioBytes = 0;
  let droppedAudioCount = 0;

  const isOpen = () => socket?.readyState === (WebSocketImpl.OPEN ?? 1);

  const clearReconnectTimer = () => {
    if (reconnectTimer !== null) {
      clearTimeoutFn(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const isRetryableConnectionError = (error) => {
    if (error?.retryable === false) return false;
    return ![
      'DEEPGRAM_PERMISSION_DENIED',
      'DEEPGRAM_NOT_CONFIGURED',
      'DEEPGRAM_CONFIGURATION_ERROR',
    ].includes(error?.code);
  };

  const scheduleReconnect = (error) => {
    if (intentionallyClosed || !isRetryableConnectionError(error)) return false;
    if (reconnectAttempts >= maxReconnectAttempts) {
      onState('failed');
      return false;
    }
    reconnectAttempts += 1;
    onState('reconnecting');
    const delay = Math.min(1000 * (2 ** (reconnectAttempts - 1)), 15000);
    reconnectTimer = setTimeoutFn(() => {
      reconnectTimer = null;
      connect(options).catch(() => {});
    }, delay);
    return true;
  };

  const connect = async (nextOptions = options) => {
    options = nextOptions;
    intentionallyClosed = false;
    onState(reconnectAttempts ? 'reconnecting' : 'connecting');
    try {
      const credentials = await tokenProvider();
      const token = typeof credentials === 'string' ? credentials : credentials?.token;
      if (!token) throw new Error('Transcription token was empty');
      socket = new WebSocketImpl(buildDeepgramLiveUrl(options), ['bearer', token]);
      socket.onopen = () => {
        reconnectAttempts = 0;
        onState('open');
        while (pendingAudio.length && isOpen()) {
          const pending = pendingAudio.shift();
          pendingAudioBytes = Math.max(0, pendingAudioBytes - Number(pending?.size || 0));
          socket.send(pending);
        }
        if (keepAliveTimer) clearIntervalFn(keepAliveTimer);
        keepAliveTimer = setIntervalFn(() => {
          if (isOpen()) socket.send(JSON.stringify({ type: 'KeepAlive' }));
        }, 8000);
      };
      socket.onmessage = (event) => {
        try {
          const payload = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          const segment = parseDeepgramMessage(payload, {
            revision: ++revision,
            source: options.source || 'microphone',
          });
          if (segment) onSegment(segment, payload);
        } catch (error) {
          onError(error);
        }
      };
      socket.onerror = (event) => onError(event instanceof Error ? event : new Error('Live transcription connection failed'));
      socket.onclose = () => {
        if (keepAliveTimer) clearIntervalFn(keepAliveTimer);
        keepAliveTimer = null;
        if (intentionallyClosed) {
          onState('closed');
          return;
        }
        const reconnectError = new Error('Live transcription could not reconnect');
        if (!scheduleReconnect(reconnectError)) onError(reconnectError);
      };
      return socket;
    } catch (error) {
      onError(error);
      if (!scheduleReconnect(error)) onState('failed');
      throw error;
    }
  };

  return {
    connect,
    async retry(nextOptions = options) {
      clearReconnectTimer();
      reconnectAttempts = 0;
      intentionallyClosed = false;
      if (socket && !isOpen()) {
        socket.onclose = null;
        socket.close?.();
      }
      return connect(nextOptions);
    },
    send(audio) {
      if (!audio || (audio instanceof Blob && audio.size === 0)) return;
      if (isOpen()) {
        try {
          socket.send(audio);
        } catch (error) {
          onError(error);
          try {
            socket.close?.();
          } catch {
            // The closed socket will recover through the durable recording path.
          }
        }
      }
      else {
        const audioSize = Number(audio?.size || audio?.byteLength || 0);
        while (pendingAudio.length && pendingAudioBytes + audioSize > maxPendingAudioBytes) {
          const dropped = pendingAudio.shift();
          pendingAudioBytes = Math.max(0, pendingAudioBytes - Number(dropped?.size || dropped?.byteLength || 0));
          droppedAudioCount += 1;
        }
        if (audioSize <= maxPendingAudioBytes) {
          pendingAudio.push(audio);
          pendingAudioBytes += audioSize;
        } else {
          droppedAudioCount += 1;
        }
      }
    },
    keepAlive() {
      if (isOpen()) socket.send(JSON.stringify({ type: 'KeepAlive' }));
    },
    close() {
      intentionallyClosed = true;
      clearReconnectTimer();
      if (keepAliveTimer) clearIntervalFn(keepAliveTimer);
      keepAliveTimer = null;
      if (isOpen()) socket.send(JSON.stringify({ type: 'Finalize' }));
      socket?.close();
    },
    async finalizeAndClose({ graceMs = 750 } = {}) {
      intentionallyClosed = true;
      clearReconnectTimer();
      if (keepAliveTimer) clearIntervalFn(keepAliveTimer);
      keepAliveTimer = null;
      if (!isOpen()) {
        socket?.close();
        return;
      }
      socket.send(JSON.stringify({ type: 'Finalize' }));
      await new Promise((resolve) => setTimeoutFn(resolve, graceMs));
      if (isOpen()) socket.send(JSON.stringify({ type: 'CloseStream' }));
      socket?.close();
    },
    getState() {
      return {
        connected: isOpen(),
        reconnectAttempts,
        pendingAudioCount: pendingAudio.length,
        pendingAudioBytes,
        droppedAudioCount,
      };
    },
  };
}
