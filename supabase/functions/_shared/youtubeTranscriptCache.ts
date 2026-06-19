import { extractVideoId, fetchYoutubeTranscriptWithDeps } from './youtubeTranscript.ts';

type GetOrFetchArgs = {
  // Service-role Supabase client (see supabaseAdmin.ts — typed as any there).
  admin: any;
  youtubeUrl: string;
  lang?: string;
  // Injectable for tests; default to live extraction in production.
  fetchImpl?: typeof fetch;
  getSubtitlesImpl?: (request: { videoID: string; lang?: string }) => Promise<Array<{ text?: string }>>;
};

/**
 * Returns a YouTube transcript, reading from the cross-user `youtube_transcripts`
 * cache first and only falling back to live extraction (free strategies → paid
 * TranscriptAPI) on a miss. A successful fetch is written back to the cache so the
 * next user importing the same video skips all extraction. Cache reads/writes are
 * best-effort: any cache error degrades to a normal live fetch.
 */
export const getOrFetchYoutubeTranscript = async ({
  admin,
  youtubeUrl,
  lang = 'en',
  fetchImpl,
  getSubtitlesImpl,
}: GetOrFetchArgs): Promise<string> => {
  const videoId = extractVideoId(youtubeUrl);

  // Without a video id we cannot key the cache; fall straight through to fetch.
  if (!videoId) {
    return fetchYoutubeTranscriptWithDeps(youtubeUrl, lang, { fetchImpl, getSubtitlesImpl });
  }

  try {
    const { data, error } = await admin
      .from('youtube_transcripts')
      .select('transcript')
      .eq('video_id', videoId)
      .eq('lang', lang)
      .maybeSingle();

    if (!error && data?.transcript) {
      return data.transcript as string;
    }
  } catch (cacheReadError) {
    console.warn('[youtubeTranscriptCache] cache read failed', {
      videoId,
      error: cacheReadError instanceof Error ? cacheReadError.message : 'Unknown error',
    });
  }

  // Capture which strategy produced the transcript for telemetry (the chain logs
  // `{ strategy }` on success) while preserving normal console output.
  let winningStrategy: string | null = null;
  const transcript = await fetchYoutubeTranscriptWithDeps(youtubeUrl, lang, {
    fetchImpl,
    getSubtitlesImpl,
    logger: {
      warn: (...args: unknown[]) => console.warn(...args),
      info: (...args: unknown[]) => {
        const meta = args[1];
        if (meta && typeof meta === 'object' && 'strategy' in meta) {
          winningStrategy = String((meta as { strategy?: unknown }).strategy);
        }
        console.info(...args);
      },
    },
  });

  try {
    await admin
      .from('youtube_transcripts')
      .upsert(
        { video_id: videoId, lang, transcript, source: winningStrategy, fetched_at: new Date().toISOString() },
        { onConflict: 'video_id,lang' },
      );
  } catch (cacheWriteError) {
    console.warn('[youtubeTranscriptCache] cache write failed', {
      videoId,
      error: cacheWriteError instanceof Error ? cacheWriteError.message : 'Unknown error',
    });
  }

  return transcript;
};
