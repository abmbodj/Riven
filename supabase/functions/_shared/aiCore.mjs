import { Buffer } from 'node:buffer';

const FREE_LIMIT = 10;
const PREMIUM_LIMIT = 50;
const RESET_MS = 2 * 60 * 60 * 1000;
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

const buildDeckPrompt = () => `
You are an expert tutor creating highly effective spaced-repetition flashcards.
Extract the most important facts, concepts, and definitions from the provided lecture notes, document, or image, and output them as a precise JSON array of flashcards.

Rules:
1. Output ONLY a valid JSON array, with absolutely no markdown formatting, backticks, or conversational text outside the array.
2. Each flashcard should have exactly two keys: "front" and "back".
3. The "front" should be a clear, concise question or term.
4. The "back" should be the direct answer or definition.
5. Generate between 5 and 15 flashcards depending on the length and density of the source material.
6. Make the cards atomic (one concept per card).
7. Ensure definitions are accurate based on the provided material.

Example JSON format:
[
  {
    "front": "What is the powerhouse of the cell?",
    "back": "Mitochondria"
  }
]
`;

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

const buildDeckContents = ({ processedNotes, hasProcessedNotes, keepFile, file }) => {
  const contents = [{ text: buildDeckPrompt() }];

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
  const needsReset = !lastReset || (now - lastReset > RESET_MS);
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

const ensureApiKey = (apiKey) => {
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
    model: 'gemini-2.5-flash',
    contents: buildDeckContents({ processedNotes, hasProcessedNotes, keepFile, file }),
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
      description: 'Auto-generated via Gemini AI',
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

const buildGuidePrompt = () => `
You are an expert tutor creating a comprehensive study guide.
Given the following notes, document, or image, produce a well-structured study guide as a Tiptap-compatible JSON document.

Rules:
1. Output ONLY a valid JSON object with this exact top-level structure: { "type": "doc", "content": [ ... ] }
2. No markdown formatting, backticks, or conversational text outside the JSON object.
3. Use these node types:
   - { "type": "heading", "attrs": { "level": 1 }, "content": [{ "type": "text", "text": "..." }] }
   - { "type": "heading", "attrs": { "level": 2 }, "content": [{ "type": "text", "text": "..." }] }
   - { "type": "heading", "attrs": { "level": 3 }, "content": [{ "type": "text", "text": "..." }] }
   - { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }
   - { "type": "bulletList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] }] }
   - { "type": "orderedList", "content": [{ "type": "listItem", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] }] }
   - { "type": "blockquote", "content": [{ "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }] }
   - { "type": "horizontalRule" }
4. For text marks use: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code)
5. Organize content with: Overview, Key Concepts, Important Details, and Summary sections.
6. Be thorough — cover all important material from the source.
7. Use bold for key terms and italic for definitions or emphasis.
`;

const buildGuideContents = ({ processedNotes, hasProcessedNotes, keepFile, file }) => {
  const contents = [{ text: buildGuidePrompt() }];

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
    model: 'gemini-2.5-flash',
    contents: buildGuideContents({ processedNotes, hasProcessedNotes, keepFile, file }),
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

const buildExamPrompt = () => `
You are an expert tutor creating a challenging but fair practice exam.
Given the following notes, document, or image, produce a set of multiple-choice questions to test the student's understanding.

Rules:
1. Output ONLY a valid JSON array of question objects, with absolutely no markdown formatting, backticks, or conversational text outside the array.
2. Each question must have exactly these keys:
   - "question": A clear, well-formed question string.
   - "options": An array of exactly 4 answer choices (strings). One must be correct.
   - "correct_answer": The exact string from options that is the correct answer.
   - "explanation": A brief explanation of why the correct answer is right.
3. Generate between 10 and 20 questions depending on the length and density of the source material.
4. Cover a wide range of topics from the material.
5. Include a mix of difficulty levels (easy, medium, hard).
6. Make distractors (wrong answers) plausible but clearly incorrect.
7. Avoid trick questions or ambiguous wording.

Example JSON format:
[
  {
    "question": "What is the primary function of mitochondria?",
    "options": ["Protein synthesis", "Energy production", "DNA replication", "Cell division"],
    "correct_answer": "Energy production",
    "explanation": "Mitochondria are known as the powerhouse of the cell because they produce ATP through cellular respiration."
  }
]
`;

const buildExamContents = ({ processedNotes, hasProcessedNotes, keepFile, file }) => {
  const contents = [{ text: buildExamPrompt() }];

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
    model: 'gemini-2.5-flash',
    contents: buildExamContents({ processedNotes, hasProcessedNotes, keepFile, file }),
  });

  const questions = parseAiJsonResponse(
    rawResponse,
    'AI generated invalid exam format. Please try again.',
  );

  if (!Array.isArray(questions) || questions.length === 0) {
    throw createHttpError('AI failed to generate any exam questions.', 500);
  }

  // Validate question structure
  const validQuestions = questions.filter(q =>
    q.question && Array.isArray(q.options) && q.options.length === 4
    && q.correct_answer && q.options.includes(q.correct_answer)
  );

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
    model: 'gemini-2.5-flash',
    contents: buildClassContents({ processedNotes, hasProcessedNotes, keepFile, file }),
  });

  return {
    classData: parseAiJsonResponse(
      rawResponse,
      'AI generated invalid class format. Please try again.',
    ),
  };
};
