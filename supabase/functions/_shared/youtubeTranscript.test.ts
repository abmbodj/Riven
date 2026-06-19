import {
  fetchTranscriptViaCaptionExtractor,
  fetchTranscriptViaCustomStrategy,
  fetchYoutubeTranscriptWithDeps,
  parseJson3Transcript,
  selectCaptionTrack,
} from './youtubeTranscript.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

const expectReject = async (
  operation: () => Promise<unknown>,
  expectedMessage: string,
) => {
  try {
    await operation();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert(
      message.includes(expectedMessage),
      `Expected rejection to include "${expectedMessage}", received "${message}"`,
    );
    return;
  }

  throw new Error(`Expected operation to reject with "${expectedMessage}"`);
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const htmlResponse = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html' },
  });

const withTranscriptApiKey = async (operation: () => Promise<void>) => {
  const previous = Deno.env.get('TRANSCRIPTAPI_KEY');
  Deno.env.set('TRANSCRIPTAPI_KEY', 'test-transcriptapi-key');

  try {
    await operation();
  } finally {
    if (previous === undefined) {
      Deno.env.delete('TRANSCRIPTAPI_KEY');
    } else {
      Deno.env.set('TRANSCRIPTAPI_KEY', previous);
    }
  }
};

Deno.test('selectCaptionTrack prefers manual captions over auto-generated captions for the requested language', () => {
  const selected = selectCaptionTrack([
    { baseUrl: 'https://captions.test/auto', languageCode: 'en', kind: 'asr' },
    { baseUrl: 'https://captions.test/manual', languageCode: 'en' },
  ], 'en');

  assertEquals(
    selected,
    { baseUrl: 'https://captions.test/manual', languageCode: 'en' },
    'Expected the manual caption track to be selected first',
  );
});

Deno.test('fetchTranscriptViaCustomStrategy falls back to auto-generated English captions when that is the only available track', async () => {
  let callCount = 0;
  const fetchImpl: typeof fetch = async () => {
    callCount += 1;

    if (callCount === 1) {
      return jsonResponse({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              { baseUrl: 'https://captions.test/track', languageCode: 'en', kind: 'asr' },
            ],
          },
        },
      });
    }

    return jsonResponse({
      events: [
        { segs: [{ utf8: 'Auto\n' }, { utf8: 'generated' }] },
        { segs: [{ utf8: ' captions ' }] },
      ],
    });
  };

  const transcript = await fetchTranscriptViaCustomStrategy('demo123', 'fr', fetchImpl);

  assertEquals(
    transcript,
    'Auto generated captions',
    'Expected the custom strategy to read the auto-generated English caption track',
  );
});

Deno.test('parseJson3Transcript normalizes whitespace and removes empty segments', () => {
  const lines = parseJson3Transcript({
    events: [
      { segs: [{ utf8: 'Hello\n' }, { utf8: 'world' }] },
      {},
      { segs: [{ utf8: ' ' }] },
      { segs: [{ utf8: 'Again' }] },
    ],
  });

  assertEquals(lines, ['Hello world', 'Again'], 'Expected json3 transcript parsing to normalize text');
});

Deno.test('fetchTranscriptViaCaptionExtractor normalizes subtitle text returned by the fallback extractor', async () => {
  const transcript = await fetchTranscriptViaCaptionExtractor(
    'demo123',
    'en',
    async ({ videoID, lang }: { videoID: string; lang?: string }) => {
      assertEquals(videoID, 'demo123', 'Expected the fallback extractor to receive the video ID');
      assertEquals(lang, 'en', 'Expected the fallback extractor to receive the requested language');
      return [
        { text: 'Fallback ' },
        { text: '\ncaption' },
        { text: ' extractor' },
      ];
    },
  );

  assertEquals(
    transcript,
    'Fallback caption extractor',
    'Expected fallback subtitles to be normalized into a flat transcript string',
  );
});

Deno.test('fetchYoutubeTranscriptWithDeps uses custom captions before TranscriptAPI when both are configured', async () => {
  await withTranscriptApiKey(async () => {
    let transcriptApiCalls = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.includes('transcriptapi.com')) {
        transcriptApiCalls += 1;
        return jsonResponse({ segments: [{ text: 'Paid transcript should not be used' }] });
      }

      if (url.includes('captions.test')) {
        return jsonResponse({
          events: [
            { segs: [{ utf8: 'Custom ' }, { utf8: 'captions' }] },
          ],
        });
      }

      return jsonResponse({
        captions: {
          playerCaptionsTracklistRenderer: {
            captionTracks: [
              { baseUrl: 'https://captions.test/track', languageCode: 'en' },
            ],
          },
        },
      });
    };

    const transcript = await fetchYoutubeTranscriptWithDeps(
      'https://youtu.be/demo123',
      'en',
      {
        fetchImpl,
        getSubtitlesImpl: async () => [{ text: 'Package fallback should not be used' }],
        logger: { warn: () => {} },
      },
    );

    assertEquals(transcript, 'Custom captions', 'Expected the free custom caption strategy to win');
    assertEquals(transcriptApiCalls, 0, 'Expected TranscriptAPI not to be called after custom captions succeed');
  });
});

Deno.test('fetchYoutubeTranscriptWithDeps falls back to the package extractor when the custom caption strategies return no tracks', async () => {
  await withTranscriptApiKey(async () => {
    let transcriptApiCalls = 0;
    let fetchCallCount = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.includes('transcriptapi.com')) {
        transcriptApiCalls += 1;
        return jsonResponse({ segments: [{ text: 'Paid transcript should not be used' }] });
      }

      fetchCallCount += 1;

      if (fetchCallCount < 3) {
        return jsonResponse({});
      }

      return htmlResponse('<html><body>No captions here</body></html>');
    };

    const transcript = await fetchYoutubeTranscriptWithDeps(
      'https://youtu.be/demo123',
      'en',
      {
        fetchImpl,
        getSubtitlesImpl: async () => [{ text: 'Recovered transcript' }],
        logger: { warn: () => {} },
      },
    );

    assertEquals(
      transcript,
      'Recovered transcript',
      'Expected the package-backed extractor to recover when custom caption discovery fails',
    );
    assertEquals(transcriptApiCalls, 0, 'Expected TranscriptAPI not to be called after package fallback succeeds');
  });
});

Deno.test('fetchYoutubeTranscriptWithDeps uses TranscriptAPI only after free transcript strategies fail', async () => {
  await withTranscriptApiKey(async () => {
    let transcriptApiCalls = 0;
    let fetchCallCount = 0;
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);

      if (url.includes('transcriptapi.com')) {
        transcriptApiCalls += 1;
        return jsonResponse({ segments: [{ text: 'TranscriptAPI fallback ' }, { text: 'transcript' }] });
      }

      fetchCallCount += 1;

      if (fetchCallCount < 3) {
        return jsonResponse({});
      }

      return htmlResponse('<html><body>No captions here</body></html>');
    };

    const transcript = await fetchYoutubeTranscriptWithDeps(
      'https://youtu.be/demo123',
      'en',
      {
        fetchImpl,
        getSubtitlesImpl: async () => [],
        logger: { warn: () => {} },
      },
    );

    assertEquals(transcript, 'TranscriptAPI fallback transcript', 'Expected TranscriptAPI to recover after free providers fail');
    assertEquals(transcriptApiCalls, 1, 'Expected TranscriptAPI to be called exactly once as the final fallback');
  });
});

Deno.test('fetchYoutubeTranscriptWithDeps throws a generic error when all transcript strategies fail', async () => {
  const loggerCalls: unknown[] = [];
  let fetchCallCount = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);

    if (url.includes('transcriptapi.com')) {
      return jsonResponse({ segments: [] });
    }

    fetchCallCount += 1;

    if (fetchCallCount < 3) {
      return jsonResponse({});
    }

    return htmlResponse('<html><body>No captions here</body></html>');
  };

  await expectReject(
    () => fetchYoutubeTranscriptWithDeps('https://youtu.be/demo123', 'en', {
      fetchImpl,
      getSubtitlesImpl: async () => [],
      logger: { warn: (...args: unknown[]) => loggerCalls.push(args) },
    }),
    'Failed to fetch YouTube transcript. The video may not have captions available.',
  );

  assert(loggerCalls.length === 1, 'Expected transcript strategy failures to be logged once');
  const loggedArgs = loggerCalls[0] as unknown[] | undefined;
  const loggedDetails = loggedArgs?.[1] as { strategyErrors?: string[] } | undefined;
  assertEquals(
    loggedDetails?.strategyErrors?.map((entry) => entry.split(':')[0]),
    ['custom', 'caption-extractor', 'transcriptapi'],
    'Expected strategy failures to be logged in provider attempt order',
  );
});
