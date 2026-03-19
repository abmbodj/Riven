const ANDROID_UA =
  'com.google.android.youtube/20.10.38 (Linux; U; Android 14; en_US) gzip';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string };
}

type TranscriptFetcher = typeof fetch;
type SubtitleItem = { text?: string };
type SubtitleRequest = { videoID: string; lang?: string };
type GetSubtitlesImpl = (request: SubtitleRequest) => Promise<SubtitleItem[]>;
type TranscriptLogger = Pick<Console, 'warn'>;

type TranscriptDeps = {
  fetchImpl?: TranscriptFetcher;
  getSubtitlesImpl?: GetSubtitlesImpl;
  logger?: TranscriptLogger;
};

type TranscriptEvent = { segs?: Array<{ utf8?: string }> };

const createHttpError = (message: string, status = 400) => {
  const error = new Error(message);
  (error as Error & { status?: number }).status = status;
  return error;
};

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim();

const joinTranscriptParts = (parts: string[]): string => parts.map(normalizeText).filter(Boolean).join(' ');

export const extractVideoId = (url: string): string => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.slice(1).split('/')[0];
    }
    return parsed.searchParams.get('v') || '';
  } catch {
    return '';
  }
};

export const selectCaptionTrack = (tracks: CaptionTrack[], lang: string): CaptionTrack | undefined => {
  // 1. Manual captions in requested language
  const manual = tracks.find((t) => t.languageCode === lang && t.kind !== 'asr');
  if (manual) return manual;

  // 2. Auto-generated captions in requested language
  const auto = tracks.find((t) => t.languageCode === lang);
  if (auto) return auto;

  // 3. Any manual English track
  const anyManualEn = tracks.find((t) => t.languageCode.startsWith('en') && t.kind !== 'asr');
  if (anyManualEn) return anyManualEn;

  // 4. Any auto-generated English track
  const anyAutoEn = tracks.find((t) => t.languageCode.startsWith('en'));
  if (anyAutoEn) return anyAutoEn;

  // 5. First available track
  return tracks[0];
};

const extractCaptionTracks = (data: unknown): CaptionTrack[] => {
  if (!data || typeof data !== 'object') return [];
  return (data as {
    captions?: {
      playerCaptionsTracklistRenderer?: {
        captionTracks?: CaptionTrack[];
      };
    };
  })?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
};

const buildPlayerRequest = (videoId: string, client: Record<string, unknown>) => ({
  context: { client },
  videoId,
});

const parseWatchPageCaptionTracks = (html: string): CaptionTrack[] => {
  const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
  if (!match?.[1]) return [];

  try {
    return extractCaptionTracks(JSON.parse(match[1]));
  } catch {
    return [];
  }
};

export const fetchCaptionTracks = async (
  videoId: string,
  fetchImpl: TranscriptFetcher = fetch,
): Promise<CaptionTrack[]> => {
  // Strategy 1: ANDROID client (what youtube-transcript-api uses)
  const androidRes = await fetchImpl(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_UA,
      },
      body: JSON.stringify(buildPlayerRequest(videoId, {
        clientName: 'ANDROID',
        clientVersion: '20.10.38',
        androidSdkVersion: 34,
        hl: 'en',
        gl: 'US',
      })),
    },
  );

  if (androidRes.ok) {
    const data = await androidRes.json();
    const tracks = extractCaptionTracks(data);
    if (tracks.length > 0) return tracks;
  }

  // Strategy 2: WEB_EMBEDDED_PLAYER (no poToken policies)
  const embeddedRes = await fetchImpl(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify(buildPlayerRequest(videoId, {
        clientName: 'WEB_EMBEDDED_PLAYER',
        clientVersion: '2.20250312.01.00',
      })),
    },
  );

  if (embeddedRes.ok) {
    const data = await embeddedRes.json();
    const tracks = extractCaptionTracks(data);
    if (tracks.length > 0) return tracks;
  }

  // Strategy 3: Scrape watch page for ytInitialPlayerResponse
  const watchRes = await fetchImpl(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': BROWSER_UA },
  });

  if (watchRes.ok) {
    const html = await watchRes.text();
    const tracks = parseWatchPageCaptionTracks(html);
    if (tracks.length > 0) return tracks;
  }

  return [];
};

export const parseJson3Transcript = (data: Record<string, unknown>): string[] => {
  const lines: string[] = [];
  const events = (data as { events?: TranscriptEvent[] }).events ?? [];

  for (const event of events) {
    if (!event.segs) continue;
    const text = event.segs.map((s) => s.utf8 ?? '').join('');
    const trimmed = normalizeText(text.replace(/\n/g, ' '));
    if (trimmed) lines.push(trimmed);
  }

  return lines;
};

export const fetchTranscriptFromCaptionTrack = async (
  track: CaptionTrack,
  fetchImpl: TranscriptFetcher = fetch,
): Promise<string> => {
  const separator = track.baseUrl.includes('?') ? '&' : '?';
  const transcriptRes = await fetchImpl(`${track.baseUrl}${separator}fmt=json3`, {
    headers: { 'User-Agent': BROWSER_UA },
  });

  if (!transcriptRes.ok) {
    throw new Error(`Transcript fetch returned ${transcriptRes.status}`);
  }

  const transcriptData = await transcriptRes.json();
  const lines = parseJson3Transcript(transcriptData);

  if (lines.length === 0) {
    throw new Error('Transcript was empty');
  }

  return joinTranscriptParts(lines);
};

export const fetchTranscriptViaCustomStrategy = async (
  videoId: string,
  lang = 'en',
  fetchImpl: TranscriptFetcher = fetch,
): Promise<string> => {
  const captionTracks = await fetchCaptionTracks(videoId, fetchImpl);

  if (captionTracks.length === 0) {
    throw new Error('No captions available for this video');
  }

  const track = selectCaptionTrack(captionTracks, lang);
  if (!track) {
    throw new Error('No suitable caption track found');
  }

  return fetchTranscriptFromCaptionTrack(track, fetchImpl);
};

const loadCaptionExtractor = async (): Promise<GetSubtitlesImpl> => {
  const module = await import('npm:youtube-caption-extractor@1.9.0');
  return module.getSubtitles as GetSubtitlesImpl;
};

export const fetchTranscriptViaCaptionExtractor = async (
  videoId: string,
  lang = 'en',
  getSubtitlesImpl?: GetSubtitlesImpl,
): Promise<string> => {
  const resolveSubtitles = getSubtitlesImpl ?? await loadCaptionExtractor();
  const subtitles = await resolveSubtitles({ videoID: videoId, lang });
  const transcript = joinTranscriptParts(
    (subtitles ?? []).map((item) => item?.text ?? ''),
  );

  if (!transcript) {
    throw new Error('No captions available for this video');
  }

  return transcript;
};

export const fetchYoutubeTranscriptWithDeps = async (
  youtubeUrl: string,
  lang = 'en',
  {
    fetchImpl = fetch,
    getSubtitlesImpl,
    logger = console,
  }: TranscriptDeps = {},
): Promise<string> => {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    throw createHttpError('Could not extract video ID from YouTube URL.', 400);
  }

  const strategyErrors: string[] = [];

  try {
    return await fetchTranscriptViaCustomStrategy(videoId, lang, fetchImpl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    strategyErrors.push(`custom:${message}`);
  }

  try {
    return await fetchTranscriptViaCaptionExtractor(videoId, lang, getSubtitlesImpl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    strategyErrors.push(`caption-extractor:${message}`);
  }

  logger.warn('[youtubeTranscript] transcript strategies failed', {
    videoId,
    strategyErrors,
  });

  throw createHttpError(
    'Failed to fetch YouTube transcript. The video may not have captions available.',
    400,
  );
};

export const fetchYoutubeTranscript = async (youtubeUrl: string, lang = 'en'): Promise<string> =>
  fetchYoutubeTranscriptWithDeps(youtubeUrl, lang);
