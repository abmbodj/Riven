import { Buffer } from 'node:buffer';

import { GoogleGenAI } from 'npm:@google/genai@1.42.0';
import mammoth from 'npm:mammoth@1.11.0';

import {
  buildDeckContents,
  buildExamContents,
  buildGuideContents,
  buildSubjectContext,
  buildYoutubeNotesContents,
  createHttpError,
  parseAiJsonResponse,
} from './aiCore.mjs';
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
  contents,
  config,
}: {
  ai: GoogleGenAI;
  primaryModel: string;
  fallbackModel: string;
  contents: Array<Record<string, unknown>>;
  config: Record<string, unknown>;
}) => {
  try {
    return await ai.models.generateContentStream({
      model: primaryModel,
      contents,
      config,
    });
  } catch (error) {
    if (primaryModel !== fallbackModel && shouldFallbackToFinalModel(error)) {
      return ai.models.generateContentStream({
        model: fallbackModel,
        contents,
        config,
      });
    }
    throw error;
  }
};

const generateWithFallback = async ({
  ai,
  primaryModel,
  fallbackModel,
  contents,
  config,
}: {
  ai: GoogleGenAI;
  primaryModel: string;
  fallbackModel: string;
  contents: Array<Record<string, unknown>>;
  config: Record<string, unknown>;
}) => {
  try {
    return await ai.models.generateContent({
      model: primaryModel,
      contents,
      config,
    });
  } catch (error) {
    if (primaryModel !== fallbackModel && shouldFallbackToFinalModel(error)) {
      return ai.models.generateContent({
        model: fallbackModel,
        contents,
        config,
      });
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
  };
  return mimeMap[ext] || 'audio/webm';
};

const prepareAudioContent = async ({
  ai,
  audioPath,
  noteId,
  admin,
  reporter,
}: {
  ai: GoogleGenAI;
  audioPath: string;
  noteId: string;
  admin: any;
  reporter: ReturnType<typeof createJobReporter>;
}) => {
  await reporter.update('fetching_audio', 12, 'Fetching lecture audio');
  const { data: audioData, error: storageError } = await admin.storage.from('note-audio').download(audioPath);
  if (storageError || !audioData) {
    throw createHttpError('Failed to retrieve audio file.', 500);
  }

  const audioArrayBuffer = await audioData.arrayBuffer();
  const audioUint8 = new Uint8Array(audioArrayBuffer);
  const audioMimeType = getAudioMimeType(audioPath);

  const inlineDataLimit = 20 * 1024 * 1024;
  if (audioUint8.byteLength < inlineDataLimit) {
    await reporter.update('processing_media', 24, 'Preparing audio for AI');
    const base64Audio = Buffer.from(audioUint8).toString('base64');
    return {
      audioContent: {
        inlineData: {
          data: base64Audio,
          mimeType: audioMimeType,
        },
      },
      cleanupFileName: null as string | null,
    };
  }

  await reporter.update('processing_media', 24, 'Uploading lecture audio for AI processing');
  const uploadedFile = await ai.files.upload({
    file: new Blob([audioUint8], { type: audioMimeType }),
    config: {
      mimeType: audioMimeType,
      displayName: `lecture-${noteId}`,
    },
  });

  const maxWaitMs = 120_000;
  const pollIntervalMs = 3_000;
  const waitStart = Date.now();

  let file = uploadedFile;
  while (file.state === 'PROCESSING') {
    if (Date.now() - waitStart > maxWaitMs) {
      ai.files.delete({ name: file.name! }).catch(() => {});
      throw createHttpError('Audio processing timed out. Try a shorter recording or retry.', 504);
    }

    await reporter.update('processing_media', 28, 'Waiting for audio preprocessing');
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    file = await ai.files.get({ name: file.name! });
  }

  if (file.state === 'FAILED') {
    throw createHttpError('Audio processing failed. Please try again.', 500);
  }

  return {
    audioContent: {
      fileData: {
        fileUri: file.uri!,
        mimeType: audioMimeType,
      },
    },
    cleanupFileName: file.name!,
  };
};

const streamDocPreview = async ({
  ai,
  model,
  fallbackModel,
  contents,
  reporter,
  phase,
  startPercent,
  endPercent,
  message,
  resultKey = 'preview_doc',
}: {
  ai: GoogleGenAI;
  model: string;
  fallbackModel: string;
  contents: Array<Record<string, unknown>>;
  reporter: ReturnType<typeof createJobReporter>;
  phase: string;
  startPercent: number;
  endPercent: number;
  message: string;
  resultKey?: string;
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
    contents,
    config: {
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 6144,
    },
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
  contents,
  reporter,
  phase,
  startPercent,
  endPercent,
  message,
}: {
  ai: GoogleGenAI;
  model: string;
  fallbackModel: string;
  contents: Array<Record<string, unknown>>;
  reporter: ReturnType<typeof createJobReporter>;
  phase: string;
  startPercent: number;
  endPercent: number;
  message: string;
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
    contents,
    config: {
      temperature: 0,
      thinkingConfig: { thinkingBudget: 0 },
      maxOutputTokens: 4096,
    },
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
      description: 'Generated from YouTube via Gemini AI',
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
  content,
}: {
  admin: any;
  userId: number;
  title: string;
  classId: string | null | undefined;
  content: unknown;
}) => {
  const { data, error } = await admin
    .from('study_guides')
    .insert({
      user_id: userId,
      title,
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
  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    throw createHttpError('AI integration is not configured on the server.', 500);
  }

  const ai = new GoogleGenAI({ apiKey });
  const jobStartedAt = Date.now();
  let cleanupFileName: string | null = null;
  let firstPreviewAt: number | null = null;

  try {
    await reporter.markRunning('accepted', 5, 'Accepted note enhancement job');
    const { audioContent, cleanupFileName: uploadedFileName } = await prepareAudioContent({
      ai,
      audioPath,
      noteId,
      admin,
      reporter,
    });
    cleanupFileName = uploadedFileName;

    const draftContents = [
      { text: buildNoteDraftPrompt(userNotesSnapshot, className) },
      audioContent,
    ];

    const draftResult = await streamDocPreview({
      ai,
      model: modelMap.draft,
      fallbackModel: modelMap.final,
      contents: draftContents,
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

    const enrichResponse = await generateWithFallback({
      ai,
      primaryModel: modelMap.final,
      fallbackModel: modelMap.final,
      contents: [
        { text: buildNoteEnrichPrompt(userNotesSnapshot, className, draftDoc) },
        audioContent,
      ],
      config: {
        temperature: 0,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
      },
    });

    let finalDoc: unknown;
    try {
      finalDoc = parseAiJsonResponse(
        enrichResponse.text,
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

    if (cleanupFileName) {
      ai.files.delete({ name: cleanupFileName }).catch(() => {});
    }
    admin.storage.from('note-audio').remove([audioPath]).catch(() => {});

    await reporter.complete({
      message: 'Notes enhanced successfully',
      targetType: 'note',
      targetId: noteId,
      resultPatch: {
        final_doc: finalDoc,
        note_id: noteId,
        preview_doc: finalDoc,
        preview_sections: Array.isArray((finalDoc as Record<string, unknown>).content)
          ? (finalDoc as Record<string, unknown>).content
          : [],
      },
    });
  } catch (error) {
    if (cleanupFileName) {
      ai.files.delete({ name: cleanupFileName }).catch(() => {});
    }
    throw error;
  }
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

  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    throw createHttpError('AI integration is not configured on the server.', 500);
  }

  const ai = new GoogleGenAI({ apiKey });
  const jobStartedAt = Date.now();
  let firstPreviewAt: number | null = null;

  await reporter.markRunning('processing_media', 14, 'Analyzing YouTube video', {
    source_key: sourceKey,
  });

  const streamResult = await streamDocPreview({
    ai,
    model: getAiModelMap().final,
    fallbackModel: getAiModelMap().final,
    contents: [
      { text: buildYoutubeSourcePrompt(className) },
      buildYoutubeNotesContents(youtubeUrl, className)[1],
    ],
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
          source: getAiModelMap().final,
        },
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

  const apiKey = Deno.env.get('GEMINI_API_KEY') ?? '';
  if (!apiKey) {
    throw createHttpError('AI integration is not configured on the server.', 500);
  }

  const ai = new GoogleGenAI({ apiKey });
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
      contents: buildDeckContents({
        processedNotes: sourceText,
        hasProcessedNotes: true,
        keepFile: false,
        file: null,
        className,
      }),
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
      contents: buildExamContents({
        processedNotes: sourceText,
        hasProcessedNotes: true,
        keepFile: false,
        file: null,
        className,
        masteryData: null,
        weakTopics: null,
        examMode: null,
      }),
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

  const guideResult = await streamDocPreview({
    ai,
    model: modelMap.final,
    fallbackModel: modelMap.final,
    contents: buildGuideContents({
      processedNotes: sourceText,
      hasProcessedNotes: true,
      keepFile: false,
      file: null,
      className,
    }),
    reporter,
    phase: 'drafting',
    startPercent: 28,
    endPercent: 76,
    message: 'Generating study guide',
  });

  if (guideResult.firstPreviewAt != null) {
    firstPreviewAt = guideResult.firstPreviewAt;
  }

  const guideId = await createGuide({
    admin,
    userId: job.user_id,
    title: effectiveTitle || 'YouTube Study Guide',
    classId,
    content: guideResult.doc,
  });

  await reporter.complete({
    message: 'Study guide generated successfully',
    targetType: 'guide',
    targetId: guideId,
    resultPatch: {
      guide_id: guideId,
      final_doc: guideResult.doc,
      preview_doc: guideResult.doc,
      preview_sections: Array.isArray((guideResult.doc as Record<string, unknown>).content)
        ? (guideResult.doc as Record<string, unknown>).content
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
