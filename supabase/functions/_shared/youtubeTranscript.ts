import { getSubtitles } from 'npm:youtube-caption-extractor@1.9.0';

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

export const fetchYoutubeTranscript = async (youtubeUrl: string): Promise<string> => {
  const videoID = extractVideoId(youtubeUrl);
  if (!videoID) {
    const err = new Error('Could not extract video ID from YouTube URL.');
    (err as Error & { status?: number }).status = 400;
    throw err;
  }

  try {
    const subtitles = await getSubtitles({ videoID, lang: 'en' });
    if (!subtitles || subtitles.length === 0) {
      throw new Error('No transcript available');
    }
    return subtitles.map((item: { text: string }) => item.text).join(' ');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const err = new Error(
      `Failed to fetch YouTube transcript. The video may not have captions available. ${message}`,
    );
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
};
