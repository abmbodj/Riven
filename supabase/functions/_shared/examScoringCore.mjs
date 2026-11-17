// Server-side exam scoring for XP (runtime-agnostic: Deno at runtime, Node in tests).
//
// The client stores each attempt's answers; the score it sends is display-only. This
// re-grades objective questions against the exam the user actually owns, using the same
// rules as client/src/utils/examGrading.js (parity is tested in
// server/test/exam-scoring-core.test.js). Short-answer verdicts come from the AI grader
// on the client and cannot be re-derived here, so they are accepted as stored: that is
// bounded by the exam's own question count, unlike a client-supplied score/total.

const OBJECTIVE_TYPES = new Set(['mcq', 'true_false', 'numeric', 'multi_select']);

const toNumber = (v) => {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const cleaned = v.replace(/,/g, '').replace(/\s+/g, '').replace(/^\$/, '').replace(/\$$/, '');
  return Number(cleaned);
};

const sameSet = (a, b) => {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  const sa = new Set(a.map(String));
  return b.every((x) => sa.has(String(x)));
};

/** Same verdicts as client gradeObjective(): exact text, numeric tolerance, all-or-nothing sets. */
export const isObjectiveAnswerCorrect = (question, answer) => {
  if (!question) return false;
  switch (question.type) {
    case 'mcq':
    case 'true_false':
      return String(answer) === String(question.correct_answer);
    case 'numeric': {
      const got = toNumber(answer);
      const want = toNumber(question.correct_answer);
      if (!Number.isFinite(got) || !Number.isFinite(want)) return false;
      const tol = Number.isFinite(Number(question.tolerance)) ? Math.abs(Number(question.tolerance)) : 0;
      return Math.abs(got - want) <= tol + 1e-9;
    }
    case 'multi_select':
      return sameSet(answer, question.correct_answers);
    default:
      return false;
  }
};

/**
 * Recover the raw answer from a stored attempt entry. New clients store it as `response`;
 * older ones (e.g. shipped iOS builds) only stored the display string `selected`
 * (client getAnswerDisplay), which is reversed here.
 */
export const recoverResponse = (question, entry) => {
  if (entry && Object.prototype.hasOwnProperty.call(entry, 'response')) return entry.response;
  const shown = entry?.selected;
  if (shown == null || shown === '') return null;
  switch (question?.type) {
    case 'multi_select':
      return String(shown).split('; ');
    case 'numeric':
      return question.unit && String(shown).endsWith(` ${question.unit}`)
        ? String(shown).slice(0, -(` ${question.unit}`).length)
        : String(shown);
    case 'true_false':
      return shown === 'True' ? 'true' : shown === 'False' ? 'false' : String(shown);
    default:
      return String(shown);
  }
};

/**
 * Score an attempt the way the client counts it (questions correct out of all questions).
 * @param {Array<Record<string, any>>} questions the stored exam's questions
 * @param {Array<Record<string, any>>} answers  the attempt's answers, same order
 * @returns {{ score: number, total: number }}
 */
export const scoreAttempt = (questions, answers) => {
  const qs = Array.isArray(questions) ? questions : [];
  const as = Array.isArray(answers) ? answers : [];
  let score = 0;
  qs.forEach((question, i) => {
    const entry = as[i];
    if (OBJECTIVE_TYPES.has(question?.type)) {
      if (isObjectiveAnswerCorrect(question, recoverResponse(question, entry))) score += 1;
    } else if (question?.type === 'short_answer') {
      if (entry?.isCorrect === true) score += 1;
    }
  });
  return { score, total: qs.length };
};
