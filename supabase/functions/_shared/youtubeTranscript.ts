const USER_AGENT =
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

export const fetchYoutubeTranscript = async (youtubeUrl: string, lang = 'en'): Promise<string> => {
  const videoId = extractVideoId(youtubeUrl);
  if (!videoId) {
    const err = new Error('Could not extract video ID from YouTube URL.');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  try {
    // Step 1: Get caption tracks from YouTube Innertube player API
    const playerRes = await fetch(
      'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
            },
          },
          videoId,
        }),
      },
    );

    if (!playerRes.ok) {
      throw new Error(`YouTube player API returned ${playerRes.status}`);
    }

    const playerData = await playerRes.json();
    const captionTracks: CaptionTrack[] =
      playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    if (captionTracks.length === 0) {
      throw new Error('No captions available for this video');
    }

    const track = selectCaptionTrack(captionTracks, lang);
    if (!track) {
      throw new Error('No suitable caption track found');
    }

    // Step 2: Fetch the actual transcript content in json3 format
    const separator = track.baseUrl.includes('?') ? '&' : '?';
    const transcriptRes = await fetch(`${track.baseUrl}${separator}fmt=json3`, {
      headers: { 'User-Agent': USER_AGENT },
    });

    if (!transcriptRes.ok) {
      throw new Error(`Transcript fetch returned ${transcriptRes.status}`);
    }

    const transcriptData = await transcriptRes.json();
    const lines: string[] = [];

    for (const event of transcriptData.events ?? []) {
      if (!event.segs) continue;
      const text = event.segs
        .map((s: { utf8?: string }) => s.utf8 ?? '')
        .join('');
      const trimmed = text.replace(/\n/g, ' ').trim();
      if (trimmed) lines.push(trimmed);
    }

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
