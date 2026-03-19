const ANDROID_UA =
  'com.google.android.youtube/20.10.38 (Linux; U; Android 14; en_US) gzip';
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string;
  name?: { simpleText?: string };
}

const extractVideoId = (url: string): string => {
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

const selectCaptionTrack = (tracks: CaptionTrack[], lang: string): CaptionTrack | undefined => {
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

const fetchCaptionTracks = async (videoId: string): Promise<CaptionTrack[]> => {
  // Strategy 1: ANDROID client (what youtube-transcript-api uses)
  const androidRes = await fetch(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': ANDROID_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '20.10.38',
            androidSdkVersion: 34,
            hl: 'en',
            gl: 'US',
          },
        },
        videoId,
      }),
    },
  );

  if (androidRes.ok) {
    const data = await androidRes.json();
    const tracks: CaptionTrack[] =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    if (tracks.length > 0) return tracks;
  }

  // Strategy 2: WEB_EMBEDDED_PLAYER (no poToken policies)
  const embeddedRes = await fetch(
    'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': BROWSER_UA,
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB_EMBEDDED_PLAYER',
            clientVersion: '2.20250312.01.00',
          },
        },
        videoId,
      }),
    },
  );

  if (embeddedRes.ok) {
    const data = await embeddedRes.json();
    const tracks: CaptionTrack[] =
      data?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    if (tracks.length > 0) return tracks;
  }

  // Strategy 3: Scrape watch page for ytInitialPlayerResponse
  const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { 'User-Agent': BROWSER_UA },
  });

  if (watchRes.ok) {
    const html = await watchRes.text();
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});/s);
    if (match?.[1]) {
      try {
        const playerData = JSON.parse(match[1]);
        const tracks: CaptionTrack[] =
          playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
        if (tracks.length > 0) return tracks;
      } catch {
        // JSON parse failed, fall through
      }
    }
  }

  return [];
};

const parseJson3Transcript = (data: Record<string, unknown>): string[] => {
  const lines: string[] = [];
  const events = (data as { events?: Array<{ segs?: Array<{ utf8?: string }> }> }).events ?? [];

  for (const event of events) {
    if (!event.segs) continue;
    const text = event.segs.map((s) => s.utf8 ?? '').join('');
    const trimmed = text.replace(/\n/g, ' ').trim();
    if (trimmed) lines.push(trimmed);
  }

  return lines;
};

export const fetchYoutubeTranscript = async (youtubeUrl: string, lang = 'en'): Promise<string> => {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    const err = new Error('Could not extract video ID from YouTube URL.');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  try {
    const captionTracks = await fetchCaptionTracks(videoId);

    if (captionTracks.length === 0) {
      throw new Error('No captions available for this video');
    }

    const track = selectCaptionTrack(captionTracks, lang);
    if (!track) {
      throw new Error('No suitable caption track found');
    }

    // Fetch transcript content in json3 format
    const separator = track.baseUrl.includes('?') ? '&' : '?';
    const transcriptRes = await fetch(`${track.baseUrl}${separator}fmt=json3`, {
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

    return lines.join(' ');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const err = new Error(
      `Failed to fetch YouTube transcript. The video may not have captions available. ${message}`,
    );
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
};
