import {
  prepareYoutubeTranscriptSource,
  splitTranscriptIntoChunks,
} from './youtubeTranscriptPrep.ts';

const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};

const assertEquals = (actual: unknown, expected: unknown, message: string) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
};

const squashWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

Deno.test('splitTranscriptIntoChunks preserves transcript content while respecting the chunk limit', () => {
  const transcript = [
    'Alpha explains the first concept in detail. It adds one more sentence for context.',
    'Beta covers a second concept and introduces an ordered process. It stays concise.',
    'Gamma closes with a final explanation and one extra sentence to force splitting.',
  ].join('\n\n');

  const chunks = splitTranscriptIntoChunks(transcript, 70);

  assert(chunks.length >= 3, 'Expected the transcript to be split into multiple chunks');
  assert(chunks.every((chunk) => chunk.length <= 70), 'Expected every chunk to respect the requested limit');
  assertEquals(
    squashWhitespace(chunks.join(' ')),
    squashWhitespace(transcript),
    'Expected chunking to preserve transcript text content',
  );
});

Deno.test('prepareYoutubeTranscriptSource skips AI compaction when the transcript is already short', async () => {
  let callCount = 0;

  const result = await prepareYoutubeTranscriptSource({
    transcript: 'Short transcript with only a few words.',
    generateText: async () => {
      callCount += 1;
      return 'unused';
    },
    directCharLimit: 200,
  });

  assertEquals(callCount, 0, 'Expected short transcripts to bypass AI compaction entirely');
  assertEquals(result.wasCompacted, false, 'Expected the helper to report no compaction');
  assertEquals(result.sourceText, 'Short transcript with only a few words.', 'Expected the original transcript to pass through');
});

Deno.test('prepareYoutubeTranscriptSource skips AI compaction under the default 60k direct limit', async () => {
  let callCount = 0;
  const transcript = 'x'.repeat(59_500);

  const result = await prepareYoutubeTranscriptSource({
    transcript,
    generateText: async () => {
      callCount += 1;
      return 'unused';
    },
  });

  assertEquals(callCount, 0, 'Expected transcripts under 60k chars to bypass AI compaction by default');
  assertEquals(result.wasCompacted, false, 'Expected the helper to report no compaction');
  assertEquals(result.sourceText.length, transcript.length, 'Expected the full transcript to pass through');
});

Deno.test('prepareYoutubeTranscriptSource summarizes oversized transcripts chunk-by-chunk before merging', async () => {
  const transcript = [
    'Segment one has enough detail to force chunking and includes several factual statements.',
    'Segment two continues the lesson with definitions, examples, and extra wording.',
    'Segment three finishes the topic and adds more explanation to stay over the limit.',
  ].join('\n\n');
  const chunks = splitTranscriptIntoChunks(transcript, 60);
  const prompts: string[] = [];

  const result = await prepareYoutubeTranscriptSource({
    transcript,
    chunkCharLimit: 60,
    directCharLimit: 100,
    generateText: async (prompt) => {
      prompts.push(prompt);
      if (prompt.includes('Transcript segment')) {
        return `summary-${prompts.length}`;
      }
      if (prompt.includes('Condensed transcript briefs')) {
        return 'merged-summary';
      }
      throw new Error(`Unexpected prompt: ${prompt}`);
    },
  });

  assertEquals(
    prompts.length,
    chunks.length + 1,
    'Expected one AI call per chunk plus one merge call',
  );
  assertEquals(result.wasCompacted, true, 'Expected oversized transcripts to be compacted');
  assertEquals(result.chunkCount, chunks.length, 'Expected the helper to report the number of transcript chunks');
  assertEquals(result.sourceText, 'merged-summary', 'Expected the merged summary to be returned');
});

Deno.test('prepareYoutubeTranscriptSource tightens the merged summary when it still exceeds the direct limit', async () => {
  const transcript = [
    'Chunk one is long enough to require summarization.',
    'Chunk two is also long enough to require summarization.',
  ].join('\n\n');
  const chunks = splitTranscriptIntoChunks(transcript, 35);
  const prompts: string[] = [];

  const result = await prepareYoutubeTranscriptSource({
    transcript,
    chunkCharLimit: 35,
    directCharLimit: 20,
    generateText: async (prompt) => {
      prompts.push(prompt);
      if (prompt.includes('Transcript segment')) {
        return 'long summary block';
      }
      if (prompt.includes('Condensed transcript briefs')) {
        return 'this merged summary is still too long';
      }
      if (prompt.includes('Study brief:')) {
        return 'tight summary';
      }
      throw new Error(`Unexpected prompt: ${prompt}`);
    },
  });

  assertEquals(
    prompts.length,
    chunks.length + 2,
    'Expected one extra AI call to tighten an oversized merged summary',
  );
  assertEquals(result.sourceText, 'tight summary', 'Expected the tightened summary to win when needed');
  assertEquals(result.wasCompacted, true, 'Expected the helper to report compaction after tightening');
});

Deno.test('prepareYoutubeTranscriptSource summarizes long transcripts with bounded concurrency', async () => {
  const transcript = Array.from(
    { length: 9 },
    (_, index) => `Segment ${index + 1} has enough content to become its own compacted transcript chunk.`,
  ).join('\n\n');
  let activeCalls = 0;
  let maxActiveCalls = 0;

  const result = await prepareYoutubeTranscriptSource({
    transcript,
    chunkCharLimit: 45,
    directCharLimit: 100,
    chunkConcurrency: 3,
    generateText: async (prompt) => {
      if (prompt.includes('Transcript segment')) {
        activeCalls += 1;
        maxActiveCalls = Math.max(maxActiveCalls, activeCalls);
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeCalls -= 1;
        const match = prompt.match(/Transcript segment (\d+) of/u);
        return `summary-${match?.[1] || 'x'}`;
      }
      if (prompt.includes('Condensed transcript briefs')) {
        return 'merged-summary';
      }
      throw new Error(`Unexpected prompt: ${prompt}`);
    },
  });

  assertEquals(result.wasCompacted, true, 'Expected long transcripts to compact');
  assert(maxActiveCalls > 1, 'Expected more than one chunk summary to run at a time');
  assert(maxActiveCalls <= 3, 'Expected chunk summary concurrency to be bounded at 3');
  assertEquals(result.sourceText, 'merged-summary', 'Expected the merged summary to be returned');
});
