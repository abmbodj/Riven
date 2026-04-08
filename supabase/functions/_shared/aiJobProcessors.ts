import {
  buildDeckContents,
  buildExamContents,
  buildGuideContents,
  buildSubjectContext,
  consumeAiQuota,
  createHttpError,
  parseAiJsonResponse,
} from './aiCore.mjs';
import { createAiClient, contentsToMessages, type AiClient, type AiMessage, type AiResponseFormat } from './aiClient.ts';
import { fetchYoutubeTranscript } from './youtubeTranscript.ts';
import { prepareYoutubeTranscriptSource } from './youtubeTranscriptPrep.ts';
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

type JobProcessorArgs = {
  admin: any;
  job: any;
};

const TIPTAP_FORMAT = `Output ONLY valid JSON: { "type": "doc", "content": [...] }. No markdown/backticks outside JSON.
Node types: heading (attrs.level 1-3), paragraph, bulletList→listItem→paragraph, orderedList→listItem→paragraph, blockquote→paragraph, horizontalRule.
Text marks: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code).`;

const buildNoteDraftPrompt = (userNotes: string | null, className?: string | null) => `You are a lecture notes assistant producing a fast first draft as a Tiptap JSON document.

${buildSubjectContext(className ?? undefined)}

Goal: produce a usable, structured draft quickly.
- Preserve the student's notes verbatim where they exist.
- Fill only the highest-confidence gaps from the lecture audio.
- Use H1/H2/H3 hierarchy and bullets for concepts.
- Include bold key terms and blockquotes for direct definitions.
- Do NOT include "Key Concepts" or "Potential Exam Questions" yet.
- Be concise and prioritize clarity over completeness.

${TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}`;

const buildNoteEnrichPrompt = (userNotes: string | null, className: string | null | undefined, draftDoc: unknown) => `You are a lecture notes assistant refining an existing draft into a complete study-ready set of notes as Tiptap JSON.

${buildSubjectContext(className ?? undefined)}

Requirements:
- Preserve the structure and wording of the draft unless accuracy requires improvement.
- Keep the strongest parts of the student's original notes.
- Add missing terms, definitions, examples, and connective explanations.
- End sections with short takeaways when helpful.
- Add a "Key Concepts" section.
- Add a "Potential Exam Questions" section with 3-5 questions.

${TIPTAP_FORMAT}

Student notes:
${userNotes || 'No student notes were provided.'}

Current draft JSON:
${JSON.stringify(draftDoc)}`;

const buildYoutubeSourcePrompt = (className?: string | null) => `You are an expert academic note taker watching an educational YouTube video.
Produce clean, complete notes as a Tiptap JSON document that can be reused to generate other study materials.

${buildSubjectContext(className ?? undefined)}

Requirements:
- Organize content into H1/H2/H3 sections.
- Use bullet lists for concepts and ordered lists for sequential steps.
- Bold key terms on first mention.
- Use blockquotes for compact definitions or laws.
- Include a final "Key Concepts" section.
- Be detailed enough that flashcards, guides, and exams can be generated from this output alone.

${TIPTAP_FORMAT}`;

const shouldFallbackToFinalModel = (error: unknown) => {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('model') || message.includes('not found') || message.includes('unsupported');
};

const streamWithFallback = async ({
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
}) => {
  try {
    return ai.streamContent({ model: primaryModel, messages, maxTokens });
  } catch (error) {
    if (primaryModel !== fallbackModel && shouldFallbackToFinalModel(error)) {
      return ai.streamContent({ model: fallbackModel, messages, maxTokens });
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

const transcribeAudio = async ({
  ai,
  audioPath,
  admin,
  reporter,
}: {
  ai: AiClient;
  audioPath: string;
  admin: any;
  reporter: ReturnType<typeof createJobReporter>;
}): Promise<string> => {
  await reporter.update('fetching_audio', 12, 'Fetching lecture audio');
  const { data: audioData, error: storageError } = await admin.storage.from('note-audio').download(audioPath);
  if (storageError || !audioData) {
    throw createHttpError('Failed to retrieve audio file.', 500);
  }

  await reporter.update('processing_media', 24, 'Transcribing audio');
  const audioMimeType = getAudioMimeType(audioPath);
  const audioBlob = new Blob([await audioData.arrayBuffer()], { type: audioMimeType });
  const filename = audioPath.split('/').pop() || 'audio.webm';

  return ai.transcribeAudio(audioBlob, filename);
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

const getApiKeyAndClient = () => {
  const apiKey = Deno.env.get('GROQ_API_KEY') ?? '';
  if (!apiKey) {
    throw createHttpError('AI integration is not configured on the server.', 500);
  }
  return createAiClient(apiKey);
};

const processNoteEnhancementJob = async ({
  admin,
  job,
}: JobProcessorArgs) => {
  const reporter = createJobReporter(admin, job);
  const input = (job.input_payload || {}) as Record<string, unknown>;
  const noteId = String(input.noteId || '');
  const audioPath = String(input.audioPath || '');
  const userNotesSnapshot = typeof input.userNotesSnapshot === 'string' ? input.userNotesSnapshot : null;
  const titleSnapshot = typeof input.titleSnapshot === 'string' ? input.titleSnapshot : 'Enhanced Notes';
  const className = typeof input.className === 'string' ? input.className : null;

  if (!noteId || !audioPath) {
    throw createHttpError('Note enhancement job is missing required audio context.', 400);
  }

  const modelMap = getAiModelMap();
  const ai = getApiKeyAndClient();
  const jobStartedAt = Date.now();
  let firstPreviewAt: number | null = null;

  await reporter.markRunning('accepted', 5, 'Accepted note enhancement job');

  const transcription = await transcribeAudio({ ai, audioPath, admin, reporter });

  const draftMessages: AiMessage[] = [{
    role: 'user',
    content: `${buildNoteDraftPrompt(userNotesSnapshot, className)}\n\nLecture Audio Transcription:\n${transcription}`,
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

  await reporter.update('enriching', 72, 'Enriching draft with examples and study aids', {
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
      content: `${buildNoteEnrichPrompt(userNotesSnapshot, className, draftDoc)}\n\nLecture Audio Transcription:\n${transcription}`,
    }],
    responseFormat: 'json_object',
  });

  let finalDoc: unknown;
  try {
    finalDoc = parseAiJsonResponse(
      enrichText,
      'AI generated invalid enhanced notes format. Please try again.',
    );
  } catch {
    finalDoc = draftDoc;
  }

  await reporter.markSaving('Saving enhanced notes', {
    final_doc: finalDoc,
    note_id: noteId,
    metrics: {
      server_total_ms: Date.now() - jobStartedAt,
      first_preview_ms: firstPreviewAt == null ? null : firstPreviewAt - jobStartedAt,
      ai_model_stage: {
        draft: modelMap.draft,
        final: modelMap.final,
      },
    },
  });

  const { error: updateError } = await admin
    .from('notes')
    .update({
      enhanced_content: finalDoc,
      content: finalDoc,
      audio_url: null,
      source_type: 'audio',
    })
    .eq('id', noteId)
    .eq('user_id', job.user_id);

  if (updateError) throw updateError;

  admin.storage.from('note-audio').remove([audioPath]).catch(() => {});

  await reporter.complete({
    message: 'Notes enhanced successfully',
    targetType: 'note',
    targetId: noteId,
    resultPatch: {
      final_doc: finalDoc,
      note_id: noteId,
    },
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

  const transcript = await fetchYoutubeTranscript(youtubeUrl);
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

  const messages: AiMessage[] = [{
    role: 'user',
    content: `${buildYoutubeSourcePrompt(className)}\n\nVideo Source Material:\n${preparedSource.sourceText}`,
  }];

  const streamResult = await streamDocPreview({
    ai,
    model: modelMap.final,
    fallbackModel: modelMap.final,
    messages,
    reporter,
    phase: 'drafting',
    startPercent: 26,
    endPercent: 78,
    message: 'Building reusable video notes',
  });

  if (streamResult.firstPreviewAt != null) {
    firstPreviewAt = streamResult.firstPreviewAt;
  }

  const sourceDoc = streamResult.doc;
  const sourceText = extractTextFromTiptapDoc(sourceDoc);

  await reporter.complete({
    message: 'Video source material is ready',
    targetType: 'youtube_source',
    targetId: sourceKey,
    resultPatch: {
      source_doc: sourceDoc,
      source_text: sourceText,
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
          source: modelMap.final,
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

  // Consume AI quota only after confirming source job succeeded
  const { data: quotaUser, error: quotaUserError } = await admin
    .from('users')
    .select('subscription_tier, ai_generations_count, last_ai_generation_reset, role, simulate_free_tier')
    .eq('id', job.user_id)
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
        .eq('id', job.user_id);
      if (updateError) throw updateError;
    },
  });

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

  await reporter.markRunning('drafting', 18, 'Generating study artifact', {
    source_key: sourceKey,
  });

  if (job.kind === 'youtube_notes') {
    await reporter.markSaving('Saving imported notes', {
      preview_text: sourceText,
      preview_doc: sourcePayload.source_doc,
      preview_sections: (sourcePayload.source_doc as Record<string, unknown> | undefined)?.content || [],
    });

    const noteId = await createNote({
      admin,
      userId: job.user_id,
      title: effectiveTitle || 'YouTube Notes',
      classId,
      content: sourcePayload.source_doc,
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
        className,
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
        masteryData: null,
        weakTopics: null,
        examMode: null,
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
    coachConfig: null,
  }));

  const streamResponse = await streamWithFallback({
    ai,
    primaryModel: modelMap.final,
    fallbackModel: modelMap.final,
    messages: guideMessages,
    maxTokens: 6144,
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

  if (
    job.kind === 'youtube_deck'
    || job.kind === 'youtube_guide'
    || job.kind === 'youtube_exam'
    || job.kind === 'youtube_notes'
  ) {
    return processYoutubeDerivedJob({ admin, job });
  }

  throw createHttpError('Unsupported AI job kind.', 400);
};
