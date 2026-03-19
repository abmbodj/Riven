import { buildSubjectContext } from './aiCore.mjs';

const DEFAULT_DIRECT_CHAR_LIMIT = 18_000;
const DEFAULT_CHUNK_CHAR_LIMIT = 12_000;
const CHUNK_SUMMARY_MAX_TOKENS = 900;
const MERGE_SUMMARY_MAX_TOKENS = 1_400;
const TIGHTEN_SUMMARY_MAX_TOKENS = 1_000;

type ProgressStep = 'summarizing' | 'merging' | 'tightening';

type TranscriptPrepProgress = {
  chunkCount: number;
  chunkIndex?: number;
  message: string;
  step: ProgressStep;
};

type PrepareYoutubeTranscriptSourceArgs = {
  transcript: string;
  className?: string | null;
  directCharLimit?: number;
  chunkCharLimit?: number;
  generateText: (prompt: string, maxTokens: number) => Promise<string>;
  onProgress?: (update: TranscriptPrepProgress) => Promise<void> | void;
};

const normalizeTranscriptText = (text: string) => (
  String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
);

const splitByWords = (text: string, maxChars: number) => {
  const words = text.split(/\s+/u).filter(Boolean);
  const segments: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxChars) {
      if (current) {
        segments.push(current);
        current = '';
      }

      for (let index = 0; index < word.length; index += maxChars) {
        segments.push(word.slice(index, index + maxChars));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) segments.push(current);
      current = word;
    }
  }

  if (current) segments.push(current);
  return segments;
};

const packSegments = (segments: string[], maxChars: number): string[] => {
  const chunks: string[] = [];
  let current = '';

  for (const rawSegment of segments) {
    const segment = normalizeTranscriptText(rawSegment);
    if (!segment) continue;

    if (segment.length > maxChars) {
      const smallerSegments = segment
        .split(/(?<=[.!?])\s+/u)
        .map((part) => part.trim())
        .filter(Boolean);

      if (smallerSegments.length <= 1) {
        const wordChunks = splitByWords(segment, maxChars);
        for (const wordChunk of wordChunks) {
          if (current) {
            chunks.push(current);
            current = '';
          }
          chunks.push(wordChunk);
        }
        continue;
      }

      const nestedChunks = packSegments(smallerSegments, maxChars);
      for (const nestedChunk of nestedChunks) {
        if (current) {
          chunks.push(current);
          current = '';
        }
        chunks.push(nestedChunk);
      }
      continue;
    }

    const separator = current.includes('\n') || segment.includes('\n') ? '\n\n' : ' ';
    const next = current ? `${current}${separator}${segment}` : segment;

    if (next.length <= maxChars) {
      current = next;
    } else {
      if (current) chunks.push(current);
      current = segment;
    }
  }

  if (current) chunks.push(current);
  return chunks;
};

export const splitTranscriptIntoChunks = (
  transcript: string,
  maxChars = DEFAULT_CHUNK_CHAR_LIMIT,
) => {
  const normalized = normalizeTranscriptText(transcript);
  if (!normalized) return [];

  const paragraphs = normalized
    .split(/\n{2,}/u)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return packSegments([normalized], maxChars);
  }

  return packSegments(paragraphs, maxChars);
};

const buildChunkSummaryPrompt = ({
  className,
  chunk,
  chunkCount,
  chunkIndex,
}: {
  className?: string | null;
  chunk: string;
  chunkCount: number;
  chunkIndex: number;
}) => `You are compressing one segment of an educational YouTube transcript into a compact study brief.

${buildSubjectContext(className ?? undefined)}

Rules:
- This is one segment from a larger video. Keep only high-value learning content.
- Preserve critical facts, definitions, formulas, dates, names, and ordered steps.
- Drop filler, repetition, sponsor chatter, greetings, and outro material.
- Output plain text only.
- Use short headings and concise bullets.
- Keep the result under 220 words.
- Do not mention chunk numbers or missing context.

Transcript segment ${chunkIndex} of ${chunkCount}:
${chunk}`;

const buildMergeSummaryPrompt = ({
  className,
  summaries,
}: {
  className?: string | null;
  summaries: string[];
}) => `You are combining condensed transcript briefs from one educational YouTube video into a single reusable source brief.

${buildSubjectContext(className ?? undefined)}

Rules:
- Merge overlapping points and remove repetition.
- Preserve important facts, definitions, formulas, dates, names, and step order.
- Output plain text only.
- Use short headings with dense bullets.
- Keep the result under 900 words.
- Produce a source brief that is detailed enough for flashcards, study guides, exams, and notes.

Condensed transcript briefs:
${summaries.map((summary, index) => `Section ${index + 1}:\n${summary}`).join('\n\n')}`;

const buildTightenSummaryPrompt = ({
  className,
  summary,
}: {
  className?: string | null;
  summary: string;
}) => `You are tightening a reusable study brief so it fits within a smaller AI context window without losing important learning content.

${buildSubjectContext(className ?? undefined)}

Rules:
- Preserve critical facts, formulas, names, dates, definitions, and step order.
- Remove repetition and low-value detail.
- Output plain text only.
- Use compact headings and bullets.
- Keep the result under 700 words.

Study brief:
${summary}`;

export const prepareYoutubeTranscriptSource = async ({
  transcript,
  className,
  directCharLimit = DEFAULT_DIRECT_CHAR_LIMIT,
  chunkCharLimit = DEFAULT_CHUNK_CHAR_LIMIT,
  generateText,
  onProgress,
}: PrepareYoutubeTranscriptSourceArgs) => {
  const normalizedTranscript = normalizeTranscriptText(transcript);

  if (normalizedTranscript.length <= directCharLimit) {
    return {
      chunkCount: 1,
      sourceText: normalizedTranscript,
      wasCompacted: false,
    };
  }

  const chunks = splitTranscriptIntoChunks(normalizedTranscript, chunkCharLimit);
  const chunkSummaries: string[] = [];

  for (const [index, chunk] of chunks.entries()) {
    await onProgress?.({
      chunkCount: chunks.length,
      chunkIndex: index + 1,
      message: `Condensing transcript segment ${index + 1} of ${chunks.length}`,
      step: 'summarizing',
    });

    const summary = normalizeTranscriptText(
      await generateText(
        buildChunkSummaryPrompt({
          className,
          chunk,
          chunkCount: chunks.length,
          chunkIndex: index + 1,
        }),
        CHUNK_SUMMARY_MAX_TOKENS,
      ),
    );

    if (!summary) {
      throw new Error('AI returned an empty transcript segment summary.');
    }

    chunkSummaries.push(summary);
  }

  await onProgress?.({
    chunkCount: chunks.length,
    message: 'Combining condensed transcript segments',
    step: 'merging',
  });

  let sourceText = normalizeTranscriptText(
    await generateText(
      buildMergeSummaryPrompt({
        className,
        summaries: chunkSummaries,
      }),
      MERGE_SUMMARY_MAX_TOKENS,
    ),
  );

  if (!sourceText) {
    throw new Error('AI returned an empty consolidated transcript summary.');
  }

  if (sourceText.length > directCharLimit) {
    await onProgress?.({
      chunkCount: chunks.length,
      message: 'Tightening condensed transcript summary',
      step: 'tightening',
    });

    sourceText = normalizeTranscriptText(
      await generateText(
        buildTightenSummaryPrompt({
          className,
          summary: sourceText,
        }),
        TIGHTEN_SUMMARY_MAX_TOKENS,
      ),
    );

    if (!sourceText) {
      throw new Error('AI returned an empty tightened transcript summary.');
    }
  }

  return {
    chunkCount: chunks.length,
    sourceText,
    wasCompacted: true,
  };
};
