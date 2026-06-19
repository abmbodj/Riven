import { Buffer } from 'node:buffer';
import {
  STUDY_GUIDE_FORMAT_VERSION,
  buildStudyGuideSummaryDoc,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
  validateTutorSessionQuality,
} from './studyGuideCore.mjs';
import { getSubjectStrategy, resolveNoteStrategy } from './subjectStrategies.mjs';
import { isPremiumActive } from './premiumAccess.mjs';

const FREE_LIMIT = 10;

/**
 * Central model map. Change `guide` here (or via env) to A/B a stronger model
 * for guide generation without touching deck/exam paths.
 */
export const aiModelMap = {
  default: 'meta-llama/llama-4-scout-17b-16e-instruct',
  guide: 'meta-llama/llama-4-scout-17b-16e-instruct',
  grading: 'meta-llama/llama-4-scout-17b-16e-instruct',
};
const PREMIUM_LIMIT = 50;
const PREMIUM_RESET_MS = 12 * 60 * 60 * 1000;

const isNewMonth = (lastReset, now) =>
  lastReset.getUTCFullYear() !== now.getUTCFullYear() ||
  lastReset.getUTCMonth() !== now.getUTCMonth();
const DOCX_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

// RIV-009: only these binary types are forwarded to Gemini as inlineData. The client
// supplies mimeType, so we verify the actual bytes match the declared type first.
const INLINE_FILE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const matchesMagicBytes = (buffer, mimeType) => {
  if (!buffer || buffer.length < 4) return false;
  switch (mimeType) {
    case 'application/pdf':
      return buffer.slice(0, 5).toString('latin1') === '%PDF-';
    case 'image/png':
      return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
    case 'image/jpeg':
      return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case 'image/webp':
      return buffer.length >= 12
        && buffer.slice(0, 4).toString('latin1') === 'RIFF'
        && buffer.slice(8, 12).toString('latin1') === 'WEBP';
    default:
      return false;
  }
};

export const createHttpError = (message, status, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const isPremiumUser = (user, now) => isPremiumActive(user, now);

const appendText = (currentText, nextText) => {
  if (!nextText) return currentText || '';
  if (!currentText) return nextText;
  return `${currentText}\n\n${nextText}`;
};

const resolveSubject = (className, subject) =>
  resolveNoteStrategy({ className, subject }).subject;

const buildSubjectContext = (className, subject) => {
  const resolved = resolveSubject(className, subject);
  const strategy = getSubjectStrategy(resolved);

  const classHint = className
    ? `Material from "${className}". Subject area: ${resolved}.`
    : `Subject area: ${resolved}. Infer additional context from the content.`;

  const parts = [classHint];
  if (strategy.notation) parts.push(`Notation: ${strategy.notation}`);
  if (strategy.formatting) parts.push(strategy.formatting);
  return parts.join('\n');
};

const buildMathTutorInstructions = (subject) => (
  subject === 'Mathematics'
    ? `
Mathematics tutor requirements:
- Teach like The Organic Chemistry Tutor solving at a board: identify the problem type, choose the method, write the equation, solve one legal step at a time, check the answer, then give the student a similar practice prompt.
- Every formula, variable, expression, equation, substitution, derivative, integral, and final answer MUST be in LaTeX using $...$ inline or $$...$$ for display equations.
- Each worked example title should signal progression, such as "Example 1: Basic Solve" and "Example 2: Harder Case".
- Each worked example must include a problem with LaTeX, then step objects whose "step" field contains the actual equation line in LaTeX and whose "detail" field explains why that operation is legal.
- Show method selection explicitly: when to factor vs. use the quadratic formula, when to substitute, when to differentiate/integrate, or which theorem/formula applies.
- Common mistakes must be computational: sign errors, distribution/factoring mistakes, cancellation errors, missing constants, wrong derivative/integral rules, domain restrictions, or unit mistakes. Include the wrong move and the correction.
- The card prompt must be a concise practice problem in LaTeX that matches the method just taught.`
    : ''
);

export { buildSubjectContext };

export const buildNaturalNoteStyleInstructions = ({
  includeKeyConcepts = false,
  preserveStudentPhrasing = true,
  allowReviewSummary = false,
} = {}) => {
  const lines = [
    'Voice and structure:',
    '- Write as study material a college student could actually learn from: clear, human, academically solid, and organized for later review.',
    '- Aim for a hybrid of study packet and real notebook notes: structured enough to scan fast, loose enough to feel student-made rather than published prose.',
    preserveStudentPhrasing
      ? '- Preserve the student\'s original wording when it is already clear and accurate.'
      : '- Use a natural explanatory voice rather than an executive-summary voice.',
    '- Use H2 headings to mark major topic shifts and H3 for sub-topics. Do not leave the document as a flat bullet list or a wall of paragraphs.',
    '- Introduce concepts in dependency order: foundations first, then things that build on them.',
    '- Prefer short explanatory paragraphs when explaining *what* or *why*. Use bullets only for real lists, steps, or parallel items.',
    '- Every major section should feel chunked: usually a heading, a short framing line, then bullets, steps, examples, or compact explanation blocks.',
    '- Break long prose into note-sized chunks. If a paragraph starts reading like textbook narration, split it into shorter note blocks.',
    '- Use short notebook-style bridge lines such as "What matters:", "Why it matters:", "Key shift:", or "Watch for:" when they help a student review quickly.',
    '- Bold a term on first use, immediately followed by its definition.',
    '- Use blockquotes only for short verbatim definitions, theorems, or laws.',
    '',
    'Content contract (non-negotiable):',
    '- Every bolded technical term MUST be followed within the same paragraph or the next sentence by a one-sentence plain-language definition.',
    '- Every abstract concept MUST have at least one concrete example, analogy, or worked instance. If the source material does not provide one, add a high-confidence generic example.',
    '- Never list a term without defining it on first mention.',
    '- Never introduce jargon without unpacking it in plain language.',
    '- Multi-topic notes must be visibly sectioned so a student can skim topic boundaries at a glance.',
    '',
    'Signal vs. noise:',
    '- Strip filler, tangents, small talk, and off-topic chatter. Keep only material a learner would actually study or act on.',
    '- If the speaker flagged anything time-sensitive (a deadline, an assignment, a due date, a follow-up, or a next step), collect it under exactly one short H2 heading named "Action items" near the end, as a tight bullet list. Omit this section entirely when there is nothing time-sensitive.',
    '- Surface what the speaker emphasized. When a point is repeated or marked as important ("this is important", "this will be on the exam", "you must", "key thing"), keep it and flag it with a brief cue like "Important:" or "Watch for:" so it stands out.',
    '',
    'Fidelity:',
    '- Use only what the transcript supports; do not invent facts, dates, names, or numbers.',
    '- If a technical term was clearly mis-transcribed (a phonetically close garble of a known domain term), reconstruct the intended term from context and use the corrected form — but never fabricate content around it.',
    '',
    'Forbidden:',
    '- Filler transitions like "In summary,", "Overall,", "It is important to note", "In conclusion".',
    '- Motivational or meta commentary about learning.',
    '- Restating the introduction at the end.',
    '- Exam-question sections.',
    '- Long uninterrupted essay paragraphs unless the subject genuinely requires close analysis.',
    '- Literal markdown styling markers like **bold** or __underline__ in the text output. Use proper Tiptap marks instead.',
    allowReviewSummary
      ? '- Generic recap / summary / conclusion sections longer than 1-2 sentences. A method-specific "Review Summary" is allowed only when the note method requests it.'
      : includeKeyConcepts
      ? '- Do not add a redundant "Key Concepts" recap unless the lecture itself explicitly summarizes at the end; the notes should stand on their own without a restated summary.'
      : '- Recap / "Key Concepts" / "Summary" / "Conclusion" sections.',
  ];

  return lines.join('\n');
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

const buildDeckPrompt = (className, subject) => {
  const resolved = resolveSubject(className, subject);
  const strategy = getSubjectStrategy(resolved);
  const cardHint = strategy.cardStyle ? `\n${strategy.cardStyle}` : '';
  return `You are an expert tutor creating spaced-repetition flashcards.
Extract the most important facts, concepts, and definitions from the provided material.

${buildSubjectContext(className, subject)}

Output ONLY a valid JSON array. No markdown, backticks, or text outside the array.
Each card: { "front": "question/term", "back": "answer/definition" }.
5-15 cards. Atomic (one concept per card). Accurate. Vary types: define, compare, explain why, apply, calculate.${cardHint}`;
};

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

export const buildDeckContents = ({ processedNotes, hasProcessedNotes, keepFile, file, className, subject, knowledgeContext = '' }) => {
  const contents = [{ text: buildDeckPrompt(className, subject) }];

  if (knowledgeContext) {
    contents.push({ text: `\n\n${knowledgeContext}` });
  }

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
  const isPremium = isPremiumUser(user, now);
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
    characterLimit: isPremium ? 100000 : 30000,
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
    let fileBuffer;
    try {
      fileBuffer = Buffer.from(file.data, 'base64');
    } catch (error) {
      onParseError?.(error);
      keepFile = false;
    }

    if (keepFile && fileBuffer) {
      if (DOCX_MIME_TYPES.has(file.mimeType)) {
        try {
          if (typeof parseDocx !== 'function') {
            throw new Error('DOCX parsing is not available');
          }
          processedNotes = appendText(processedNotes, await parseDocx(fileBuffer));
        } catch (error) {
          onParseError?.(error);
        }
        // Parsed (or failed) document text — never forward the raw binary to the AI.
        keepFile = false;
      } else if (file.mimeType === 'text/plain') {
        processedNotes = appendText(processedNotes, fileBuffer.toString('utf8'));
        keepFile = false;
      } else if (!INLINE_FILE_MIME_TYPES.has(file.mimeType) || !matchesMagicBytes(fileBuffer, file.mimeType)) {
        // RIV-009: drop files whose declared type is not allowed or whose bytes don't
        // match the claimed mimeType, instead of trusting the client and forwarding them.
        onParseError?.(new Error(`Unsupported or mismatched file type: ${file.mimeType}`));
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
  subject,
  knowledgeContext,
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
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    contents: buildDeckContents({ processedNotes, hasProcessedNotes, keepFile, file, className, subject, knowledgeContext }),
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

const buildGuidePrompt = (className, subject) => {
  const resolved = resolveSubject(className, subject);
  const strategy = getSubjectStrategy(resolved);
  const guideHint = strategy.guideStyle ? `\n${strategy.guideStyle}` : '';
  const mathTutorHint = buildMathTutorInstructions(resolved);
  return `You are an expert tutor creating a River-led AI tutor session${className ? ` for ${className}` : ''}.
${className ? `Tailor concept selection, terminology, examples, and misconceptions specifically to ${className}.` : ''}

${buildSubjectContext(className, subject)}${guideHint}${mathTutorHint}

Output ONLY a valid JSON object. No markdown, backticks, or text outside the object.
Required structure:
{
  "session_meta": {
    "subject": "subject name",
    "student_goal": "what the student must master",
    "student_level": "beginner|intermediate|advanced",
    "exam_context": {
      "label": "exam or quiz name",
      "date": "YYYY-MM-DD or empty string"
    },
    "source_mode": "setup|source|hybrid",
    "estimated_minutes": 25,
    "lecture_style": "storybook seminar",
    "preferred_tutor_tone": "calm, precise, encouraging",
    "river_role": "friendly lecture cat"
  },
  "lecture": {
    "opening": "short opening that frames the lesson like a lecture",
    "agenda": ["short agenda beat", "another agenda beat"],
    "closing": "short confidence-building closing line"
  },
  "river": {
    "name": "River",
    "species": "grey cat",
    "style": "storybook lecture mascot",
    "tone": "friendly, witty, encouraging teacher",
    "default_expression": "blink_soft",
    "default_animation": "tail_sway_idle",
    "cue_map": {
      "idle": { "expression": "blink_soft", "animation": "tail_sway_idle" },
      "focus": { "expression": "focus_lean_in", "animation": "ear_tilt_curious" },
      "recover": { "expression": "soft_concern_mistake", "animation": "paw_point_hint" },
      "mastery": { "expression": "whisker_pride", "animation": "sparkle_mastery" },
      "teach": { "expression": "focus_lean_in", "animation": "beanie_bob_teach" },
      "point": { "expression": "focus_lean_in", "animation": "paw_point_stage" },
      "encourage": { "expression": "blink_soft", "animation": "soft_nod_glow" },
      "thinking": { "expression": "ear_tilt_curious", "animation": "tail_think_loop" },
      "gentle-correct": { "expression": "soft_concern_mistake", "animation": "paw_point_hint" },
      "celebrate": { "expression": "whisker_pride", "animation": "sparkle_mastery" }
    },
    "dialogue_variants": {
      "opening": ["short opening line"],
      "encouragement": ["short encouragement line"],
      "recovery": ["short recovery line"],
      "mastery": ["short mastery line"]
    }
  },
  "knowledge_map": {
    "concepts": [
      {
        "id": "concept-slug",
        "title": "concept title",
        "summary": "1 sentence summary",
        "depends_on": ["optional-prereq-concept-id"],
        "weak_points": ["likely weak point"],
        "misconception_tags": ["misconception-id"]
      }
    ]
  },
  "cards": [
    {
      "id": "card-slug",
      "concept_id": "concept-slug",
      "phase": "diagnostic|recovery|apply|reinforce|mastery",
      "difficulty": "low|support|medium|high",
      "card_type": "short_answer",
      "prompt": "single clear prompt",
      "target_answer": "concise model answer",
      "required_idea_tags": ["core-idea-tag"],
      "optional_idea_tags": ["optional-idea-tag"],
      "misconception_tags": ["misconception-id"],
      "hints": [
        {
          "level": 1,
          "text": "guiding hint that narrows thinking without revealing immediately",
          "cue": { "expression": "ear_tilt_curious", "animation": "paw_point_hint" }
        }
      ],
      "feedback": {
        "correct": ["feedback for correct answer"],
        "partial": ["feedback for partial answer"],
        "incorrect": ["feedback for incorrect answer"],
        "empty": ["feedback for empty answer"],
        "misconception": [
          {
            "misconception_id": "misconception-id",
            "responses": ["specific correction for that misconception"]
          }
        ]
      },
      "river": {
        "intro": "line before answer",
        "success": "line after success",
        "struggle": "line when the student struggles"
      },
      "teaching": {
        "learning_objective": "specific skill the student should be able to do after this card",
        "explain": "3-5 short paragraphs that teach the concept progressively: what it is, how it works, why it behaves that way, and how to use it. Never summarize in one paragraph. For STEM topics embed fenced code/diagram/graph blocks directly inside this text where they add the most value — they will each become their own reveal beat.",
        "intuition": "A mental model or analogy that is meaningfully different from the explanation. Use imagine, think of it like, or the reason this works is.",
        "predicts": [
          { "prompt": "Optional: one predict-then-reveal prompt that surfaces a likely misconception. Omit this array (or leave it empty) when not useful.", "answer": "The answer River reveals.", "after_beat": 2 }
        ],
        "worked_examples": [
          {
            "title": "Example 1: Basic application",
            "problem": "Clear problem statement. For STEM, make this a concrete calculation or code task.",
            "steps": [
              { "step": "What to do in this step (for math/code use fenced notation inline)", "detail": "Why this step works and how to think about it — never omit this field" }
            ],
            "result": "The final answer with units or context",
            "takeaway": "The one thing this example teaches",
            "figure": { "type": "mermaid|plot|chart|code", "spec": "For STEM: a Mermaid diagram, a plot spec JSON like {\"fn\":\"x^2\",\"domain\":[-5,5]}, a chart spec JSON like {\"type\":\"bar\",\"data\":[{\"x\":1,\"y\":2}],\"xKey\":\"x\",\"series\":[\"y\"]}, or a fenced code string. Omit this field for non-visual examples." }
          }
        ],
        "common_mistakes": ["mistake 1: what students get wrong and why it is wrong", "mistake 2: another common error with correction"],
        "example": "concrete contextual example",
        "steps": ["step 1", "step 2", "step 3"],
        "why_it_matters": "why this concept matters in the bigger picture"
      },
      "assist_options": [
        {
          "id": "explain-simply",
          "label": "Explain simply",
          "text": "simpler explanation",
          "pose": "encourage"
        },
        {
          "id": "show-example",
          "label": "Show another example",
          "text": "another example",
          "pose": "point"
        },
        {
          "id": "break-it-down",
          "label": "Break it down",
          "text": "step-by-step explanation",
          "pose": "teach"
        },
        {
          "id": "why-it-matters",
          "label": "Why this matters",
          "text": "importance framing",
          "pose": "thinking"
        }
      ],
      "presentation": {
        "pose": "teach|point|encourage|thinking|gentle-correct|celebrate",
        "emphasis_target": "core phrase River should spotlight",
        "reaction_cue": { "expression": "focus_lean_in", "animation": "ear_tilt_curious" }
      },
      "transitions": {
        "on_correct": "next-card-id or null",
        "on_partial": "retry",
        "on_incorrect": "hint",
        "on_struggle": "recovery-card-id or retry"
      },
      "mastery_weight": 1
    }
  ],
  "evaluation_rules": {
    "score_bands": {
      "correct": 0.85,
      "partial": 0.4
    },
    "pass_threshold": 0.5,
    "partial_advances": true,
    "empty_patterns": ["idk", "i do not know", "blank"],
    "tag_synonyms": {
      "core-idea-tag": ["synonym phrase"]
    },
    "misconception_rules": [
      {
        "id": "misconception-id",
        "concept_id": "concept-slug",
        "trigger_phrases": ["wrong-answer phrase"],
        "correction": "brief correction"
      }
    ]
  },
  "adaptation_rules": {
    "max_attempts_before_recovery": 2,
    "max_hints_per_card": 2,
    "performance_bands": {
      "struggling": { "mastery_below": 45, "river_expression": "soft_concern_mistake", "river_animation": "paw_point_hint" },
      "steady": { "mastery_below": 80, "river_expression": "focus_lean_in", "river_animation": "ear_tilt_curious" },
      "mastery": { "mastery_below": 101, "river_expression": "whisker_pride", "river_animation": "sparkle_mastery" }
    }
  },
  "completion": {
    "title": "Session complete",
    "mastery_message": "what the student now understands",
    "confidence_close": "confidence-building close",
    "next_review_message": "when and how to review next",
    "river_cue": { "expression": "whisker_pride", "animation": "sparkle_mastery" }
  }
}
Build a tutor session in the style of The Organic Chemistry Tutor: teach thoroughly first, THEN check understanding.
Structure the experience like a deep lecture: intro -> thorough explanation -> worked examples -> common mistakes -> check understanding -> feedback -> complete.
Create a 2-4 card, one-card-at-a-time training flow. Each card must teach a distinct concept and feel like a 5-8 minute mini lecture: objective -> explanation -> mental model -> 2-3 worked examples -> common mistakes -> concise recall prompt.
The "teaching.learning_objective" field MUST be specific and action-oriented. Bad: "understand architecture". Good: "Trace how a profile update moves from UI to API to database while naming the tradeoffs."
The "teaching.explain" field MUST be 3-5 short paragraphs (≥150 words total). Build understanding layer by layer and make every paragraph add a new idea. Do not repeat the same sentence with different wording. Adapt depth to session_meta.student_level: beginners get more analogy and scaffolding; advanced students get first-principles derivation and edge cases. Use knowledge_map concept dependencies to build on what the student already knows.
The "teaching.worked_examples" array MUST contain 2-3 complete worked examples. Each example must show every step with detailed reasoning in the "detail" field (never omit "detail"). Examples must progress from straightforward to more challenging. FOR STEM SUBJECTS (math, CS, physics, chemistry, economics, biology): include a "figure" field on every worked example — use a \`\`\`mermaid diagram for CS/biology/chemistry flow, a plot spec {\"fn\":\"...\",\"domain\":[-5,5]} for math/physics function graphs, or a chart spec {\"type\":\"bar\",\"data\":[...],\"xKey\":\"...\",\"series\":[...]} for data/stats.
VALID FIGURE EXAMPLES: Mermaid: flowchart LR\\n  A[Input] --> B[Process] --> C[Output] — Plot: {\"fn\":\"Math.sin(x)\",\"domain\":[-6.28,6.28],\"title\":\"Sine wave\"} — Chart: {\"type\":\"line\",\"data\":[{\"x\":0,\"y\":0},{\"x\":1,\"y\":1},{\"x\":2,\"y\":4}],\"xKey\":\"x\",\"series\":[\"y\"],\"title\":\"x squared\"}
The "teaching.intuition" field MUST provide a mental model, analogy, or intuitive explanation that makes the concept click. It must not simply restate "components interact with each other."
The "teaching.common_mistakes" array MUST list 2-3 mistakes students commonly make, and each item must include the correction or why the mistake is wrong.
Optionally add a "predicts" array with at most ONE entry per card: a short predict-then-reveal question that surfaces the most likely misconception. Use a question the student can reflect on mentally before the reveal. Omit if no clear misconception applies.
For software architecture or system design, teach concrete choices and tradeoffs. A simple web app example should include frontend, auth, API, database, profile image storage, and update flow. An enterprise example should add services, queues, observability, permissions, failure modes, and scaling tradeoffs. Embed \`\`\`mermaid sequence or flowchart diagrams to show data flow.
Avoid generic filler such as "user interface, business logic, and data storage" unless you immediately explain the responsibility, boundary, data flow, or tradeoff.
For mathematics, do not yap around the topic. The teaching must be mostly solved steps, method choice, legal transformations, checks, and similar practice. Embed LaTeX equations using $$...$$ for block equations. Every worked example must have a plot figure showing the relevant function or relationship.
Every card must support deterministic grading through required_idea_tags, optional_idea_tags, hints, misconceptions, teaching content, presentation cues, and feedback variants.
River must stay central, warm, slightly playful, and distinct. Use the green knit beanie as a signature trait.
Partial answers should usually count as good enough progress when the learner shows real understanding; reserve hard stops for clear misconceptions.
Keep prompts concise. Keep target answers concise. Keep River premium, calm, clear, and emotionally supportive.`;
};

export const assertTutorSessionQuality = (guideData) => {
  const quality = validateTutorSessionQuality(guideData);
  if (!quality.ok) {
    throw createHttpError(
      'AI generated a tutor session that was too shallow or repetitive. Please try again with clearer source material.',
      500,
      { qualityIssues: quality.issues },
    );
  }
};

export const normalizeCoachConfig = (value, { hasSourceMaterial = false } = {}) => {
  const raw = value && typeof value === 'object' ? value : {};
  const examLabel = typeof raw.examLabel === 'string' ? raw.examLabel.trim() : '';
  const examDate = typeof raw.examDate === 'string' ? raw.examDate.trim() : '';
  const userTopics = Array.isArray(raw.userTopics)
    ? raw.userTopics.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean).slice(0, 12)
    : [];
  const weakTopics = Array.isArray(raw.weakTopics)
    ? raw.weakTopics.map((item) => (typeof item === 'string' ? item.trim() : '')).filter(Boolean).slice(0, 12)
    : [];
  const preferredTone = typeof raw.preferredTone === 'string' ? raw.preferredTone.trim() : '';
  const requestedMode = typeof raw.creationMode === 'string' ? raw.creationMode.trim() : '';

  const hasSetup = Boolean(examLabel || examDate || userTopics.length || weakTopics.length || preferredTone);
  if (!hasSetup) return null;

  const inferredCreationMode = ['setup', 'source', 'hybrid'].includes(requestedMode)
    ? requestedMode
    : hasSourceMaterial
      ? 'hybrid'
      : 'setup';

  return {
    creation_mode: inferredCreationMode,
    ...(examLabel ? { exam_label: examLabel } : {}),
    ...(examDate ? { exam_date: examDate } : {}),
    ...(userTopics.length ? { user_topics: userTopics } : {}),
    ...(weakTopics.length ? { user_weak_topics: weakTopics } : {}),
    ...(preferredTone ? { preferred_tone: preferredTone } : {}),
  };
};

const buildCoachSetupText = (coachMeta) => {
  if (!coachMeta) return '';

  const lines = ['Student Setup:'];

  if (coachMeta.exam_label) lines.push(`- Exam or goal: ${coachMeta.exam_label}`);
  if (coachMeta.exam_date) lines.push(`- Date: ${coachMeta.exam_date}`);
  if (coachMeta.user_topics?.length) lines.push(`- Topics to cover: ${coachMeta.user_topics.join(', ')}`);
  if (coachMeta.user_weak_topics?.length) lines.push(`- Weakest topics: ${coachMeta.user_weak_topics.join(', ')}`);
  if (coachMeta.preferred_tone) lines.push(`- Preferred coaching tone: ${coachMeta.preferred_tone}`);
  if (coachMeta.creation_mode) lines.push(`- Creation mode: ${coachMeta.creation_mode}`);

  return lines.join('\n');
};

export const mergeGuidePayloadMeta = (guidePayload, coachMeta) => {
  const rawPayload = guidePayload && typeof guidePayload === 'object' ? guidePayload : {};
  if (!coachMeta) return rawPayload;

  const existingSessionMeta = rawPayload.session_meta && typeof rawPayload.session_meta === 'object'
    ? rawPayload.session_meta
    : {};
  const existingExamContext = existingSessionMeta.exam_context && typeof existingSessionMeta.exam_context === 'object'
    ? existingSessionMeta.exam_context
    : {};

  return {
    ...rawPayload,
    session_meta: {
      ...existingSessionMeta,
      student_goal: existingSessionMeta.student_goal || coachMeta.exam_label || '',
      source_mode: existingSessionMeta.source_mode || coachMeta.creation_mode || '',
      preferred_tutor_tone: existingSessionMeta.preferred_tutor_tone || coachMeta.preferred_tone || '',
      focus_topics: Array.isArray(existingSessionMeta.focus_topics) && existingSessionMeta.focus_topics.length > 0
        ? existingSessionMeta.focus_topics
        : (coachMeta.user_topics || []),
      weak_topics: Array.isArray(existingSessionMeta.weak_topics) && existingSessionMeta.weak_topics.length > 0
        ? existingSessionMeta.weak_topics
        : (coachMeta.user_weak_topics || []),
      exam_context: {
        ...existingExamContext,
        label: existingExamContext.label || coachMeta.exam_label || '',
        date: existingExamContext.date || coachMeta.exam_date || '',
      },
    },
  };
};

export const buildGuideContents = ({ processedNotes, hasProcessedNotes, keepFile, file, className, subject, coachConfig, knowledgeContext = '' }) => {
  const hasSourceMaterial = hasProcessedNotes || keepFile;
  const coachMeta = normalizeCoachConfig(coachConfig, { hasSourceMaterial });
  const setupText = buildCoachSetupText(coachMeta);
  const contents = [{
    text: `${buildGuidePrompt(className, subject)}

If Student Setup is provided, preserve it in "session_meta" and let it shape prioritization, weak-point selection, tone, and pacing.
If no source material is provided, create a first-pass River tutor session from Student Setup alone.`,
  }];

  if (knowledgeContext) {
    contents.push({ text: `\n\n${knowledgeContext}` });
  }

  if (setupText) {
    contents.push({ text: `\n\n${setupText}` });
  }

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
  subject,
  coachConfig,
  knowledgeContext,
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
  const hasSourceMaterial = hasProcessedNotes || keepFile;
  const coachMeta = normalizeCoachConfig(coachConfig, { hasSourceMaterial });

  if (!hasSourceMaterial && !coachMeta) {
    throw createHttpError('Notes, a file, or setup details are required to generate a tutor session.', 400);
  }

  const characterLimit = aiLimitsContext?.characterLimit || 15000;
  if (hasProcessedNotes && processedNotes.length > characterLimit) {
    throw createHttpError(
      `Notes are too long. Please limit to ~${Math.round(characterLimit / 5)} words.`,
      400,
    );
  }

  const rawResponse = await generateContent({
    model: aiModelMap.guide,
    contents: buildGuideContents({
      processedNotes,
      hasProcessedNotes,
      keepFile,
      file,
      className,
      subject,
      coachConfig,
      knowledgeContext,
    }),
  });

  const guidePayload = mergeGuidePayloadMeta(
    parseAiJsonResponse(
    rawResponse,
    'AI generated invalid tutor session format. Please try again.',
    ),
    coachMeta,
  );

  const guideData = normalizeStudyGuideData(guidePayload);
  if (!guideData) {
    throw createHttpError('AI failed to generate a valid tutor session.', 500);
  }
  assertTutorSessionQuality(guideData);

  const guideContent = buildStudyGuideSummaryDoc(guideData);
  const studyState = createDefaultStudyGuideState(guideData);

  const finalTitle = title || 'AI Tutor Session';
  let createdGuide = null;

  try {
    createdGuide = await createGuide({
      userId,
      title: finalTitle,
      formatVersion: STUDY_GUIDE_FORMAT_VERSION,
      guideData,
      studyState,
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
    message: 'Tutor session generated successfully',
    guide_id: createdGuide.id,
    title: finalTitle,
  };
};

// ─────────────────────────────────────────────────────
// Mock Exam generation
// ─────────────────────────────────────────────────────

const buildExamPrompt = (className, subject) => {
  const resolved = resolveSubject(className, subject);
  const strategy = getSubjectStrategy(resolved);
  const examHint = strategy.examTypes ? `\n${strategy.examTypes}` : '';
  return `You are an expert tutor creating a practice exam that mirrors real university exams.
Produce a mix of MCQ and short-answer questions from the provided material.

${buildSubjectContext(className, subject)}

Output ONLY a valid JSON array. No markdown, backticks, or text outside the array.
Generate 12-18 MCQ + 2-4 short_answer questions. Mix: 30% easy, 50% medium, 20% hard.

Every question MUST have: "type" ("mcq"/"short_answer"), "question", "topic" (specific concept), "difficulty" ("easy"/"medium"/"hard"), "correct_answer", "explanation".
MCQ also needs: "options" (exactly 4 strings, one matching correct_answer). Distractors plausible but clearly wrong.
short_answer also needs: "grading_rubric" (key points list), "correct_answer" (2-4 sentence model answer).
Vary types: recall, compare, apply, analyze. Cover wide range of topics.${examHint}`;
};

const buildAdaptiveExamPrompt = (className, masteryData, subject) => {
  const basePrompt = buildExamPrompt(className, subject);

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

const buildFocusedExamPrompt = (className, weakTopics, subject) => {
  const basePrompt = buildExamPrompt(className, subject);

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

export const buildExamContents = ({ processedNotes, hasProcessedNotes, keepFile, file, className, subject, masteryData, weakTopics, examMode, knowledgeContext = '' }) => {
  let prompt;
  if (examMode === 'focused' && weakTopics) {
    prompt = buildFocusedExamPrompt(className, weakTopics, subject);
  } else if (examMode === 'adaptive' && masteryData) {
    prompt = buildAdaptiveExamPrompt(className, masteryData, subject);
  } else {
    prompt = buildExamPrompt(className, subject);
  }

  const contents = [{ text: prompt }];

  if (knowledgeContext) {
    contents.push({ text: `\n\n${knowledgeContext}` });
  }

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
  subject,
  knowledgeContext,
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
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    contents: buildExamContents({ processedNotes, hasProcessedNotes, keepFile, file, className, subject, knowledgeContext }),
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
  text: `Video Source Material:\n${transcript}`,
});

const NOTE_TIPTAP_FORMAT = `Output ONLY valid JSON: { "type": "doc", "content": [...] }. No markdown/backticks outside JSON.
Node types: heading (attrs.level 1-3), paragraph, bulletList→listItem→paragraph, orderedList→listItem→paragraph, blockquote→paragraph, horizontalRule.
Table: { "type": "table", "content": [ tableRow ] } where each tableRow contains tableHeader (header row) or tableCell nodes each wrapping a paragraph. Use tables ONLY for genuine comparisons. Do not replace bullet lists with tables.
Text marks: { "type": "text", "marks": [{ "type": "bold" }], "text": "..." } (also: italic, code).`;

export const buildYoutubeDeckContents = (youtubeUrl, className, subject) => [
  { text: buildDeckPrompt(className, subject) },
  buildYoutubeVideoSource(youtubeUrl),
];

export const buildYoutubeGuideContents = (youtubeUrl, className, subject) => [
  { text: buildGuidePrompt(className, subject) },
  buildYoutubeVideoSource(youtubeUrl),
];

export const buildYoutubeExamContents = (youtubeUrl, className, subject) => [
  { text: buildExamPrompt(className, subject) },
  buildYoutubeVideoSource(youtubeUrl),
];

const buildNotesFromVideoPrompt = (className, subject, sourceText) => {
  const noteStrategy = resolveNoteStrategy({ className, subject, sourceText });

  return `You are an expert note-taker watching an educational YouTube video.
Produce natural, study-ready notes as a Tiptap JSON document.

${buildSubjectContext(className, subject)}

${buildNaturalNoteStyleInstructions({
  includeKeyConcepts: true,
  preserveStudentPhrasing: false,
  allowReviewSummary: noteStrategy.allowsSummary,
})}

${noteStrategy.promptInstructions}
- Be detailed enough that the saved notes can support later flashcards, guides, or exams.

${NOTE_TIPTAP_FORMAT}`;
};

export const buildYoutubeNotesContents = (youtubeUrl, className, subject) => [
  { text: buildNotesFromVideoPrompt(className, subject, youtubeUrl) },
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
    model: 'meta-llama/llama-4-scout-17b-16e-instruct',
    contents: buildClassContents({ processedNotes, hasProcessedNotes, keepFile, file }),
  });

  return {
    classData: parseAiJsonResponse(
      rawResponse,
      'AI generated invalid class format. Please try again.',
    ),
  };
};
