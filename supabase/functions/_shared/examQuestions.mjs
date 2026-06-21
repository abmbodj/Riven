// Shared, runtime-agnostic exam-question helpers.
//
// Used from BOTH runtimes: Node (unit tests in server/test/exam-questions-core.test.js)
// and Deno (the generate-exam edge function at runtime). Keep this file free of
// Node-only or Deno-only APIs.
//
// Why this exists: AI-generated MCQs were stored in the model's emit order and never
// shuffled, so the model's positional bias parked the correct answer in the same slot
// ("answer B is always right"). `normalizeExamQuestions` validates + repairs + shuffles
// every generated question before it is persisted. The correct answer is always stored
// as TEXT (`correct_answer` / `correct_answers`), so shuffling option order can never
// break grading — graders compare answer text, not index.

export const EXAM_QUESTION_TYPES = Object.freeze([
  'mcq',
  'multi_select',
  'true_false',
  'numeric',
  'short_answer',
]);

/** Types whose `options` array should be shuffled to defeat positional bias. */
const SHUFFLE_OPTION_TYPES = new Set(['mcq', 'multi_select']);

/**
 * Fisher-Yates shuffle. Returns a NEW array (does not mutate input).
 * `rng` is injectable so tests can assert a deterministic, unbiased shuffle.
 */
export const shuffleArray = (input, rng = Math.random) => {
  const arr = Array.isArray(input) ? [...input] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const isFiniteNumber = (value) => {
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'string' && value.trim() !== '') return Number.isFinite(Number(value));
  return false;
};

/** Normalize a raw `type` string to one of EXAM_QUESTION_TYPES, defaulting to 'mcq'. */
const coerceType = (rawType) => {
  if (typeof rawType !== 'string') return 'mcq';
  const t = rawType.trim().toLowerCase();
  if (t === 'true_false' || t === 'truefalse' || t === 'tf' || t === 'boolean') return 'true_false';
  if (t === 'multi_select' || t === 'multiselect' || t === 'multi' || t === 'select_all' || t === 'msq') return 'multi_select';
  if (t === 'numeric' || t === 'number' || t === 'calculation') return 'numeric';
  if (t === 'short_answer' || t === 'shortanswer' || t === 'short' || t === 'free_response' || t === 'essay') return 'short_answer';
  return 'mcq';
};

const coerceMarks = (rawMarks) => {
  const n = Number(rawMarks);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/**
 * Validate a single (already type-coerced) question's structural integrity.
 * Returns true when the question is gradable and renderable.
 */
export const validateExamQuestion = (q) => {
  if (!q || typeof q !== 'object') return false;
  if (!q.question || typeof q.question !== 'string') return false;

  switch (q.type) {
    case 'short_answer':
      // AI-graded: needs a model answer + a rubric of key points.
      return Boolean(q.correct_answer) && Boolean(q.grading_rubric);

    case 'true_false':
      return q.correct_answer === 'true' || q.correct_answer === 'false';

    case 'numeric':
      return isFiniteNumber(q.correct_answer);

    case 'multi_select':
      return (
        Array.isArray(q.options)
        && q.options.length >= 3
        && Array.isArray(q.correct_answers)
        && q.correct_answers.length >= 1
        && q.correct_answers.every((a) => q.options.includes(a))
      );

    case 'mcq':
    default:
      return (
        Array.isArray(q.options)
        && q.options.length === 4
        && typeof q.correct_answer === 'string'
        && q.options.includes(q.correct_answer)
        // Exactly one option matches — guards malformed duplicate-answer questions.
        && q.options.filter((o) => o === q.correct_answer).length === 1
      );
  }
};

/**
 * Coerce a raw AI question into our canonical shape: normalized `type`, numeric `marks`,
 * stringified boolean answers, deduped options. Does not shuffle. Returns a NEW object.
 */
export const coerceExamQuestion = (raw) => {
  if (!raw || typeof raw !== 'object') return raw;
  const type = coerceType(raw.type);
  const q = { ...raw, type, marks: coerceMarks(raw.marks) };

  if (type === 'true_false') {
    // Accept booleans or strings like "True"/"FALSE".
    const v = typeof q.correct_answer === 'boolean'
      ? q.correct_answer
      : String(q.correct_answer ?? '').trim().toLowerCase();
    q.correct_answer = (v === true || v === 'true' || v === 't') ? 'true'
      : (v === false || v === 'false' || v === 'f') ? 'false'
        : String(q.correct_answer ?? '');
    delete q.options; // rendered as fixed True/False buttons
  } else if (type === 'numeric') {
    if (q.correct_answer != null) q.correct_answer = String(q.correct_answer).trim();
    q.tolerance = isFiniteNumber(q.tolerance) ? Number(q.tolerance) : 0;
    if (typeof q.unit !== 'string') delete q.unit;
    delete q.options;
  } else if (type === 'multi_select') {
    if (Array.isArray(q.options)) q.options = [...new Set(q.options.map((o) => String(o)))];
    if (Array.isArray(q.correct_answers)) q.correct_answers = q.correct_answers.map((a) => String(a));
  } else if (type === 'mcq') {
    if (Array.isArray(q.options)) q.options = q.options.map((o) => String(o));
    if (q.correct_answer != null) q.correct_answer = String(q.correct_answer);
  }

  return q;
};

/** Shuffle a question's options (mcq/multi_select only). Returns a NEW object. */
export const shuffleQuestionOptions = (q, rng = Math.random) => {
  if (q && SHUFFLE_OPTION_TYPES.has(q.type) && Array.isArray(q.options) && q.options.length > 1) {
    return { ...q, options: shuffleArray(q.options, rng) };
  }
  return q;
};

/**
 * The single entry point used by both generation paths: coerce → validate → shuffle.
 * Drops questions that fail validation. Returns the cleaned, shuffled array.
 */
export const normalizeExamQuestions = (rawQuestions, rng = Math.random) => {
  if (!Array.isArray(rawQuestions)) return [];
  return rawQuestions
    .map((raw) => coerceExamQuestion(raw))
    .filter((q) => validateExamQuestion(q))
    .map((q) => shuffleQuestionOptions(q, rng));
};
