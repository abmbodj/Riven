import { Buffer } from 'node:buffer';

const FREE_LIMIT = 10;
const PREMIUM_LIMIT = 50;
const PREMIUM_RESET_MS = 12 * 60 * 60 * 1000;

const isNewMonth = (lastReset, now) =>
  lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
  lastReset.getUTCMonth() !== now.getUTCMonth();
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

export const createHttpError = (message, status, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const isPrivilegedUser = (user) => (
  (user.role === 'owner' || user.role === 'admin') && !user.simulate_free_tier
);

const isPremiumUser = (user) => (
  isPrivilegedUser(user)
  || user.subscription_tier === 'supporter'
  || user.subscription_tier === 'lifetime'
);

const appendText = (currentText, nextText) => {
  if (!nextText) return currentText || '';
  if (!currentText) return nextText;
  return `${currentText}\n\n${nextText}`;
};

const buildSubjectContext = (className) => {
  const classHint = className
    ? `Material from "${className}". Use the class name to determine the subject area.`
    : 'Infer the subject area from the content.';

  return `${classHint}
Adapt format: STEM→formulas bold+blockquote, ordered lists for steps; Science→systems+cause-effect, bold terms; History→chronological, bold dates+events; CS→code marks for terms; Literature→blockquotes for passages; Languages→bold vocab.
Rules: H1/H2/H3 hierarchy. Bold key terms first use. Blockquotes for definitions/theorems. Zero filler. End sections with 1-sentence takeaway.`;
};

export { buildSubjectContext };

const cleanAiResponseText = (rawResponse) => {
  let cleaned = String(rawResponse ?? '').trim();

  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/u, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/u, '');
    cleaned = cleaned.replace(/\s*```$/u, '');
  }

  return cleaned.trim();
};

const buildDeckPrompt = (className) => `You are an expert tutor creating spaced-repetition flashcards.
Extract the most important facts, concepts, and definitions from the provided material.

${buildSubjectContext(className)}

Output ONLY a valid JSON array. No markdown, backticks, or text outside the array.
Each card: { "front": "question/term", "back": "answer/definition" }.
5-15 cards. Atomic (one concept per card). Accurate. Vary types: define, compare, explain why, apply, calculate.`;

const buildClassPrompt = () => `
You are an expert academic assistant designed to extract class information from a syllabus.
Extract the class details and a list of assignments from the provided syllabus document, image, or text notes.
Output ONLY a valid JSON object, with absolutely no markdown formatting, backticks, or conversational text outside the object.

The JSON object must have the following structure:
{
  "name": "Class Name (e.g. CS 101 or Computer Science 101)",
  "professor": "Professor Name (e.g. Dr. Jane Smith)",
  "room": "Room or Location (e.g. Building A, Room 102, or Online)",
  "times": [
     { "day": 1, "start_time": "09:00", "end_time": "10:30" }
  ],
  "assignments": [
     {
       "title": "Assignment Title",
       "description": "Any relevant details or description",
       "due_date": "ISO 8601 Timestamp (e.g., 2023-10-15T23:59:00.000Z) or null if no exact date is specified",
       "type": "homework"
     }
  ]
}

Rules:
1. ONLY return the JSON object.
2. If you cannot find a piece of information, you can leave it empty, null, or omit it (except for the structure keys).
3. Guess the closest matching types for assignments.
4. Give reasonable estimates for times if they are slightly ambiguous, but strictly adhere to format.
5. Due dates must be valid ISO 8601 timestamps if a date parsing is possible. Try to determine the year based on context, otherwise use the current year.
`;

export const buildDeckContents = ({ processedNotes, hasProcessedNotes, keepFile, file, className }) => {
  const contents = [{ text: buildDeckPrompt(className) }];

  if (hasProcessedNotes) {
    contents.push({ text: `\n\nLecture Notes/Text Content:\n${processedNotes}` });
  }

  if (keepFile) {
    contents.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType,
      },
    });
  }

  return contents;
};

const buildClassContents = ({ processedNotes, hasProcessedNotes, keepFile, file }) => {
  const contents = [{ text: buildClassPrompt() }];

  if (hasProcessedNotes) {
    contents.push({ text: `\n\nSyllabus Text Content:\n${processedNotes}` });
  }

  if (keepFile) {
    contents.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType,
      },
    });
  }

  return contents;
};

export const getAiLimitStatus = ({ user, now = new Date() }) => {
  const isPremium = isPremiumUser(user);
  const max = isPremium ? PREMIUM_LIMIT : FREE_LIMIT;
  const lastReset = user.last_ai_generation_reset ? new Date(user.last_ai_generation_reset) : null;
  const needsReset = !lastReset || (
    isPremium
      ? (now - lastReset > PREMIUM_RESET_MS)
      : isNewMonth(lastReset, now)
  );
  let count = Number(user.ai_generations_count ?? 0);

  if (needsReset) {
    count = 0;
  }

  const remaining = Math.max(0, max - count);

  return {
    isPremium,
    remaining,
    max,
    characterLimit: isPremium ? 50000 : 15000,
    flashcardRange: isPremium ? [5, 40] : [5, 15],
    canWatchAd: !isPremium && remaining === 0,
    count,
    lastReset,
    needsReset,
  };
};

export const consumeAiQuota = async ({ user, persistUsage, now = new Date() }) => {
  const status = getAiLimitStatus({ user, now });

  if (status.count >= status.max) {
    throw createHttpError(
      status.isPremium
        ? 'AI generation limit reached. Please try again later.'
        : 'AI generation limit reached. Watch an ad or upgrade to Premium for more.',
      429,
      { canWatchAd: !status.isPremium },
    );
  }

  const lastReset = status.needsReset || !status.lastReset ? now : status.lastReset;

  await persistUsage({
    count: status.count + 1,
    lastReset,
  });

  return {
    isPremium: status.isPremium,
    characterLimit: status.characterLimit,
    flashcardRange: status.flashcardRange,
  };
};

export const prepareAiSource = async ({ notes, file, parseDocx, onParseError }) => {
  const hasFile = Boolean(file?.data && file?.mimeType);
  let processedNotes = notes || '';
  let keepFile = hasFile;

  if (hasFile) {
    try {
      const fileBuffer = Buffer.from(file.data, 'base64');

      if (DOCX_MIME_TYPES.has(file.mimeType)) {
        if (typeof parseDocx !== 'function') {
          throw new Error('DOCX parsing is not available');
        }

        const parsedText = await parseDocx(fileBuffer);
        processedNotes = appendText(processedNotes, parsedText);
        keepFile = false;
      } else if (file.mimeType === 'text/plain') {
        processedNotes = appendText(processedNotes, fileBuffer.toString('utf8'));
        keepFile = false;
      }
    } catch (error) {
      onParseError?.(error);
      // If we failed to parse a document type, don't send the raw binary to the AI
      if (DOCX_MIME_TYPES.has(file.mimeType) || file.mimeType === 'text/plain') {
        keepFile = false;
      }
    }
  }

  return {
    processedNotes,
    hasProcessedNotes: processedNotes.trim() !== '',
    keepFile,
  };
};

export const parseAiJsonResponse = (rawResponse, invalidMessage) => {
  try {
    return JSON.parse(cleanAiResponseText(rawResponse));
  } catch {
    throw createHttpError(invalidMessage, 500);
  }
};

export const ensureApiKey = (apiKey) => {
  if (!apiKey) {
    throw createHttpError('AI integration is not configured on the server.', 500);
  }
};

export const generateDeckFromAi = async ({
  userId,
  notes,
  file,
  deckName,
  classId,
  className,
  aiLimitsContext,
  apiKey,
  parseDocx,
  generateContent,
  createDeck,
  insertCards,
  deleteDeck,
  onParseError,
}) => {
  ensureApiKey(apiKey);

  const { processedNotes, hasProcessedNotes, keepFile } = await prepareAiSource({
    notes,
    file,
    parseDocx,
    onParseError,
  });

  if (!hasProcessedNotes && !keepFile) {
    throw createHttpError('Notes or a file are required to generate flashcards.', 400);
  }

  const characterLimit = aiLimitsContext?.characterLimit || 15000;
  if (hasProcessedNotes && processedNotes.length > characterLimit) {
    throw createHttpError(
      `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
      400,
    );
  }

  const rawResponse = await generateContent({
    model: 'llama-3.3-70b-versatile',
    contents: buildDeckContents({ processedNotes, hasProcessedNotes, keepFile, file, className }),
  });

  const flashcards = parseAiJsonResponse(
    rawResponse,
    'AI generated invalid flashcard format. Please try again.',
  );

  if (!Array.isArray(flashcards) || flashcards.length === 0) {
    throw createHttpError('AI failed to generate any usable flashcards.', 500);
  }

  const finalDeckName = deckName || 'AI Generated Deck';
  let createdDeck = null;

  try {
    createdDeck = await createDeck({
      userId,
      title: finalDeckName,
      description: 'Auto-generated via AI',
      classId: classId || null,
    });

    await insertCards(createdDeck.id, flashcards.map((card, index) => ({
      front: card.front,
      back: card.back,
      position: index,
    })));
  } catch (error) {
    if (createdDeck?.id && typeof deleteDeck === 'function') {
      try {
        await deleteDeck(createdDeck.id);
      } catch {
        // Ignore cleanup failures and surface the original error.
      }
    }

    throw error;
  }

  return {
    message: 'Deck generated successfully',
    deck_id: createdDeck.id,
    card_count: flashcards.length,
  };
};

// ─────────────────────────────────────────────────────
// Study Guide generation
// ─────────────────────────────────────────────────────

const TIPTAP_FORMAT = `Output ONLY valid JSON: { "type": "doc", "content": [...] }. No markdown/backticks outside JSON.
Node types: heading (attrs.level 1-3), paragraph, bulletList→listItem→paragraph, orderedList→listItem→paragraph, blockquote→paragraph, horizontalRule.
Text marks: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code).`;

const buildGuidePrompt = (className) => `You are an expert tutor creating a comprehensive study guide as a Tiptap JSON document.

${buildSubjectContext(className)}

${TIPTAP_FORMAT}
Be thorough. Bold key terms first use. Blockquotes for definitions/theorems. End sections with takeaway.`;

export const buildGuideContents = ({ processedNotes, hasProcessedNotes, keepFile, file, className }) => {
  const contents = [{ text: buildGuidePrompt(className) }];

  if (hasProcessedNotes) {
    contents.push({ text: `\n\nSource Material:\n${processedNotes}` });
  }

  if (keepFile) {
    contents.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType,
      },
    });
  }

  return contents;
};

export const generateStudyGuideFromAi = async ({
  userId,
  notes,
  file,
  title,
  noteId,
  classId,
  className,
  aiLimitsContext,
  apiKey,
  parseDocx,
  generateContent,
  createGuide,
  deleteGuide,
  onParseError,
}) => {
  ensureApiKey(apiKey);

  const { processedNotes, hasProcessedNotes, keepFile } = await prepareAiSource({
    notes,
    file,
    parseDocx,
    onParseError,
  });

  if (!hasProcessedNotes && !keepFile) {
    throw createHttpError('Notes or a file are required to generate a study guide.', 400);
  }

  const characterLimit = aiLimitsContext?.characterLimit || 15000;
  if (hasProcessedNotes && processedNotes.length > characterLimit) {
    throw createHttpError(
      `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
      400,
    );
  }

  const rawResponse = await generateContent({
    model: 'llama-3.3-70b-versatile',
    contents: buildGuideContents({ processedNotes, hasProcessedNotes, keepFile, file, className }),
  });

  const guideContent = parseAiJsonResponse(
    rawResponse,
    'AI generated invalid study guide format. Please try again.',
  );

  if (!guideContent || typeof guideContent !== 'object' || guideContent.type !== 'doc') {
    throw createHttpError('AI failed to generate a valid study guide.', 500);
  }

  const finalTitle = title || 'AI Study Guide';
  let createdGuide = null;

  try {
    createdGuide = await createGuide({
      userId,
      title: finalTitle,
      content: guideContent,
      noteId: noteId || null,
      classId: classId || null,
    });
  } catch (error) {
    if (createdGuide?.id && typeof deleteGuide === 'function') {
      try {
        await deleteGuide(createdGuide.id);
      } catch {
        // Ignore cleanup failures
      }
    }
    throw error;
  }

  return {
    message: 'Study guide generated successfully',
    guide_id: createdGuide.id,
    title: finalTitle,
  };
};

// ─────────────────────────────────────────────────────
// Mock Exam generation
// ─────────────────────────────────────────────────────

const buildExamPrompt = (className) => `You are an expert tutor creating a practice exam that mirrors real university exams.
Produce a mix of MCQ and short-answer questions from the provided material.

${buildSubjectContext(className)}

Output ONLY a valid JSON array. No markdown, backticks, or text outside the array.
Generate 12-18 MCQ + 2-4 short_answer questions. Mix: 30% easy, 50% medium, 20% hard.

Every question MUST have: "type" ("mcq"/"short_answer"), "question", "topic" (specific concept), "difficulty" ("easy"/"medium"/"hard"), "correct_answer", "explanation".
MCQ also needs: "options" (exactly 4 strings, one matching correct_answer). Distractors plausible but clearly wrong.
short_answer also needs: "grading_rubric" (key points list), "correct_answer" (2-4 sentence model answer).
Vary types: recall, compare, apply, analyze. Cover wide range of topics.`;

const buildAdaptiveExamPrompt = (className, masteryData) => {
  const basePrompt = buildExamPrompt(className);

  if (!masteryData || !Array.isArray(masteryData) || masteryData.length === 0) {
    return basePrompt;
  }

  const weakTopics = masteryData
    .filter(t => t.mastery_score < 0.5)
    .map(t => `${t.topic} (mastery: ${Math.round(t.mastery_score * 100)}%)`)
    .slice(0, 8);

  const strongTopics = masteryData
    .filter(t => t.mastery_score > 0.8)
    .map(t => t.topic)
    .slice(0, 5);

  let adaptiveInstructions = '\n\nADAPTIVE INSTRUCTIONS (adjust question distribution based on student performance):\n';

  if (weakTopics.length > 0) {
    adaptiveInstructions += `- WEAK AREAS (focus ~60% of questions here): ${weakTopics.join(', ')}\n`;
    adaptiveInstructions += '- For weak areas, include more medium/hard questions to build understanding.\n';
  }

  if (strongTopics.length > 0) {
    adaptiveInstructions += `- MASTERED AREAS (include only 1-2 review questions): ${strongTopics.join(', ')}\n`;
  }

  adaptiveInstructions += '- Target overall difficulty so the student achieves approximately 70% accuracy.\n';

  return basePrompt + adaptiveInstructions;
};

const buildFocusedExamPrompt = (className, weakTopics) => {
  const basePrompt = buildExamPrompt(className);

  if (!weakTopics || !Array.isArray(weakTopics) || weakTopics.length === 0) {
    return basePrompt;
  }

  const focusInstructions = `

FOCUSED EXAM INSTRUCTIONS:
This is a targeted practice exam focusing ONLY on the student's weak areas.
- Generate questions EXCLUSIVELY about these topics: ${weakTopics.join(', ')}
- Generate 8-12 MCQ questions and 2-3 short-answer questions.
- Difficulty mix: 20% easy, 50% medium, 30% hard (slightly harder to push understanding).
- Ensure deep coverage of each topic with varied question angles.
`;

  return basePrompt + focusInstructions;
};

export { buildAdaptiveExamPrompt, buildFocusedExamPrompt };

export const buildExamContents = ({ processedNotes, hasProcessedNotes, keepFile, file, className, masteryData, weakTopics, examMode }) => {
  let prompt;
  if (examMode === 'focused' && weakTopics) {
    prompt = buildFocusedExamPrompt(className, weakTopics);
  } else if (examMode === 'adaptive' && masteryData) {
    prompt = buildAdaptiveExamPrompt(className, masteryData);
  } else {
    prompt = buildExamPrompt(className);
  }

  const contents = [{ text: prompt }];

  if (hasProcessedNotes) {
    contents.push({ text: `\n\nSource Material:\n${processedNotes}` });
  }

  if (keepFile) {
    contents.push({
      inlineData: {
        data: file.data,
        mimeType: file.mimeType,
      },
    });
  }

  return contents;
};

export const generateExamFromAi = async ({
  userId,
  notes,
  file,
  title,
  sourceType,
  sourceId,
  classId,
  className,
  aiLimitsContext,
  apiKey,
  parseDocx,
  generateContent,
  createExam,
  deleteExam,
  onParseError,
}) => {
  ensureApiKey(apiKey);

  const { processedNotes, hasProcessedNotes, keepFile } = await prepareAiSource({
    notes,
    file,
    parseDocx,
    onParseError,
  });

  if (!hasProcessedNotes && !keepFile) {
    throw createHttpError('Notes or a file are required to generate an exam.', 400);
  }

  const characterLimit = aiLimitsContext?.characterLimit || 15000;
  if (hasProcessedNotes && processedNotes.length > characterLimit) {
    throw createHttpError(
      `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
      400,
    );
  }

  const rawResponse = await generateContent({
    model: 'llama-3.3-70b-versatile',
    contents: buildExamContents({ processedNotes, hasProcessedNotes, keepFile, file, className }),
  });

  const questions = parseAiJsonResponse(
    rawResponse,
    'AI generated invalid exam format. Please try again.',
  );

  if (!Array.isArray(questions) || questions.length === 0) {
    throw createHttpError('AI failed to generate any exam questions.', 500);
  }

  // Validate question structure (MCQ + short_answer)
  const validQuestions = questions.filter(q => {
    if (!q.question || !q.correct_answer) return false;
    if (!q.type) q.type = 'mcq';
    if (q.type === 'short_answer') return Boolean(q.grading_rubric);
    return Array.isArray(q.options) && q.options.length === 4
      && q.options.includes(q.correct_answer);
  });

  if (validQuestions.length === 0) {
    throw createHttpError('AI generated questions in an invalid format. Please try again.', 500);
  }

  const finalTitle = title || 'AI Mock Exam';
  let createdExam = null;

  try {
    createdExam = await createExam({
      userId,
      title: finalTitle,
      sourceType: sourceType || 'notes',
      sourceId: sourceId || null,
      classId: classId || null,
      questions: validQuestions,
    });
  } catch (error) {
    if (createdExam?.id && typeof deleteExam === 'function') {
      try {
        await deleteExam(createdExam.id);
      } catch {
        // Ignore cleanup failures
      }
    }
    throw error;
  }

  return {
    message: 'Mock exam generated successfully',
    exam_id: createdExam.id,
    question_count: validQuestions.length,
  };
};

// ─────────────────────────────────────────────────────
// YouTube video source helpers
// ─────────────────────────────────────────────────────

export const validateYoutubeUrl = (url) => {
  try {
    const parsed = new URL(url);
    const isYouTube =
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'youtu.be' ||
      parsed.hostname === 'm.youtube.com';
    if (!isYouTube) return false;
    if (parsed.hostname === 'youtu.be') return parsed.pathname.length > 1;
    return Boolean(parsed.searchParams.get('v'));
  } catch {
    return false;
  }
};

export const normalizeYoutubeUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'youtu.be') {
      return `https://www.youtube.com/watch?v=${parsed.pathname.slice(1).split('/')[0].split('?')[0]}`;
    }
    const v = parsed.searchParams.get('v');
    return `https://www.youtube.com/watch?v=${v}`;
  } catch {
    return url;
  }
};

const buildYoutubeVideoSource = (transcript) => ({
  text: `Video Transcript:\n${transcript}`,
});

export const buildYoutubeDeckContents = (youtubeUrl, className) => [
  { text: buildDeckPrompt(className) },
  buildYoutubeVideoSource(youtubeUrl),
];

export const buildYoutubeGuideContents = (youtubeUrl, className) => [
  { text: buildGuidePrompt(className) },
  buildYoutubeVideoSource(youtubeUrl),
];

export const buildYoutubeExamContents = (youtubeUrl, className) => [
  { text: buildExamPrompt(className) },
  buildYoutubeVideoSource(youtubeUrl),
];

const buildNotesFromVideoPrompt = (className) => `You are an expert note-taker watching an educational YouTube video.
Produce concise, complete notes as a Tiptap JSON document.

${buildSubjectContext(className)}

${TIPTAP_FORMAT}
Bold key terms first use. Blockquotes for definitions/theorems. End sections with takeaway. Include "Key Concepts" summary section.`;

export const buildYoutubeNotesContents = (youtubeUrl, className) => [
  { text: buildNotesFromVideoPrompt(className) },
  buildYoutubeVideoSource(youtubeUrl),
];

export const generateClassPreview = async ({
  notes,
  file,
  apiKey,
  parseDocx,
  generateContent,
  onParseError,
}) => {
  ensureApiKey(apiKey);

  const { processedNotes, hasProcessedNotes, keepFile } = await prepareAiSource({
    notes,
    file,
    parseDocx,
    onParseError,
  });

  if (!hasProcessedNotes && !keepFile) {
    throw createHttpError('A syllabus file or text notes are required.', 400);
  }

  const rawResponse = await generateContent({
    model: 'llama-3.3-70b-versatile',
    contents: buildClassContents({ processedNotes, hasProcessedNotes, keepFile, file }),
  });

  return {
    classData: parseAiJsonResponse(
      rawResponse,
      'AI generated invalid class format. Please try again.',
    ),
  };
};
