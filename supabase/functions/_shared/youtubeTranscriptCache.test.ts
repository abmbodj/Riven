import { getOrFetchYoutubeTranscript } from './youtubeTranscriptCache.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

// Minimal chainable stub of the service-role Supabase client used by the helper.
const makeAdmin = ({
  cached,
  onUpsert,
}: {
  cached?: string;
  onUpsert?: (row: Record<string, unknown>) => void;
}) => ({
  from: () => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: cached ? { transcript: cached } : null,
            error: null,
          }),
        }),
      }),
    }),
    upsert: async (row: Record<string, unknown>) => {
      onUpsert?.(row);
      return { error: null };
    },
  }),
});

Deno.test('getOrFetchYoutubeTranscript returns the cached transcript without fetching on a hit', async () => {
  let fetchCalled = false;
  const admin = makeAdmin({
    cached: 'Cached transcript',
    onUpsert: () => {
      throw new Error('Expected no cache write on a hit');
    },
  });
  const fetchImpl: typeof fetch = async () => {
    fetchCalled = true;
    return jsonResponse({});
  };

  const transcript = await getOrFetchYoutubeTranscript({
    admin,
    youtubeUrl: 'https://youtu.be/demo123',
    fetchImpl,
  });

  assertEquals(transcript, 'Cached transcript', 'Expected the cached transcript to be returned');
  assert(!fetchCalled, 'Expected no live extraction when the cache has the transcript');
});

Deno.test('getOrFetchYoutubeTranscript fetches and writes back on a miss, recording the winning strategy', async () => {
  let upsertRow: Record<string, unknown> | undefined;
  const admin = makeAdmin({
    onUpsert: (row) => {
      upsertRow = row;
    },
  });

  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes('captions.test')) {
      return jsonResponse({ events: [{ segs: [{ utf8: 'Fresh ' }, { utf8: 'transcript' }] }] });
    }
    return jsonResponse({
      captions: {
        playerCaptionsTracklistRenderer: {
          captionTracks: [{ baseUrl: 'https://captions.test/track', languageCode: 'en' }],
        },
      },
    });
  };

  const transcript = await getOrFetchYoutubeTranscript({
    admin,
    youtubeUrl: 'https://youtu.be/demo123',
    fetchImpl,
    getSubtitlesImpl: async () => [],
  });

  assertEquals(transcript, 'Fresh transcript', 'Expected the freshly fetched transcript');
  assertEquals(upsertRow?.video_id, 'demo123', 'Expected the cache to be keyed by video id');
  assertEquals(upsertRow?.transcript, 'Fresh transcript', 'Expected the fetched transcript to be cached');
  assertEquals(upsertRow?.source, 'custom', 'Expected the winning strategy to be recorded for telemetry');
});
