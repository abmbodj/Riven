import { YoutubeTranscript } from 'npm:youtube-transcript@1.2.1';

export const fetchYoutubeTranscript = async (youtubeUrl: string): Promise<string> => {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(youtubeUrl);
    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error('No transcript available');
    }
    return transcriptItems.map((item: { text: string }) => item.text).join(' ');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const err = new Error(
      `Failed to fetch YouTube transcript. The video may not have captions available. ${message}`,
    );
    (err as Error & { status?: number }).status = 400;
    throw err;
  }
};
