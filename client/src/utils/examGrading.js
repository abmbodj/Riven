// Pure, client-side grading for the auto-gradable question types
// (mcq, true_false, numeric, multi_select). `short_answer` is graded by the AI via
// `api.gradeShortAnswer`. Keeping this pure makes it reusable by BOTH the Practice and
// Exam-simulation runners and trivially unit-testable.
//
// Every question stores its correct answer as TEXT (`correct_answer` / `correct_answers`),
// so grading compares values, never option positions — option order is free to shuffle.

export const OBJECTIVE_TYPES = new Set(['mcq', 'true_false', 'numeric', 'multi_select']);

export const isObjectiveType = (type) => OBJECTIVE_TYPES.has(type);

/** A question's mark weight (defaults to 1 so legacy/unweighted exams are unaffected). */
export const getQuestionMarks = (q) => {
  const n = Number(q?.marks);
  return Number.isFinite(n) && n > 0 ? n : 1;
};

/** Parse a numeric answer tolerantly: strip commas, spaces, and a simple surrounding $…$. */
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

const FAIL = { isCorrect: false, credit: 0, earnedMarks: 0 };

/**
 * Grade an objective question against the user's answer.
 * @returns {{ isCorrect: boolean, credit: number, earnedMarks: number }}
 * - mcq / true_false: exact text match.
 * - numeric: |answer - correct| <= tolerance (default 0, with a tiny float epsilon).
 * - multi_select: all-or-nothing set equality (partial surfaced in review only).
 */
export const gradeObjective = (question, answer) => {
  if (!question) return FAIL;
  const marks = getQuestionMarks(question);
  const pass = { isCorrect: true, credit: 1, earnedMarks: marks };

  switch (question.type) {
    case 'mcq':
    case 'true_false':
      return String(answer) === String(question.correct_answer) ? pass : FAIL;

    case 'numeric': {
      const got = toNumber(answer);
      const want = toNumber(question.correct_answer);
      if (!Number.isFinite(got) || !Number.isFinite(want)) return FAIL;
      const tol = Number.isFinite(Number(question.tolerance)) ? Math.abs(Number(question.tolerance)) : 0;
      return Math.abs(got - want) <= tol + 1e-9 ? pass : FAIL;
    }

    case 'multi_select':
      return sameSet(answer, question.correct_answers) ? pass : FAIL;

    default:
      return FAIL;
  }
};

/**
 * Fraction (0..1) of a multi-select answered correctly, penalizing wrong picks.
 * For review/feedback display only — scoring stays all-or-nothing via gradeObjective.
 */
export const multiSelectPartial = (question, answer) => {
  if (question?.type !== 'multi_select' || !Array.isArray(answer)) return 0;
  const correct = new Set((question.correct_answers || []).map(String));
  if (correct.size === 0) return 0;
  const picked = answer.map(String);
  const hits = picked.filter((x) => correct.has(x)).length;
  const wrong = picked.filter((x) => !correct.has(x)).length;
  return Math.max(0, (hits - wrong) / correct.size);
};
