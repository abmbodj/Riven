import {
  buildDeckContents,
  buildExamContents,
  buildGuideContents,
  consumeAiQuota,
  createHttpError,
  assertTutorSessionQuality,
  parseAiJsonResponse,
} from './aiCore.mjs';
import { createAiClient, contentsToMessages, type AiClient, type AiMessage, type AiResponseFormat, type AiStreamChunk } from './aiClient.ts';
import {
  buildMergePrompt,
  buildNoteDraftPrompt,
  buildNoteEnrichPrompt,
  buildSectionNotePrompt,
  buildSinglePassNoteGeneratePrompt,
  buildYoutubeSourcePrompt,
} from './notePrompts.mjs';
import { buildRetryInstruction, validateNoteDoc } from './noteValidator.mjs';
import { buildKnowledgeExtractionPrompt, normalizeKnowledgeLayer, buildKnowledgeContext, mergeMaxTokens } from './noteKnowledge.mjs';
import { getOrFetchYoutubeTranscript } from './youtubeTranscriptCache.ts';
import { prepareYoutubeTranscriptSource } from './youtubeTranscriptPrep.ts';
import {
  DEFAULT_YOUTUBE_NOTES_MODEL,
  buildYoutubeNotesRetryTokenPlan,
  buildYoutubeNotesTokenPlan,
  createSanitizedProviderTokenLimitError,
  isProviderTokenLimitError,
} from './youtubeNotesBudget.ts';
import { reportEdgeException } from './sentry.ts';
import {
  createArrayStreamTracker,
  createDocFromSections,
  createDocStreamTracker,
  createJobReporter,
  extractTextFromTiptapDoc,
  getAiModelMap,
  waitForJobCompletion,
  waitForYoutubeSlot,
} from './aiJobs.ts';
import {
  STUDY_GUIDE_FORMAT_VERSION,
  buildStudyGuideSummaryDoc,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
} from './studyGuideCore.mjs';
import {
  buildEvidenceTranscript,
  buildGroundedClassroomInstruction,
  buildMissingAudioGapSignals,
  buildRecordingAssetEvidence,
  buildSourceSnapshotHash,
  extractExplicitStudySignals,
  resolveClassroomNoteMethod,
} from './audioNotesV2Core.mjs';
import { isRetryableProviderError } from './aiJobRetryCore.mjs';
import { transcribeDeepgramRecording } from './deepgramBatchCore.mjs';

type JobProcessorArgs = {
  admin: any;
  job: any;
};

const generateNotesForSection = async ({
  ai,
  section,
  totalSections,
  userNotesSnapshot,
  className,
  subject,
  modelMap,
  groundingContext,
}: {
  ai: AiClient;
  section: AudioSection;
  totalSections: number;
  userNotesSnapshot: string | null;
  className: string | null;
  subject: string | null;
  modelMap: ReturnType<typeof getAiModelMap>;
  groundingContext: string;
}): Promise<unknown> => {
  const placeholder = {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text: '[This section could not be processed]' }],
    }],
  };

  try {
    const prompt = buildSectionNotePrompt(section.index, totalSections, userNotesSnapshot, className, subject, section.text);
    const rawText = await generateWithFallback({
      ai,
      primaryModel: modelMap.draft,
      fallbackModel: modelMap.final,
      messages: [{
        role: 'user',
        content: `${prompt}\n\n${groundingContext}\n\nSection Transcript:\n${section.text}`,
      }],
      responseFormat: 'json_object',
      maxTokens: 4096,
    });
    return parseAiJsonResponse(rawText, 'Invalid section notes format');
  } catch (err) {
    console.warn(`[audio-sections] Section ${section.index} failed:`, err instanceof Error ? err.message : err);
    return placeholder;
  }
};


const shouldFallbackToFinalModel = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('model')
    || message.includes('not found')
    || message.includes('unsupported')
    || message.includes('deprecated')
    || message.includes('decommissioned')
    || message.includes('retired');
};

export const streamWithFallback = async function* ({
  ai,
  primaryModel,
  fallbackModel,
  messages,
  maxTokens,
}: {
  ai: AiClient;
  primaryModel: string;
  fallbackModel: string;
  messages: AiMessage[];
  maxTokens: number;
}): AsyncGenerator<AiStreamChunk> {
  let emittedContent = false;

  try {
    for await (const chunk of ai.streamContent({ model: primaryModel, messages, maxTokens })) {
      emittedContent = true;
      yield chunk;
    }
  } catch (error) {
    // Once content has reached the caller we cannot safely blend a replacement stream into the
    // partial JSON response. Before the first chunk, retrying is safe and covers model-retirement
    // errors that only surface when the provider begins consuming the stream.
    if (!emittedContent && primaryModel !== fallbackModel && shouldFallbackToFinalModel(error)) {
      yield* ai.streamContent({ model: fallbackModel, messages, maxTokens });
      return;
    }
    throw error;
  }
};

const generateWithFallback = async ({
  ai,
  primaryModel,
  fallbackModel,
  messages,
  responseFormat,
  maxTokens,
}: {
  ai: AiClient;
  primaryModel: string;
  fallbackModel: string;
  messages: AiMessage[];
  responseFormat?: AiResponseFormat;
  maxTokens?: number;
}) => {
  try {
    return await ai.generateContent({ model: primaryModel, messages, responseFormat, maxTokens });
  } catch (error) {
    if (primaryModel !== fallbackModel && shouldFallbackToFinalModel(error)) {
      return ai.generateContent({ model: fallbackModel, messages, responseFormat, maxTokens });
    }
    throw error;
  }
};

const getAudioMimeType = (audioPath: string) => {
  const ext = audioPath.split('.').pop()?.toLowerCase() ?? 'webm';
  const mimeMap: Record<string, string> = {
    webm: 'audio/webm',
    ogg: 'audio/ogg',
    mp4: 'audio/mp4',
    mpeg: 'audio/mpeg',
    mp3: 'audio/mpeg',
    aac: 'audio/aac',
    m4a: 'audio/m4a',
  };
  return mimeMap[ext] || 'audio/webm';
};

type AudioSegment = { id: number | string; start: number; end: number; text: string };
type AudioSection = { index: number; text: string; startTime: number; endTime: number };

const transcriptCoverageEndsAtMs = (rows: any[]) => rows.reduce(
  (latest, row) => Math.max(latest, Number(row?.ended_at_ms || 0)),
  0,
);

const recoverDurableRecordingTranscript = async ({
  admin,
  recordingSession,
  chunkRows,
  existingRows,
  className,
  subject,
}: {
  admin: any;
  recordingSession: any;
  chunkRows: any[];
  existingRows: any[];
  className: string | null;
  subject: string | null;
}) => {
  const expectedDurationMs = Math.max(
    Number(recordingSession?.duration_ms || 0),
    ...chunkRows.map((chunk) => Number(chunk?.ended_at_ms || 0)),
  );
  if (existingRows.length
    && expectedDurationMs > 0
    && transcriptCoverageEndsAtMs(existingRows) >= Math.max(0, expectedDurationMs - 10_000)) {
    return null;
  }
  if (!chunkRows.length) return null;

  const orderedChunks = [...chunkRows].sort((left, right) => Number(left.sequence) - Number(right.sequence));
  const rawLinear16 = chunkRows.every((chunk) => chunk.mime_type === 'application/octet-stream');
  const mimeType = rawLinear16 ? 'application/octet-stream' : String(chunkRows[0]?.mime_type || 'audio/webm');
  let nextChunkIndex = 0;
  // Stream sequentially from Storage into Deepgram. A four-hour native PCM lecture
  // can be hundreds of MB, so constructing one in-memory Blob would exceed an Edge
  // Function's memory limit precisely when offline recovery is needed most.
  const audioStream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (nextChunkIndex >= orderedChunks.length) {
        controller.close();
        return;
      }
      const chunk = orderedChunks[nextChunkIndex];
      nextChunkIndex += 1;
      const { data, error } = await admin.storage.from('recording-chunks').download(chunk.storage_path);
      if (error || !data) {
        controller.error(error || createHttpError('A durable audio chunk could not be recovered.', 503));
        return;
      }
      controller.enqueue(new Uint8Array(await data.arrayBuffer()));
    },
  });
  const languageConfig = recordingSession?.language_config || {};
  const languages = [languageConfig.primary || 'en', ...(languageConfig.secondary || [])];
  let memoryTerms: any[] = [];
  if (recordingSession?.class_id) {
    const { data, error } = await admin
      .from('class_memory_terms')
      .select('term, corrected_form, speaker_role')
      .eq('class_id', recordingSession.class_id)
      .eq('user_id', recordingSession.user_id)
      .order('confirmed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    memoryTerms = data || [];
  }

  const recovered = await transcribeDeepgramRecording({
    apiKey: Deno.env.get('DEEPGRAM_API_KEY') || '',
    audio: audioStream,
    mimeType,
    languages,
    keyterms: [
      className,
      subject,
      ...memoryTerms.flatMap((term) => [term.corrected_form, term.term]),
    ].filter(Boolean),
    rawLinear16,
  });

  const corrections = existingRows.filter((row) => row.corrected_text || row.speaker_role);
  return recovered.segments.map((segment: any) => {
    const startedAtMs = Math.round(segment.start * 1000);
    const endedAtMs = Math.round(segment.end * 1000);
    let text = segment.text;
    let speakerRole = null;
    for (const correction of corrections) {
      const overlaps = Number(correction.ended_at_ms || 0) >= startedAtMs
        && Number(correction.started_at_ms || 0) <= endedAtMs;
      if (!overlaps) continue;
      const original = String(correction.original_text || '').trim();
      const corrected = String(correction.corrected_text || '').trim();
      if (original && corrected && text.includes(original)) text = text.replace(original, corrected);
      if (correction.speaker_role) speakerRole = correction.speaker_role;
    }
    return {
      provider_segment_id: segment.id,
      started_at_ms: startedAtMs,
      ended_at_ms: endedAtMs,
      source: 'replay',
      speaker_key: segment.speaker,
      speaker_role: speakerRole,
      language_code: segment.language,
      confidence: segment.confidence,
      original_text: text,
      corrected_text: null,
      revision: 1,
      is_deleted: false,
    };
  });
};

// Bias Whisper toward the lecture's domain vocabulary / proper nouns so technical terms
// and names transcribe correctly instead of being mangled.
const buildTranscriptionBiasPrompt = (
  className: string | null,
  subject: string | null,
): string => {
  const parts: string[] = [];
  if (className) parts.push(`Lecture for the class "${className}".`);
  if (subject) parts.push(`Subject area: ${subject}.`);
  parts.push('Expect domain-specific terminology, technical vocabulary, and proper nouns.');
  return parts.join(' ');
};

const NOTE_FIDELITY_RETRY_SEVERITY = 4;
const YOUTUBE_NOTES_MODEL = Deno.env.get('AI_YOUTUBE_NOTES_MODEL') || DEFAULT_YOUTUBE_NOTES_MODEL;
const YOUTUBE_DIRECT_TRANSCRIPT_LIMIT = 60_000;

// One corrective pass if the generated note drifts from what was actually said (or breaks the
// content contract). Runs after the preview is already shown, so it never adds perceived latency.
const SOURCE_BLOCK_LABELS: Record<string, string> = {
  audio: 'Lecture Audio Transcription',
  video: 'Video Transcript',
  notes: 'Source Notes',
};

const ensureNoteFidelity = async ({
  ai,
  finalDoc,
  transcription,
  userNotesSnapshot,
  className,
  subject,
  modelMap,
  sourceKind = 'audio',
}: {
  ai: AiClient;
  finalDoc: unknown;
  transcription: string;
  userNotesSnapshot: string | null;
  className: string | null;
  subject: string | null;
  modelMap: ReturnType<typeof getAiModelMap>;
  sourceKind?: 'audio' | 'video' | 'notes';
}): Promise<unknown> => {
  if (!finalDoc || typeof finalDoc !== 'object' || (finalDoc as Record<string, unknown>).type !== 'doc') {
    return finalDoc;
  }

  // Text-only enhancement passes an empty transcript: the hallucination check is skipped
  // (the model legitimately adds detail to sparse notes) while structure/contract checks run.
  const validation = validateNoteDoc(finalDoc, { className, subject, transcript: transcription });
  if (validation.ok || validation.severity < NOTE_FIDELITY_RETRY_SEVERITY) {
    return finalDoc;
  }

  const sourceBlock = transcription
    ? `\n\n${SOURCE_BLOCK_LABELS[sourceKind] ?? SOURCE_BLOCK_LABELS.audio}:\n${transcription}`
    : '';

  try {
    const retryText = await generateWithFallback({
      ai,
      primaryModel: modelMap.final,
      fallbackModel: modelMap.final,
      messages: [
        {
          role: 'user',
          content: `${buildNoteEnrichPrompt(userNotesSnapshot, className, finalDoc, subject, transcription, { sourceKind })}${sourceBlock}`,
        },
        { role: 'assistant', content: JSON.stringify(finalDoc) },
        { role: 'user', content: buildRetryInstruction(validation) },
      ],
      responseFormat: 'json_object',
      maxTokens: 8192,
    });
    const retried = parseAiJsonResponse(retryText, 'Retry produced invalid JSON');
    if (retried && typeof retried === 'object' && (retried as Record<string, unknown>).type === 'doc') {
      const retriedValidation = validateNoteDoc(retried, { className, subject, transcript: transcription });
      if (retriedValidation.severity < validation.severity) {
        return retried;
      }
    }
  } catch (retryErr) {
    console.warn('[note_enhancement] fidelity retry failed, keeping original output', retryErr);
  }

  return finalDoc;
};

// Builds the structured knowledge layer once, from the finished (deduped) note + the
// transcript. Runs on the stronger `final` model. Reads the bounded merged note rather than
// re-chunking the transcript, so it scales to 90+ min lectures. Failure is non-fatal: the
// note still saves with knowledge_layer = null.
const extractKnowledgeLayer = async ({
  ai,
  finalDoc,
  transcription,
  className,
  subject,
  modelMap,
}: {
  ai: AiClient;
  finalDoc: unknown;
  transcription: string;
  className: string | null;
  subject: string | null;
  modelMap: ReturnType<typeof getAiModelMap>;
}): Promise<unknown> => {
  if (!finalDoc || typeof finalDoc !== 'object' || (finalDoc as Record<string, unknown>).type !== 'doc') {
    return null;
  }
  try {
    const rawText = await generateWithFallback({
      ai,
      primaryModel: modelMap.final,
      fallbackModel: modelMap.final,
      messages: [{
        role: 'user',
        content: buildKnowledgeExtractionPrompt(finalDoc, transcription, className, subject, null),
      }],
      responseFormat: 'json_object',
      maxTokens: 8192,
    });
    const parsed = parseAiJsonResponse(rawText, 'Knowledge extraction produced invalid JSON');
    return normalizeKnowledgeLayer(parsed);
  } catch (err) {
    console.warn('[note_enhancement] knowledge-layer extraction failed, storing null', err);
    return null;
  }
};

const groupSegmentsIntoSections = (
  segments: AudioSegment[],
  targetDurationSecs = 300,
): AudioSection[] => {
  if (segments.length === 0) return [];

  const sections: AudioSection[] = [];
  let currentSegments: AudioSegment[] = [];
  let sectionStart = segments[0].start;

  for (const seg of segments) {
    currentSegments.push(seg);
    const elapsed = seg.end - sectionStart;
    if (elapsed >= targetDurationSecs) {
      sections.push({
        index: sections.length,
        text: currentSegments.map((s) => s.text).join(' '),
        startTime: sectionStart,
        endTime: seg.end,
      });
      currentSegments = [];
      sectionStart = seg.end;
    }
  }

  // Flush remaining segments
  if (currentSegments.length > 0) {
    sections.push({
      index: sections.length,
      text: currentSegments.map((s) => s.text).join(' '),
      startTime: sectionStart,
      endTime: currentSegments[currentSegments.length - 1].end,
    });
  }

  return sections;
};

const processConcurrently = async <T>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<void>,
): Promise<void> => {
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    await Promise.allSettled(
      batch.map((item, batchIndex) => fn(item, i + batchIndex)),
    );
  }
};

const streamDocPreview = async ({
  ai,
  model,
  fallbackModel,
  messages,
  reporter,
  phase,
  startPercent,
  endPercent,
  message,
  resultKey = 'preview_doc',
  maxTokens = 6144,
}: {
  ai: AiClient;
  model: string;
  fallbackModel: string;
  messages: AiMessage[];
  reporter: ReturnType<typeof createJobReporter>;
  phase: string;
  startPercent: number;
  endPercent: number;
  message: string;
  resultKey?: string;
  maxTokens?: number;
}) => {
  let firstPreviewAt: number | null = null;
  const tracker = createDocStreamTracker(async (node, index) => {
    if (firstPreviewAt == null) {
      firstPreviewAt = Date.now();
    }

    const sections = tracker.getSections();
    const previewDoc = createDocFromSections(sections);
    const progressPercent = Math.min(endPercent, startPercent + Math.min(index + 1, 6) * 6);

    await reporter.markStreaming(phase, progressPercent, message, {
      [resultKey]: previewDoc,
      preview_sections: sections,
      preview_text: extractTextFromTiptapDoc(previewDoc),
    });
  });

  const streamResponse = await streamWithFallback({
    ai,
    primaryModel: model,
    fallbackModel,
    messages,
    maxTokens,
  });

  let fullText = '';
  for await (const chunk of streamResponse) {
    const text = chunk.text ?? '';
    if (!text) continue;
    fullText += text;
    tracker.feed(text);
  }

  const doc = parseAiJsonResponse(fullText, 'AI generated invalid notes format. Please try again.');
  return {
    doc,
    firstPreviewAt,
  };
};

const streamArrayPreview = async ({
  ai,
  model,
  fallbackModel,
  messages,
  reporter,
  phase,
  startPercent,
  endPercent,
  message,
  maxTokens = 4096,
}: {
  ai: AiClient;
  model: string;
  fallbackModel: string;
  messages: AiMessage[];
  reporter: ReturnType<typeof createJobReporter>;
  phase: string;
  startPercent: number;
  endPercent: number;
  message: string;
  maxTokens?: number;
}) => {
  let firstPreviewAt: number | null = null;
  const tracker = createArrayStreamTracker(async (_item, index) => {
    if (firstPreviewAt == null) {
      firstPreviewAt = Date.now();
    }

    const items = tracker.getItems();
    const progressPercent = Math.min(endPercent, startPercent + Math.min(index + 1, 8) * 5);
    await reporter.markStreaming(phase, progressPercent, message, {
      preview_items: items,
    });
  });

  const streamResponse = await streamWithFallback({
    ai,
    primaryModel: model,
    fallbackModel,
    messages,
    maxTokens,
  });

  let fullText = '';
  for await (const chunk of streamResponse) {
    const text = chunk.text ?? '';
    if (!text) continue;
    fullText += text;
    tracker.feed(text);
  }

  const items = parseAiJsonResponse(fullText, 'AI generated invalid JSON format. Please try again.');
  return {
    items,
    firstPreviewAt,
  };
};

const createDeck = async ({
  admin,
  userId,
  title,
  classId,
  flashcards,
}: {
  admin: any;
  userId: number;
  title: string;
  classId: string | null | undefined;
  flashcards: Array<{ front: string; back: string }>;
}) => {
  const { data: deck, error: deckError } = await admin
    .from('decks')
    .insert({
      user_id: userId,
      title,
      description: 'Generated from YouTube via AI',
      class_id: classId || null,
    })
    .select('id')
    .single();

  if (deckError) throw deckError;

  const { error: cardsError } = await admin.from('cards').insert(
    flashcards.map((card, index) => ({
      deck_id: deck.id,
      front: card.front,
      back: card.back,
      position: index,
    })),
  );

  if (cardsError) {
    await admin.from('decks').delete().eq('id', deck.id);
    throw cardsError;
  }

  return deck.id;
};

const createGuide = async ({
  admin,
  userId,
  title,
  classId,
  formatVersion,
  guideData,
  studyState,
  content,
}: {
  admin: any;
  userId: number;
  title: string;
  classId: string | null | undefined;
  formatVersion: number;
  guideData: Record<string, unknown>;
  studyState: Record<string, unknown>;
  content: unknown;
}) => {
  const { data, error } = await admin
    .from('study_guides')
    .insert({
      user_id: userId,
      title,
      format_version: formatVersion,
      guide_data: guideData,
      study_state: studyState,
      content,
      note_id: null,
      class_id: classId || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

const createExam = async ({
  admin,
  userId,
  title,
  classId,
  questions,
}: {
  admin: any;
  userId: number;
  title: string;
  classId: string | null | undefined;
  questions: unknown[];
}) => {
  const { data, error } = await admin
    .from('mock_exams')
    .insert({
      user_id: userId,
      title,
      source_type: 'youtube',
      source_id: null,
      class_id: classId || null,
      questions,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

const createNote = async ({
  admin,
  userId,
  title,
  classId,
  content,
}: {
  admin: any;
  userId: number;
  title: string;
  classId: string | null | undefined;
  content: unknown;
}) => {
  const { data, error } = await admin
    .from('notes')
    .insert({
      user_id: userId,
      title,
      content,
      class_id: classId || null,
      source_type: 'import',
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id;
};

const consumeUserAiQuota = async ({
  admin,
  userId,
}: {
  admin: any;
  userId: number;
}) => {
  const { data: quotaUser, error: quotaUserError } = await admin
    .from('users')
    .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier, subscription_expires_at')
    .eq('id', userId)
    .maybeSingle();

  if (quotaUserError) throw quotaUserError;
  if (!quotaUser) throw createHttpError('User not found', 401);

  await consumeAiQuota({
    user: quotaUser,
    persistUsage: async ({ count, lastReset }: { count: number; lastReset: Date }) => {
      const { error: updateError } = await admin
        .from('users')
        .update({
          ai_generations_count: count,
          last_ai_generation_reset: lastReset.toISOString(),
        })
        .eq('id', userId);

      if (updateError) throw updateError;
    },
  });
};

const createYoutubeNote = async ({
  admin,
  userId,
  title,
  classId,
  doc,
  transcript,
  knowledgeLayer,
}: {
  admin: any;
  userId: number;
  title: string;
  classId: string | null | undefined;
  doc: unknown;
  transcript: string;
  knowledgeLayer?: unknown;
}) => {
  const { data: noteData, error: noteError } = await admin
    .from('notes')
    .insert({
      user_id: userId,
      title,
      content: doc,
      enhanced_content: doc,
      transcript,
      polish_status: 'polished',
      class_id: classId || null,
      source_type: 'youtube',
      knowledge_layer: knowledgeLayer ?? null,
    })
    .select('id')
    .single();

  if (noteError) throw noteError;
  return noteData.id;
};

const getCachedYoutubeNotesSource = async ({
  admin,
  userId,
  sourceKey,
  currentJobId,
}: {
  admin: any;
  userId: number;
  sourceKey: string;
  currentJobId: string;
}) => {
  const { data: sourceJob, error: sourceError } = await admin
    .from('ai_jobs')
    .select('id, kind, result_payload, completed_at, created_at')
    .eq('user_id', userId)
    .eq('kind', 'youtube_source')
    .eq('source_key', sourceKey)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sourceError) throw sourceError;

  const sourcePayload = (sourceJob?.result_payload || {}) as Record<string, unknown>;
  if (sourcePayload.source_doc) {
    return {
      cacheKind: 'youtube_source',
      doc: sourcePayload.source_doc,
      title: typeof sourcePayload.title === 'string' ? sourcePayload.title : null,
      sourceText: typeof sourcePayload.source_text === 'string'
        ? sourcePayload.source_text
        : extractTextFromTiptapDoc(sourcePayload.source_doc),
      rawTranscript: typeof sourcePayload.raw_transcript === 'string'
        ? sourcePayload.raw_transcript
        : '',
      knowledgeLayer: sourcePayload.knowledge_layer ?? null,
    };
  }

  const { data: notesJob, error: notesError } = await admin
    .from('ai_jobs')
    .select('id, kind, result_payload, completed_at, created_at')
    .eq('user_id', userId)
    .eq('kind', 'youtube_notes')
    .eq('source_key', sourceKey)
    .eq('status', 'completed')
    .neq('id', currentJobId)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (notesError) throw notesError;

  const notesPayload = (notesJob?.result_payload || {}) as Record<string, unknown>;
  if (notesPayload.final_doc) {
    return {
      cacheKind: 'youtube_notes',
      doc: notesPayload.final_doc,
      title: typeof notesPayload.title === 'string' ? notesPayload.title : null,
      sourceText: typeof notesPayload.source_text === 'string'
        ? notesPayload.source_text
        : extractTextFromTiptapDoc(notesPayload.final_doc),
      rawTranscript: typeof notesPayload.raw_transcript === 'string'
        ? notesPayload.raw_transcript
        : '',
      knowledgeLayer: notesPayload.knowledge_layer ?? null,
    };
  }

  return null;
};

const scheduleBackgroundTask = (task: () => Promise<void>) => {
  const promise = task().catch((error) => {
    console.warn('[ai-job] background task failed', error);
  });
  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => void } }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(promise);
  }
};

const getApiKeyAndClient = () => {
  const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
  if (!apiKey) {
    throw createHttpError('AI integration is not configured on the server.', 500);
  }
  return createAiClient(apiKey);
};

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
};

const analyzeRecordingPhotoSources = async ({
  admin,
  ai,
  assets,
}: {
  admin: any;
  ai: AiClient;
  assets: any[];
}) => {
  const analyzed = [];
  let photoCount = 0;
  for (const asset of assets) {
    if (asset.asset_kind !== 'photo' || asset.extracted_text || photoCount >= 5) {
      analyzed.push(asset);
      continue;
    }
    photoCount += 1;
    try {
      const { data, error } = await admin.storage.from('note-assets').download(asset.storage_path);
      if (error || !data) throw error || new Error('Class photo could not be downloaded');
      if (data.size > 4 * 1024 * 1024) {
        analyzed.push({ ...asset, analysis: { status: 'skipped', reason: 'image_too_large' } });
        continue;
      }
      const base64 = bytesToBase64(new Uint8Array(await data.arrayBuffer()));
      const model = Deno.env.get('AI_VISION_MODEL') || 'qwen/qwen3.6-27b';
      const visibleText = (await ai.generateContent({
        model,
        maxTokens: 2048,
        temperature: 0,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract classroom evidence from this photo. Transcribe every readable word, equation, label, table value, and diagram relationship faithfully. Preserve uncertainty as [unclear]. Do not solve, explain, infer, or add outside facts. Return plain evidence text only.',
            },
            { type: 'image_url', image_url: { url: `data:${asset.mime_type};base64,${base64}` } },
          ],
        }],
      })).trim();
      const analysis = {
        status: visibleText ? 'readable' : 'unreadable',
        model,
        analyzed_at: new Date().toISOString(),
      };
      const { error: updateError } = await admin
        .from('recording_assets')
        .update({ extracted_text: visibleText || null, analysis })
        .eq('id', asset.id);
      if (updateError) throw updateError;
      analyzed.push({ ...asset, extracted_text: visibleText || null, analysis });
    } catch (error) {
      if (isRetryableProviderError(error)) throw error;
      console.warn('[note_enhancement] class photo analysis skipped', error);
      analyzed.push({ ...asset, analysis: { status: 'failed' } });
    }
  }
  return analyzed;
};

// Text-only enhancement: the user typed notes and pressed Enhance without a recording.
// Same two-pass + fidelity + knowledge-layer pipeline as audio, minus transcription and
// sectioning (typed notes are bounded). Grounding for fidelity/knowledge is the user's text.
const processTextEnhancementJob = async ({
  admin,
  job,
  reporter,
  noteId,
  userNotesSnapshot,
  className,
  subject,
}: {
  admin: any;
  job: any;
  reporter: ReturnType<typeof createJobReporter>;
  noteId: string;
  userNotesSnapshot: string;
  titleSnapshot: string;
  className: string | null;
  subject: string | null;
}) => {
  const modelMap = getAiModelMap();
  const ai = getApiKeyAndClient();
  const jobStartedAt = Date.now();
  let firstPreviewAt: number | null = null;

  await reporter.markRunning('accepted', 8, 'Enhancing your notes');

  // ── DRAFT (stream) ──────────────────────────────────────────────────────
  const draftResult = await streamDocPreview({
    ai,
    model: modelMap.draft,
    fallbackModel: modelMap.final,
    messages: [{
      role: 'user',
      content: buildNoteDraftPrompt(userNotesSnapshot, className, subject, userNotesSnapshot, { sourceKind: 'notes' }),
    }],
    reporter,
    phase: 'drafting',
    startPercent: 20,
    endPercent: 64,
    message: 'Drafting enhanced notes',
  });

  const draftDoc = draftResult.doc;
  if (draftResult.firstPreviewAt != null) firstPreviewAt = draftResult.firstPreviewAt;

  await reporter.update('enriching', 70, 'Refining your notes', {
    preview_doc: draftDoc,
    preview_sections: Array.isArray((draftDoc as Record<string, unknown>).content)
      ? (draftDoc as Record<string, unknown>).content
      : [],
    preview_text: extractTextFromTiptapDoc(draftDoc),
  });

  // ── ENRICH (batch) ──────────────────────────────────────────────────────
  let finalDoc: unknown;
  const enrichText = await generateWithFallback({
    ai,
    primaryModel: modelMap.final,
    fallbackModel: modelMap.final,
    messages: [{
      role: 'user',
      content: buildNoteEnrichPrompt(userNotesSnapshot, className, draftDoc, subject, userNotesSnapshot, { sourceKind: 'notes' }),
    }],
    responseFormat: 'json_object',
  });
  try {
    finalDoc = parseAiJsonResponse(enrichText, 'AI generated invalid enhanced notes format. Please try again.');
  } catch {
    finalDoc = draftDoc;
  }

  // Fidelity: structure/contract checks run; transcript-hallucination check is skipped
  // (empty transcript) because the model legitimately adds detail to sparse notes.
  finalDoc = await ensureNoteFidelity({
    ai,
    finalDoc,
    transcription: '',
    userNotesSnapshot,
    className,
    subject,
    modelMap,
    sourceKind: 'notes',
  });

  const knowledgeLayer = await extractKnowledgeLayer({
    ai,
    finalDoc,
    transcription: userNotesSnapshot,
    className,
    subject,
    modelMap,
  });

  await reporter.markSaving('Saving enhanced notes', { final_doc: finalDoc, note_id: noteId });

  const { error: updateError } = await admin
    .from('notes')
    .update({
      enhanced_content: finalDoc,
      content: finalDoc,
      polish_status: 'polished',
      knowledge_layer: knowledgeLayer,
    })
    .eq('id', noteId)
    .eq('user_id', job.user_id);

  if (updateError) throw updateError;

  const persistedAt = new Date().toISOString();

  await reporter.complete({
    message: 'Notes enhanced successfully',
    targetType: 'note',
    targetId: noteId,
    resultPatch: {
      final_doc: finalDoc,
      note_id: noteId,
      note_persisted: true,
      persisted_at: persistedAt,
      metrics: {
        server_total_ms: Date.now() - jobStartedAt,
        first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
        ai_model_stage: { draft: modelMap.draft, final: modelMap.final },
      },
    },
  });
};

const processNoteEnhancementJob = async ({
  admin,
  job,
}: JobProcessorArgs) => {
  const reporter = createJobReporter(admin, job);
  const input = (job.input_payload || {}) as Record<string, unknown>;
  const noteId = String(input.noteId || '');
  const audioPath = String(input.audioPath || '');
  const sessionId = String(input.sessionId || '');
  const userNotesSnapshot = typeof input.userNotesSnapshot === 'string' ? input.userNotesSnapshot : null;
  const titleSnapshot = typeof input.titleSnapshot === 'string' ? input.titleSnapshot : 'Enhanced Notes';
  const className = typeof input.className === 'string' ? input.className : null;
  const subject = typeof input.subject === 'string' ? input.subject : null;

  if (!noteId) {
    throw createHttpError('Note enhancement job is missing a note id.', 400);
  }

  // No audio → text-only enhancement of the user's typed notes (same quality pipeline,
  // minus transcription/sectioning). Empty + no audio is rejected up front.
  if (!audioPath && !sessionId) {
    if (!userNotesSnapshot || !userNotesSnapshot.trim()) {
      throw createHttpError('Add some notes or a recording to enhance.', 400);
    }
    await processTextEnhancementJob({ admin, job, reporter, noteId, userNotesSnapshot, titleSnapshot, className, subject });
    return;
  }

  const modelMap = getAiModelMap();
  const ai = getApiKeyAndClient();
  const jobStartedAt = Date.now();
  let firstPreviewAt: number | null = null;

  await reporter.markRunning('accepted', 5, 'Accepted note enhancement job');
  let transcription = '';
  let segments: AudioSegment[] = [];
  let persistedSegments: unknown[] = [];
  let sourceSnapshotHash: string | null = null;
  let studySignals: Array<Record<string, unknown>> = [];
  let groundedInstruction = '';
  let assetEvidence = '';
  let recordingAssets: any[] = [];
  let classroomMethod = resolveClassroomNoteMethod({ subject: subject || className || '', sessionKind: 'lecture' });

  if (sessionId) {
    await reporter.update('processing_media', 18, 'Preparing timestamped class transcript');
    const [{ data: recordingSession, error: sessionError }, transcriptResult, marksResult, assetsResult, chunksResult] = await Promise.all([
      admin
        .from('recording_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('user_id', job.user_id)
        .maybeSingle(),
      admin
        .from('transcript_segments')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', job.user_id)
        .eq('is_deleted', false)
        .order('started_at_ms', { ascending: true }),
      admin
        .from('recording_marks')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', job.user_id)
        .order('marked_at_ms', { ascending: true }),
      admin
        .from('recording_assets')
        .select('*')
        .eq('session_id', sessionId)
        .eq('user_id', job.user_id)
        .order('captured_at_ms', { ascending: true }),
      admin
        .from('recording_chunks')
        .select('sequence, started_at_ms, ended_at_ms, storage_path, mime_type, upload_state')
        .eq('session_id', sessionId)
        .eq('user_id', job.user_id)
        .eq('upload_state', 'verified')
        .order('sequence', { ascending: true }),
    ]);

    if (sessionError) throw sessionError;
    if (!recordingSession || String(recordingSession.note_id) !== noteId) {
      throw createHttpError('Recording session was not found for this note.', 404);
    }
    if (transcriptResult.error) throw transcriptResult.error;
    if (marksResult.error) throw marksResult.error;
    if (assetsResult.error) throw assetsResult.error;
    if (chunksResult.error) throw chunksResult.error;

    let transcriptRows = transcriptResult.data || [];
    const recoveredTranscriptRows = await recoverDurableRecordingTranscript({
      admin,
      recordingSession,
      chunkRows: chunksResult.data || [],
      existingRows: transcriptRows,
      className,
      subject,
    });
    if (recoveredTranscriptRows?.length) {
      transcriptRows = recoveredTranscriptRows;
      if (!(transcriptResult.data || []).length) {
        const { error: recoveredInsertError } = await admin.from('transcript_segments').upsert(
          recoveredTranscriptRows.map((segment: any) => ({
            ...segment,
            user_id: job.user_id,
            session_id: sessionId,
          })),
          { onConflict: 'session_id,provider_segment_id' },
        );
        if (recoveredInsertError) throw recoveredInsertError;
      }
    }
    if (!transcriptRows.length) {
      throw createHttpError('The recording transcript is not ready yet. Try Enhance again shortly.', 409);
    }

    const assetRows = await analyzeRecordingPhotoSources({
      admin,
      ai,
      assets: assetsResult.data || [],
    });
    recordingAssets = assetRows;
    assetEvidence = buildRecordingAssetEvidence(assetRows);

    transcription = buildEvidenceTranscript(transcriptRows);
    persistedSegments = transcriptRows.map((segment: any) => ({
      id: segment.provider_segment_id,
      start: Number(segment.started_at_ms || 0) / 1000,
      end: Number(segment.ended_at_ms || 0) / 1000,
      text: segment.corrected_text || segment.original_text,
      speaker: segment.speaker_key,
      speakerRole: segment.speaker_role,
      confidence: segment.confidence,
      evidenceRef: segment.provider_segment_id,
    }));
    segments = transcriptRows.map((segment: any) => ({
      id: segment.provider_segment_id,
      start: Number(segment.started_at_ms || 0) / 1000,
      end: Number(segment.ended_at_ms || 0) / 1000,
      text: buildEvidenceTranscript([segment]),
    }));
    sourceSnapshotHash = await buildSourceSnapshotHash({
      segments: transcriptRows,
      jots: userNotesSnapshot || '',
      marks: marksResult.data || [],
      assets: assetRows,
    });
    studySignals = extractExplicitStudySignals(transcriptRows).map((signal: any) => ({
      signal_kind: signal.signalKind,
      title: signal.title,
      body: signal.body,
      severity: signal.severity,
      evidence_refs: signal.evidenceRefs,
      payload: signal.payload,
    }));
    studySignals.push(...buildMissingAudioGapSignals({
      manifestChunkCount: recordingSession.manifest_chunk_count,
      chunks: chunksResult.data || [],
    }).map((signal: any) => ({
      signal_kind: signal.signalKind,
      title: signal.title,
      body: signal.body,
      severity: signal.severity,
      evidence_refs: signal.evidenceRefs,
      payload: signal.payload,
    })));
    for (const mark of marksResult.data || []) {
      studySignals.push({
        signal_kind: 'marked_moment',
        title: mark.label || 'Marked moment',
        body: null,
        severity: 'review',
        evidence_refs: [],
        payload: { markedAtMs: mark.marked_at_ms, markId: mark.id },
      });
    }
    classroomMethod = recordingSession.session_kind === 'lecture'
      && input.preferredFormat
      && input.preferredFormat !== 'auto'
      ? String(input.preferredFormat)
      : resolveClassroomNoteMethod({ subject: subject || className || '', sessionKind: recordingSession.session_kind });
    groundedInstruction = buildGroundedClassroomInstruction({
      method: classroomMethod,
      evidenceTranscript: transcription,
      assetEvidence,
      userJots: userNotesSnapshot || '',
    });
  } else {
    await reporter.update('fetching_audio', 12, 'Fetching lecture audio');
    const { data: audioData, error: storageError } = await admin.storage.from('note-audio').download(audioPath);
    if (storageError || !audioData) {
      throw createHttpError('Failed to retrieve audio file.', 500);
    }

    const audioBlob = new Blob([await audioData.arrayBuffer()], { type: getAudioMimeType(audioPath) });
    const filename = audioPath.split('/').pop() || 'audio.webm';
    if (audioBlob.size > 25 * 1024 * 1024) {
      throw createHttpError('Audio file exceeds the 25MB processing limit. Try a shorter recording.', 413);
    }
    await reporter.update('processing_media', 24, 'Transcribing audio');
    const transcriptionResult = await ai.transcribeAudioWithSegments(
      audioBlob,
      filename,
      { prompt: buildTranscriptionBiasPrompt(className, subject) },
    );
    transcription = transcriptionResult.text;
    segments = transcriptionResult.segments;
    persistedSegments = segments;
  }

  const sections = groupSegmentsIntoSections(segments);

  let finalDoc: unknown;

  // ── SHORT RECORDING: single-section streaming path (unchanged) ──────────
  if (sections.length <= 1) {
    const draftMessages: AiMessage[] = [{
      role: 'user',
      content: `${buildNoteDraftPrompt(userNotesSnapshot, className, subject, transcription)}\n\n${groundedInstruction || `Lecture Audio Transcription:\n${transcription}`}`,
    }];

    const draftResult = await streamDocPreview({
      ai,
      model: modelMap.draft,
      fallbackModel: modelMap.final,
      messages: draftMessages,
      reporter,
      phase: 'drafting',
      startPercent: 36,
      endPercent: 68,
      message: 'Drafting enhanced notes',
    });

    const draftDoc = draftResult.doc;
    if (draftResult.firstPreviewAt != null) {
      firstPreviewAt = draftResult.firstPreviewAt;
    }

    await reporter.update('enriching', 72, 'Refining draft into final notes', {
      preview_doc: draftDoc,
      preview_sections: Array.isArray((draftDoc as Record<string, unknown>).content)
        ? (draftDoc as Record<string, unknown>).content
        : [],
      preview_text: extractTextFromTiptapDoc(draftDoc),
    });

    const enrichText = await generateWithFallback({
      ai,
      primaryModel: modelMap.final,
      fallbackModel: modelMap.final,
      messages: [{
        role: 'user',
        content: `${buildNoteEnrichPrompt(userNotesSnapshot, className, draftDoc, subject, transcription)}\n\n${groundedInstruction || `Lecture Audio Transcription:\n${transcription}`}`,
      }],
      responseFormat: 'json_object',
    });

    try {
      finalDoc = parseAiJsonResponse(enrichText, 'AI generated invalid enhanced notes format. Please try again.');
    } catch {
      finalDoc = draftDoc;
    }

    await reporter.markSaving('Saving enhanced notes', {
      final_doc: finalDoc,
      note_id: noteId,
      metrics: {
        server_total_ms: Date.now() - jobStartedAt,
        first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
        ai_model_stage: { draft: modelMap.draft, final: modelMap.final },
      },
    });

  // ── LONG RECORDING: parallel section path ────────────────────────────────
  } else {
    const completedSections: unknown[] = new Array(sections.length).fill(null);
    const CONCURRENCY = 4;

    await reporter.update('drafting', 30, `Generating notes for ${sections.length} sections`);

    await processConcurrently(sections, CONCURRENCY, async (section) => {
      const nearbyAssetEvidence = buildRecordingAssetEvidence(recordingAssets.filter((asset: any) => {
        const capturedAtSeconds = Number(asset?.captured_at_ms || 0) / 1000;
        return capturedAtSeconds >= Math.max(0, section.startTime - 60)
          && capturedAtSeconds <= section.endTime + 60;
      }));
      const sectionDoc = await generateNotesForSection({
        ai,
        section,
        totalSections: sections.length,
        userNotesSnapshot,
        className,
        subject,
        modelMap,
        groundingContext: `Classroom note method: ${classroomMethod}.
Use only this section transcript, the student's jots, and readable class assets below. Do not add outside facts, inferred definitions, invented examples, or solutions the instructor did not give.
Preserve student jots and label any source conflict for review.

Timestamped readable class assets near this section:
${nearbyAssetEvidence || 'None'}`,
      });

      completedSections[section.index] = sectionDoc;

      const ready = completedSections.filter(Boolean);
      if (firstPreviewAt == null) firstPreviewAt = Date.now();
      const progressPercent = Math.round(30 + (ready.length / sections.length) * 42);

      await reporter.markStreaming(
        'drafting',
        progressPercent,
        `Section ${ready.length} of ${sections.length} complete`,
        {
          preview_sections: ready,
          sections_complete: ready.length,
          sections_total: sections.length,
        },
      );
    });

    await reporter.update('enriching', 75, 'Merging sections into final notes');

    const mergeText = await generateWithFallback({
      ai,
      primaryModel: modelMap.final,
      fallbackModel: modelMap.final,
      messages: [{
        role: 'user',
        content: `${buildMergePrompt(userNotesSnapshot, className, completedSections, subject)}

Merge only the grounded section drafts and readable class assets below. Do not add outside facts, inferred definitions, invented examples, or missing audio content. Preserve every student jot and retain clearly labeled source conflicts.

Timestamped readable class assets:
${assetEvidence || 'None'}`,
      }],
      responseFormat: 'json_object',
      // Scale the merge budget with section count so a long lecture yields a proportionally
      // long note instead of being squeezed into a fixed ceiling.
      maxTokens: mergeMaxTokens(sections.length),
    });

    try {
      finalDoc = parseAiJsonResponse(mergeText, 'AI generated invalid merged notes format. Please try again.');
    } catch {
      const allContent = completedSections.flatMap((doc: any) => {
        if (!Array.isArray(doc?.content)) return [];
        return (doc.content as any[]).filter((node: any) => node?.type !== 'doc');
      });
      finalDoc = { type: 'doc', content: allContent };
    }

    await reporter.markSaving('Saving enhanced notes', {
      final_doc: finalDoc,
      note_id: noteId,
      metrics: {
        server_total_ms: Date.now() - jobStartedAt,
        first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
        ai_model_stage: { draft: modelMap.draft, final: modelMap.final },
        sections_count: sections.length,
      },
    });
  }

  // Off-the-critical-path fidelity pass: correct drift from the transcript / contract breaks.
  // The preview is already shown, so this never adds perceived latency.
  finalDoc = await ensureNoteFidelity({
    ai,
    finalDoc,
    transcription: assetEvidence ? `${transcription}\n\nTimestamped readable class assets:\n${assetEvidence}` : transcription,
    userNotesSnapshot,
    className,
    subject,
    modelMap,
  });

  // Structured knowledge layer: the single hand-off every downstream generator consumes
  // (flashcards, exams, guides, future tutor). Generated eagerly; never blocks the save.
  const knowledgeLayer = await extractKnowledgeLayer({
    ai,
    finalDoc,
    transcription,
    className,
    subject,
    modelMap,
  });

  const persistedAt = new Date().toISOString();

  if (sessionId) {
    const { error: applyError } = await admin.rpc('apply_audio_note_enhancement_v2', {
      p_user_id: job.user_id,
      p_note_id: noteId,
      p_session_id: sessionId,
      p_content: finalDoc,
      p_transcript: transcription,
      p_audio_segments: persistedSegments,
      p_knowledge_layer: knowledgeLayer,
      p_source_snapshot_hash: sourceSnapshotHash,
      p_study_signals: studySignals,
      p_completed_at: persistedAt,
    });
    if (applyError) throw applyError;
  } else {
    const { error: updateError } = await admin
      .from('notes')
      .update({
        enhanced_content: finalDoc,
        content: finalDoc,
        transcript: transcription,
        audio_segments: persistedSegments,
        audio_url: audioPath,
        polish_status: 'polished',
        source_type: 'audio',
        knowledge_layer: knowledgeLayer,
      })
      .eq('id', noteId)
      .eq('user_id', job.user_id);
    if (updateError) throw updateError;
  }

  await reporter.markSaving('Saving enhanced notes', {
    final_doc: finalDoc,
    note_id: noteId,
    note_persisted: true,
    persisted_at: persistedAt,
    metrics: {
      server_total_ms: Date.now() - jobStartedAt,
      first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
      ai_model_stage: {
        draft: modelMap.draft,
        final: modelMap.final,
      },
    },
  });

  // Audio is intentionally retained (audio_url above) so the note can replay the recording
  // and jump to timestamps. It is cleaned up when the note or its audio is explicitly deleted.

  await reporter.complete({
    message: 'Notes enhanced successfully',
    targetType: 'note',
    targetId: noteId,
    resultPatch: {
      final_doc: finalDoc,
      note_id: noteId,
      note_persisted: true,
      persisted_at: persistedAt,
      source_snapshot_hash: sourceSnapshotHash,
      study_signal_count: studySignals.length,
    },
  });
};

const processDirectYoutubeNotesJob = async ({
  admin,
  job,
}: JobProcessorArgs) => {
  const reporter = createJobReporter(admin, job);
  const input = (job.input_payload || {}) as Record<string, unknown>;
  const youtubeUrl = String(input.youtubeUrl || '');
  const titleSnapshot = typeof input.titleSnapshot === 'string' ? input.titleSnapshot : 'YouTube Notes';
  const classId = input.classId == null ? null : String(input.classId);
  const className = typeof input.className === 'string' ? input.className : null;
  const subject = typeof input.subject === 'string' ? input.subject : null;
  const sourceKey = typeof job.source_key === 'string' ? job.source_key : String(input.sourceKey || '');

  if (!youtubeUrl || !sourceKey) {
    throw createHttpError('Direct YouTube notes job is missing video context.', 400);
  }

  const ai = getApiKeyAndClient();
  const baseModelMap = getAiModelMap();
  const notesModelMap = {
    ...baseModelMap,
    final: YOUTUBE_NOTES_MODEL,
  };
  const jobStartedAt = Date.now();
  const metrics: Record<string, unknown> = {
    transcript_fetch_ms: null,
    transcript_chars: null,
    prep_ms: 0,
    generation_ms: 0,
    validation_ms: 0,
    save_ms: 0,
    model: YOUTUBE_NOTES_MODEL,
    path: 'direct',
  };

  await reporter.markRunning('processing_media', 8, 'Checking for reusable video notes', {
    source_key: sourceKey,
  });

  const cachedSource = await getCachedYoutubeNotesSource({
    admin,
    userId: job.user_id,
    sourceKey,
    currentJobId: job.id,
  });

  if (cachedSource?.doc) {
    metrics.path = 'cached';
    metrics.model = 'cache';
    metrics.transcript_chars = cachedSource.rawTranscript.length || null;

    await consumeUserAiQuota({ admin, userId: job.user_id });
    await reporter.markSaving('Saving imported notes', {
      preview_text: cachedSource.sourceText,
      preview_doc: cachedSource.doc,
      preview_sections: (cachedSource.doc as Record<string, unknown> | undefined)?.content || [],
    });

    const saveStartedAt = Date.now();
    const noteId = await createYoutubeNote({
      admin,
      userId: job.user_id,
      title: titleSnapshot || cachedSource.title || 'YouTube Notes',
      classId,
      doc: cachedSource.doc,
      transcript: cachedSource.rawTranscript || cachedSource.sourceText,
      knowledgeLayer: cachedSource.knowledgeLayer,
    });
    metrics.save_ms = Date.now() - saveStartedAt;
    metrics.server_total_ms = Date.now() - jobStartedAt;

    await reporter.complete({
      message: 'Notes generated successfully',
      targetType: 'note',
      targetId: noteId,
      resultPatch: {
        note_id: noteId,
        title: titleSnapshot || cachedSource.title || 'YouTube Notes',
        final_doc: cachedSource.doc,
        source_text: cachedSource.sourceText,
        raw_transcript: cachedSource.rawTranscript || cachedSource.sourceText,
        knowledge_layer: cachedSource.knowledgeLayer,
        source_key: sourceKey,
        metrics,
      },
    });
    return;
  }

  await reporter.update('processing_media', 12, 'Fetching YouTube transcript', {
    source_key: sourceKey,
  });

  const transcriptStartedAt = Date.now();
  const transcript = await getOrFetchYoutubeTranscript({ admin, youtubeUrl });
  metrics.transcript_fetch_ms = Date.now() - transcriptStartedAt;
  metrics.transcript_chars = transcript.length;

  // Consume quota only after transcript access succeeds.
  await consumeUserAiQuota({ admin, userId: job.user_id });

  await reporter.update('processing_media', 22, 'Preparing transcript', {
    source_key: sourceKey,
    transcript_chars: transcript.length,
  });

  const prepStartedAt = Date.now();
  const initialTokenPlan = buildYoutubeNotesTokenPlan({
    model: YOUTUBE_NOTES_MODEL,
    sourceChars: transcript.length,
  });
  const directTranscriptLimit = Math.min(
    YOUTUBE_DIRECT_TRANSCRIPT_LIMIT,
    initialTokenPlan.shouldCompact ? initialTokenPlan.directCharLimit : YOUTUBE_DIRECT_TRANSCRIPT_LIMIT,
  );

  metrics.token_budget = {
    safe_request_tokens: initialTokenPlan.safeRequestTokens,
    estimated_prompt_tokens: initialTokenPlan.estimatedPromptTokens,
    max_completion_tokens: initialTokenPlan.maxCompletionTokens,
    estimated_request_tokens: initialTokenPlan.estimatedRequestTokens,
    direct_char_limit: directTranscriptLimit,
  };

  if (transcript.length > directTranscriptLimit) {
    await reporter.update('processing_media', 24, 'Large transcript, optimizing notes...', {
      source_key: sourceKey,
      transcript_chars: transcript.length,
      transcript_compacted: true,
    });
  }

  let preparedSource = await prepareYoutubeTranscriptSource({
    transcript,
    className,
    directCharLimit: directTranscriptLimit,
    chunkConcurrency: initialTokenPlan.compactionConcurrency,
    generateText: (prompt, maxTokens) =>
      generateWithFallback({
        ai,
        primaryModel: baseModelMap.draft,
        fallbackModel: baseModelMap.final,
        messages: [{ role: 'user', content: prompt }],
        maxTokens,
      }),
    onProgress: async ({ chunkCount, chunkIndex, message, step }) => {
      const percentByStep = (
        step === 'summarizing'
          ? 24 + Math.round((((chunkIndex ?? 1) / Math.max(chunkCount, 1)) * 10))
          : step === 'merging'
            ? 36
            : 38
      );

      await reporter.update('processing_media', percentByStep, message, {
        source_key: sourceKey,
        transcript_chunk_count: chunkCount,
        transcript_compacted: true,
      });
    },
  });
  metrics.prep_ms = Date.now() - prepStartedAt;
  metrics.path = preparedSource.wasCompacted ? 'long_compacted' : 'direct';

  const buildGenerationMessages = (sourceText: string): AiMessage[] => [{
    role: 'user',
    content: `${buildSinglePassNoteGeneratePrompt(className, subject, sourceText, { sourceKind: 'video' })}\n\nVideo Source Material:\n${sourceText}`,
  }];

  const streamYoutubeNotes = async ({
    sourceText,
    maxCompletionTokens,
    retry,
  }: {
    sourceText: string;
    maxCompletionTokens: number;
    retry: boolean;
  }) => streamDocPreview({
    ai,
    model: YOUTUBE_NOTES_MODEL,
    fallbackModel: baseModelMap.draft,
    messages: buildGenerationMessages(sourceText),
    reporter,
    phase: 'drafting',
    startPercent: retry ? 48 : 42,
    endPercent: 82,
    message: retry ? 'Generating notes from optimized transcript' : 'Generating notes',
    maxTokens: maxCompletionTokens,
  });

  const generationStartedAt = Date.now();
  let generationPlan = buildYoutubeNotesTokenPlan({
    model: YOUTUBE_NOTES_MODEL,
    sourceChars: preparedSource.sourceText.length,
  });
  metrics.token_budget = {
    ...(metrics.token_budget as Record<string, unknown>),
    prepared_prompt_tokens: generationPlan.estimatedPromptTokens,
    prepared_request_tokens: generationPlan.estimatedRequestTokens,
    max_completion_tokens: generationPlan.maxCompletionTokens,
  };

  let streamResult: Awaited<ReturnType<typeof streamDocPreview>>;
  try {
    streamResult = await streamYoutubeNotes({
      sourceText: preparedSource.sourceText,
      maxCompletionTokens: generationPlan.maxCompletionTokens,
      retry: false,
    });
  } catch (error) {
    if (!isProviderTokenLimitError(error)) throw error;

    const retryTokenPlan = buildYoutubeNotesRetryTokenPlan({
      model: YOUTUBE_NOTES_MODEL,
      sourceChars: transcript.length,
    });

    await reporter.update('processing_media', 40, 'AI provider token limit hit; optimizing source...', {
      source_key: sourceKey,
      token_limit_retry: true,
    });

    preparedSource = await prepareYoutubeTranscriptSource({
      transcript,
      className,
      directCharLimit: Math.min(YOUTUBE_DIRECT_TRANSCRIPT_LIMIT, retryTokenPlan.directCharLimit),
      chunkConcurrency: retryTokenPlan.compactionConcurrency,
      generateText: (prompt, maxTokens) =>
        generateWithFallback({
          ai,
          primaryModel: baseModelMap.draft,
          fallbackModel: baseModelMap.final,
          messages: [{ role: 'user', content: prompt }],
          maxTokens,
        }),
      onProgress: async ({ chunkCount, chunkIndex, message, step }) => {
        const percentByStep = (
          step === 'summarizing'
            ? 40 + Math.round((((chunkIndex ?? 1) / Math.max(chunkCount, 1)) * 4))
            : step === 'merging'
              ? 45
              : 46
        );

        await reporter.update('processing_media', percentByStep, message, {
          source_key: sourceKey,
          transcript_chunk_count: chunkCount,
          transcript_compacted: true,
          token_limit_retry: true,
        });
      },
    });

    generationPlan = buildYoutubeNotesTokenPlan({
      model: YOUTUBE_NOTES_MODEL,
      sourceChars: preparedSource.sourceText.length,
    });
    metrics.path = 'long_compacted';
    metrics.token_limit_retry = true;
    metrics.token_budget = {
      ...(metrics.token_budget as Record<string, unknown>),
      retry_prompt_tokens: generationPlan.estimatedPromptTokens,
      retry_request_tokens: generationPlan.estimatedRequestTokens,
      retry_max_completion_tokens: Math.min(generationPlan.maxCompletionTokens, retryTokenPlan.maxCompletionTokens),
      retry_direct_char_limit: retryTokenPlan.directCharLimit,
    };

    try {
      streamResult = await streamYoutubeNotes({
        sourceText: preparedSource.sourceText,
        maxCompletionTokens: Math.min(generationPlan.maxCompletionTokens, retryTokenPlan.maxCompletionTokens),
        retry: true,
      });
    } catch (retryError) {
      if (isProviderTokenLimitError(retryError)) {
        throw createSanitizedProviderTokenLimitError(retryError);
      }
      throw retryError;
    }
  }
  metrics.generation_ms = Date.now() - generationStartedAt;

  let finalDoc: unknown = streamResult.doc;

  await reporter.update('enriching', 86, 'Validating notes', {
    preview_doc: finalDoc,
    preview_sections: Array.isArray((finalDoc as Record<string, unknown>).content)
      ? (finalDoc as Record<string, unknown>).content
      : [],
    preview_text: extractTextFromTiptapDoc(finalDoc),
  });

  const validationStartedAt = Date.now();
  finalDoc = await ensureNoteFidelity({
    ai,
    finalDoc,
    transcription: preparedSource.sourceText,
    userNotesSnapshot: null,
    className,
    subject,
    modelMap: notesModelMap,
    sourceKind: 'video',
  });
  metrics.validation_ms = Date.now() - validationStartedAt;

  const sourceText = extractTextFromTiptapDoc(finalDoc);

  await reporter.markSaving('Saving imported notes', {
    final_doc: finalDoc,
    preview_doc: finalDoc,
    preview_sections: Array.isArray((finalDoc as Record<string, unknown>).content)
      ? (finalDoc as Record<string, unknown>).content
      : [],
    preview_text: sourceText,
  });

  const saveStartedAt = Date.now();
  const noteId = await createYoutubeNote({
    admin,
    userId: job.user_id,
    title: titleSnapshot || 'YouTube Notes',
    classId,
    doc: finalDoc,
    transcript,
    knowledgeLayer: null,
  });
  metrics.save_ms = Date.now() - saveStartedAt;
  metrics.server_total_ms = Date.now() - jobStartedAt;

  await reporter.complete({
    message: 'Notes generated successfully',
    targetType: 'note',
    targetId: noteId,
    resultPatch: {
      note_id: noteId,
      title: titleSnapshot || 'YouTube Notes',
      final_doc: finalDoc,
      source_doc: finalDoc,
      source_text: sourceText,
      raw_transcript: transcript,
      source_key: sourceKey,
      preview_doc: finalDoc,
      preview_sections: Array.isArray((finalDoc as Record<string, unknown>).content)
        ? (finalDoc as Record<string, unknown>).content
        : [],
      metrics,
    },
  });

  scheduleBackgroundTask(async () => {
    const backgroundStartedAt = Date.now();
    try {
      const knowledgeLayer = await extractKnowledgeLayer({
        ai,
        finalDoc,
        transcription: preparedSource.sourceText,
        className,
        subject,
        modelMap: baseModelMap,
      });

      if (!knowledgeLayer) return;

      const { error: updateError } = await admin
        .from('notes')
        .update({ knowledge_layer: knowledgeLayer })
        .eq('id', noteId)
        .eq('user_id', job.user_id);

      if (updateError) throw updateError;

      await admin
        .from('ai_jobs')
        .update({
          result_payload: {
            note_id: noteId,
            title: titleSnapshot || 'YouTube Notes',
            final_doc: finalDoc,
            source_doc: finalDoc,
            source_text: sourceText,
            raw_transcript: transcript,
            knowledge_layer: knowledgeLayer,
            source_key: sourceKey,
            preview_doc: finalDoc,
            preview_sections: Array.isArray((finalDoc as Record<string, unknown>).content)
              ? (finalDoc as Record<string, unknown>).content
              : [],
            metrics: {
              ...metrics,
              knowledge_background_ms: Date.now() - backgroundStartedAt,
            },
          },
        })
        .eq('id', job.id)
        .eq('user_id', job.user_id);
    } catch (error) {
      console.warn('[youtube_notes] background knowledge-layer extraction failed', error);
      await reportEdgeException(error, {
        functionName: 'run-ai-job',
        tags: {
          job_kind: 'youtube_notes',
          background_task: 'knowledge_layer',
        },
        extras: {
          jobId: job.id,
          noteId,
          sourceKey,
        },
      });
    }
  });
};

const processYoutubeSourceJob = async ({
  admin,
  job,
}: JobProcessorArgs) => {
  const reporter = createJobReporter(admin, job);
  const input = (job.input_payload || {}) as Record<string, unknown>;
  const youtubeUrl = String(input.youtubeUrl || '');
  const className = typeof input.className === 'string' ? input.className : null;
  const subject = typeof input.subject === 'string' ? input.subject : null;
  const titleSnapshot = typeof input.titleSnapshot === 'string' ? input.titleSnapshot : 'YouTube Source';
  const sourceKey = typeof job.source_key === 'string' ? job.source_key : String(input.sourceKey || '');

  if (!youtubeUrl || !sourceKey) {
    throw createHttpError('YouTube source job is missing video context.', 400);
  }

  const ai = getApiKeyAndClient();
  const jobStartedAt = Date.now();
  let firstPreviewAt: number | null = null;

  await reporter.markRunning('processing_media', 14, 'Fetching YouTube transcript', {
    source_key: sourceKey,
  });

  const transcript = await getOrFetchYoutubeTranscript({ admin, youtubeUrl });
  const modelMap = getAiModelMap();
  const preparedSource = await prepareYoutubeTranscriptSource({
    transcript,
    className,
    generateText: (prompt, maxTokens) =>
      generateWithFallback({
        ai,
        primaryModel: modelMap.draft,
        fallbackModel: modelMap.final,
        messages: [{ role: 'user', content: prompt }],
        maxTokens,
      }),
    onProgress: async ({ chunkCount, chunkIndex, message, step }) => {
      const percentByStep = (
        step === 'summarizing'
          ? 18 + Math.round((((chunkIndex ?? 1) / Math.max(chunkCount, 1)) * 5))
          : step === 'merging'
            ? 24
            : 25
      );

      await reporter.update('processing_media', percentByStep, message, {
        source_key: sourceKey,
        transcript_chunk_count: chunkCount,
        transcript_compacted: true,
      });
    },
  });

  // ── DRAFT PASS ─────────────────────────────────────────────────────────────
  // Use the same draft→enrich two-pass pipeline as the audio path so YouTube
  // notes get subject-aware structure, the "notes = reference" contract, and
  // the same quality level (no recap sections, proper outline/worked-examples).
  const draftMessages: AiMessage[] = [{
    role: 'user',
    content: `${buildNoteDraftPrompt(null, className, subject, preparedSource.sourceText, { sourceKind: 'video' })}\n\nVideo Source Material:\n${preparedSource.sourceText}`,
  }];

  const streamResult = await streamDocPreview({
    ai,
    model: modelMap.draft,
    fallbackModel: modelMap.final,
    messages: draftMessages,
    reporter,
    phase: 'drafting',
    startPercent: 26,
    endPercent: 62,
    message: 'Drafting video notes',
  });

  if (streamResult.firstPreviewAt != null) {
    firstPreviewAt = streamResult.firstPreviewAt;
  }

  const draftDoc = streamResult.doc;

  await reporter.update('enriching', 66, 'Refining notes for clarity', {
    preview_doc: draftDoc,
    preview_sections: Array.isArray((draftDoc as Record<string, unknown>).content)
      ? (draftDoc as Record<string, unknown>).content
      : [],
  });

  // ── ENRICH PASS ────────────────────────────────────────────────────────────
  const enrichText = await generateWithFallback({
    ai,
    primaryModel: modelMap.final,
    fallbackModel: modelMap.final,
    messages: [{
      role: 'user',
      content: `${buildNoteEnrichPrompt(null, className, draftDoc, subject, preparedSource.sourceText, { sourceKind: 'video' })}\n\nVideo Source Material:\n${preparedSource.sourceText}`,
    }],
    responseFormat: 'json_object',
  });

  let sourceDoc: unknown;
  try {
    sourceDoc = parseAiJsonResponse(enrichText, 'AI generated invalid notes format for YouTube source.');
  } catch {
    sourceDoc = draftDoc;
  }

  // ── FIDELITY PASS ──────────────────────────────────────────────────────────
  // Off-critical-path: correct drift from the transcript or content-contract breaks.
  sourceDoc = await ensureNoteFidelity({
    ai,
    finalDoc: sourceDoc,
    transcription: preparedSource.sourceText,
    userNotesSnapshot: null,
    className,
    subject,
    modelMap,
    sourceKind: 'video',
  });

  // Structured knowledge layer so YouTube notes feed flashcards/exams/guides like audio notes do.
  const knowledgeLayer = await extractKnowledgeLayer({
    ai,
    finalDoc: sourceDoc,
    transcription: preparedSource.sourceText,
    className,
    subject,
    modelMap,
  });

  const sourceText = extractTextFromTiptapDoc(sourceDoc);

  await reporter.complete({
    message: 'Video source material is ready',
    targetType: 'youtube_source',
    targetId: sourceKey,
    resultPatch: {
      source_doc: sourceDoc,
      source_text: sourceText,
      knowledge_layer: knowledgeLayer,
      // Pass the raw transcript through so the youtube_notes derived job can
      // persist it on the note for later reference / fidelity tracing.
      raw_transcript: transcript,
      title: titleSnapshot,
      source_key: sourceKey,
      preview_doc: sourceDoc,
      preview_sections: Array.isArray((sourceDoc as Record<string, unknown>).content)
        ? (sourceDoc as Record<string, unknown>).content
        : [],
      metrics: {
        server_total_ms: Date.now() - jobStartedAt,
        first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
        ai_model_stage: {
          draft: modelMap.draft,
          final: modelMap.final,
        },
        transcript_chunk_count: preparedSource.chunkCount,
        transcript_compacted: preparedSource.wasCompacted,
      },
    },
  });
};

const processYoutubeDerivedJob = async ({
  admin,
  job,
}: JobProcessorArgs) => {
  const reporter = createJobReporter(admin, job);
  const input = (job.input_payload || {}) as Record<string, unknown>;
  const sourceJobId = String(input.sourceJobId || '');
  const titleSnapshot = typeof input.titleSnapshot === 'string' ? input.titleSnapshot : null;
  const classId = input.classId == null ? null : String(input.classId);
  const className = typeof input.className === 'string' ? input.className : null;
  const subject = typeof input.subject === 'string' ? input.subject : null;
  const sourceKey = typeof job.source_key === 'string' ? job.source_key : String(input.sourceKey || '');

  if (!sourceJobId || !sourceKey) {
    throw createHttpError('YouTube derived job is missing source dependency.', 400);
  }

  await reporter.update('accepted', 2, 'Queued behind video analysis');
  const sourceJob = await waitForJobCompletion({
    admin,
    jobId: sourceJobId,
    userId: job.user_id,
  });

  // Consume AI quota only after confirming source job succeeded.
  await consumeUserAiQuota({ admin, userId: job.user_id });

  await waitForYoutubeSlot({
    admin,
    jobId: job.id,
    userId: job.user_id,
    sourceKey,
    maxConcurrent: 2,
  });

  const reporterStart = Date.now();
  let firstPreviewAt: number | null = null;
  const sourcePayload = (sourceJob.result_payload || {}) as Record<string, unknown>;
  const sourceText = typeof sourcePayload.source_text === 'string'
    ? sourcePayload.source_text
    : extractTextFromTiptapDoc(sourcePayload.source_doc);
  const effectiveTitle = titleSnapshot || (typeof sourcePayload.title === 'string' ? sourcePayload.title : null);

  if (!sourceText) {
    throw createHttpError('Video source text is unavailable for this AI job.', 500);
  }

  const ai = getApiKeyAndClient();
  const modelMap = getAiModelMap();
  // Structured hand-off from the video's notes so derived decks/exams/guides build from
  // concepts/objectives rather than re-parsing prose (empty string when unavailable).
  const ytKnowledgeContext = buildKnowledgeContext(sourcePayload.knowledge_layer);

  await reporter.markRunning('drafting', 18, 'Generating study artifact', {
    source_key: sourceKey,
  });

  if (job.kind === 'youtube_notes') {
    await reporter.markSaving('Saving imported notes', {
      preview_text: sourceText,
      preview_doc: sourcePayload.source_doc,
      preview_sections: (sourcePayload.source_doc as Record<string, unknown> | undefined)?.content || [],
    });

    const rawTranscript = typeof sourcePayload.raw_transcript === 'string'
      ? sourcePayload.raw_transcript
      : sourceText;

    const noteId = await createYoutubeNote({
      admin,
      userId: job.user_id,
      title: effectiveTitle || 'YouTube Notes',
      classId,
      doc: sourcePayload.source_doc,
      transcript: rawTranscript,
      knowledgeLayer: sourcePayload.knowledge_layer ?? null,
    });

    await reporter.complete({
      message: 'Notes generated successfully',
      targetType: 'note',
      targetId: noteId,
      resultPatch: {
        note_id: noteId,
        final_doc: sourcePayload.source_doc,
        metrics: {
          server_total_ms: Date.now() - reporterStart,
          first_preview_ms: 0,
          ai_source_cache_hit: true,
        },
      },
    });
    return;
  }

  if (job.kind === 'youtube_deck') {
    const deckResult = await streamArrayPreview({
      ai,
      model: modelMap.final,
      fallbackModel: modelMap.final,
      messages: contentsToMessages(buildDeckContents({
        processedNotes: sourceText,
        hasProcessedNotes: true,
        keepFile: false,
        file: null,
        knowledgeContext: ytKnowledgeContext,
        className,
        subject,
      })),
      reporter,
      phase: 'drafting',
      startPercent: 28,
      endPercent: 76,
      message: 'Generating flashcards',
    });

    if (deckResult.firstPreviewAt != null) {
      firstPreviewAt = deckResult.firstPreviewAt;
    }

    const flashcards = Array.isArray(deckResult.items) ? deckResult.items : [];
    if (flashcards.length === 0) {
      throw createHttpError('AI failed to generate any usable flashcards.', 500);
    }

    await reporter.markSaving('Saving flashcards', {
      preview_items: flashcards,
    });

    const deckId = await createDeck({
      admin,
      userId: job.user_id,
      title: effectiveTitle || 'YouTube AI Deck',
      classId,
      flashcards: flashcards as Array<{ front: string; back: string }>,
    });

    await reporter.complete({
      message: 'Flashcards generated successfully',
      targetType: 'deck',
      targetId: deckId,
      resultPatch: {
        deck_id: deckId,
        card_count: flashcards.length,
        metrics: {
          server_total_ms: Date.now() - reporterStart,
          first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - reporterStart,
          ai_source_cache_hit: true,
        },
      },
    });
    return;
  }

  if (job.kind === 'youtube_exam') {
    const examResult = await streamArrayPreview({
      ai,
      model: modelMap.final,
      fallbackModel: modelMap.final,
      messages: contentsToMessages(buildExamContents({
        processedNotes: sourceText,
        hasProcessedNotes: true,
        keepFile: false,
        file: null,
        className,
        subject,
        masteryData: null,
        weakTopics: null,
        examMode: null,
        knowledgeContext: ytKnowledgeContext,
      })),
      reporter,
      phase: 'drafting',
      startPercent: 28,
      endPercent: 76,
      message: 'Generating mock exam',
    });

    if (examResult.firstPreviewAt != null) {
      firstPreviewAt = examResult.firstPreviewAt;
    }

    const questions = Array.isArray(examResult.items) ? examResult.items : [];
    const validQuestions = questions.filter((question: any) => (
      question?.question
      && question?.correct_answer
      && (
        question?.type === 'short_answer'
          ? Boolean(question?.grading_rubric)
          : Array.isArray(question?.options)
            && question.options.length === 4
            && question.options.includes(question.correct_answer)
      )
    ));

    if (validQuestions.length === 0) {
      throw createHttpError('AI failed to generate any exam questions.', 500);
    }

    await reporter.markSaving('Saving mock exam', {
      preview_items: validQuestions,
    });

    const examId = await createExam({
      admin,
      userId: job.user_id,
      title: effectiveTitle || 'YouTube Mock Exam',
      classId,
      questions: validQuestions,
    });

    await reporter.complete({
      message: 'Mock exam generated successfully',
      targetType: 'exam',
      targetId: examId,
      resultPatch: {
        exam_id: examId,
        question_count: validQuestions.length,
        metrics: {
          server_total_ms: Date.now() - reporterStart,
          first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - reporterStart,
          ai_source_cache_hit: true,
        },
      },
    });
    return;
  }

  const guideMessages = contentsToMessages(buildGuideContents({
    processedNotes: sourceText,
    hasProcessedNotes: true,
    keepFile: false,
    file: null,
    className,
    subject,
    coachConfig: null,
    knowledgeContext: ytKnowledgeContext,
  }));

  const streamResponse = await streamWithFallback({
    ai,
    primaryModel: modelMap.final,
    fallbackModel: modelMap.final,
    messages: guideMessages,
    maxTokens: 8192,
  });

  let fullGuideText = '';
  let guideChunkCount = 0;
  for await (const chunk of streamResponse) {
    const text = chunk.text ?? '';
    if (!text) continue;

    fullGuideText += text;
    guideChunkCount += 1;

    if (firstPreviewAt == null) {
      firstPreviewAt = Date.now();
    }

    await reporter.markStreaming(
      'drafting',
      Math.min(76, 28 + Math.min(guideChunkCount, 6) * 8),
      'Generating tutor session',
      { preview_text: fullGuideText.slice(-240) },
    );
  }

  const guidePayload = parseAiJsonResponse(
    fullGuideText,
    'AI generated invalid tutor session format. Please try again.',
  );
  const guideData = normalizeStudyGuideData(guidePayload);
  if (!guideData) {
    throw createHttpError('AI failed to generate a valid tutor session.', 500);
  }
  assertTutorSessionQuality(guideData);

  const guideContent = buildStudyGuideSummaryDoc(guideData);
  const studyState = createDefaultStudyGuideState(guideData);

  const guideId = await createGuide({
    admin,
    userId: job.user_id,
    title: effectiveTitle || 'YouTube Tutor Session',
    classId,
    formatVersion: STUDY_GUIDE_FORMAT_VERSION,
    guideData,
    studyState,
    content: guideContent,
  });

  await reporter.complete({
    message: 'Tutor session generated successfully',
    targetType: 'guide',
    targetId: guideId,
    resultPatch: {
      guide_id: guideId,
      final_doc: guideContent,
      preview_doc: guideContent,
      preview_sections: Array.isArray((guideContent as Record<string, unknown>).content)
        ? (guideContent as Record<string, unknown>).content
        : [],
      metrics: {
        server_total_ms: Date.now() - reporterStart,
        first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - reporterStart,
        ai_source_cache_hit: true,
      },
    },
  });
};

export const processAiJob = async ({
  admin,
  job,
}: JobProcessorArgs) => {
  if (job.kind === 'note_enhancement') {
    return processNoteEnhancementJob({ admin, job });
  }

  if (job.kind === 'youtube_source') {
    return processYoutubeSourceJob({ admin, job });
  }

  if (job.kind === 'youtube_notes') {
    const input = (job.input_payload || {}) as Record<string, unknown>;
    if (typeof input.youtubeUrl === 'string' && input.youtubeUrl && !input.sourceJobId) {
      return processDirectYoutubeNotesJob({ admin, job });
    }
    return processYoutubeDerivedJob({ admin, job });
  }

  if (
    job.kind === 'youtube_deck'
    || job.kind === 'youtube_guide'
    || job.kind === 'youtube_exam'
  ) {
    return processYoutubeDerivedJob({ admin, job });
  }

  throw createHttpError('Unsupported AI job kind.', 400);
};
