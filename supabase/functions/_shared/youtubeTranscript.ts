const ANDROID_UA =
  'com.google.android.youtube/20.10.38 (Linux; U; Android 14; en_US) gzip';
const IOS_UA =
  'com.google.ios.youtube/20.10.38 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

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
type TranscriptLogger = Pick<Console, 'warn'> & Partial<Pick<Console, 'info'>>;

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

const buildPlayerRequest = (videoId: string, client: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  context: { client },
  videoId,
  ...extra,
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
  // Strategy 1: ANDROID client with params bypass for integrity checks
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
      }, { params: 'CgIQBg%3D%3D' })),
    },
  );

  if (androidRes.ok) {
    const data = await androidRes.json();
    const tracks = extractCaptionTracks(data);
    if (tracks.length > 0) return tracks;
  }

  // Strategy 2: WEB client (standard browser innertube request)
  const webRes = await fetchImpl(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify(buildPlayerRequest(videoId, {
        clientName: 'WEB',
        clientVersion: '2.20240101.00.00',
      })),
    },
  );

  if (webRes.ok) {
    const data = await webRes.json();
    const tracks = extractCaptionTracks(data);
    if (tracks.length > 0) return tracks;
  }

  // Strategy 3: IOS client (different rate-limiting behavior)
  const iosRes = await fetchImpl(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': IOS_UA,
      },
      body: JSON.stringify(buildPlayerRequest(videoId, {
        clientName: 'IOS',
        clientVersion: '20.10.38',
        deviceMake: 'Apple',
        deviceModel: 'iPhone16,2',
        osName: 'iOS',
        osVersion: '17.5.1',
        hl: 'en',
        gl: 'US',
      })),
    },
  );

  if (iosRes.ok) {
    const data = await iosRes.json();
    const tracks = extractCaptionTracks(data);
    if (tracks.length > 0) return tracks;
  }

  // Strategy 4: Scrape watch page for ytInitialPlayerResponse
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

// Strategy using TranscriptAPI — reliable third-party transcript service
export const fetchTranscriptViaTranscriptApi = async (
  videoId: string,
  lang = 'en',
  fetchImpl: TranscriptFetcher = fetch,
): Promise<string> => {
  const apiKey = Deno.env.get('TRANSCRIPTAPI_KEY');
  if (!apiKey) {
    throw new Error('TRANSCRIPTAPI_KEY is not configured');
  }

  const params = new URLSearchParams({ video_url: videoId, format: 'json', lang });
  const res = await fetchImpl(`https://transcriptapi.com/api/v2/youtube/transcript?${params}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TranscriptAPI returned ${res.status}: ${body.substring(0, 200)}`);
  }

  const data = await res.json();
  const segments = Array.isArray(data?.segments) ? data.segments : [];
  const content = segments
    .map((segment: { text?: string }) => (typeof segment?.text === 'string' ? segment.text : ''))
    .join(' ');
  const transcript = normalizeText(content);

  if (!transcript) {
    throw new Error('TranscriptAPI returned empty transcript');
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

  const logSuccess = (strategy: string) => {
    logger.info?.('[youtubeTranscript] strategy succeeded', { videoId, strategy });
  };

  // Strategy 1: Custom innertube /player caption tracks (free first)
  try {
    const transcript = await fetchTranscriptViaCustomStrategy(videoId, lang, fetchImpl);
    logSuccess('custom');
    return transcript;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    strategyErrors.push(`custom:${message}`);
  }

  // Strategy 2: youtube-caption-extractor package fallback
  try {
    const transcript = await fetchTranscriptViaCaptionExtractor(videoId, lang, getSubtitlesImpl);
    logSuccess('caption-extractor');
    return transcript;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    strategyErrors.push(`caption-extractor:${message}`);
  }

  // Strategy 3: TranscriptAPI (paid reliability fallback)
  try {
    const transcript = await fetchTranscriptViaTranscriptApi(videoId, lang, fetchImpl);
    logSuccess('transcriptapi');
    return transcript;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    strategyErrors.push(`transcriptapi:${message}`);
  }

  logger.warn('[youtubeTranscript] all transcript strategies failed', {
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
