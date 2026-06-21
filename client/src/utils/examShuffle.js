// Defensive client-side option shuffle for the exam taker.
//
// Generation now shuffles MCQ/multi-select options server-side (fixing the
// "answer B is always right" positional bias). But exams generated BEFORE that fix are
// already stored with the correct answer parked in a fixed slot. Shuffling once at load
// time repairs those legacy exams for the current attempt. The correct answer is always
// stored as TEXT, so reordering options can never affect grading.

const SHUFFLE_TYPES = new Set(['mcq', 'multi_select']);

/** Fisher-Yates. Returns a new array; does not mutate the input. */
export const shuffleArray = (input) => {
  const arr = Array.isArray(input) ? [...input] : [];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

/**
 * Return a copy of the questions with each MCQ / multi-select question's options
 * shuffled. Options-less types (true_false, numeric, short_answer) pass through.
 */
export const shuffleExamQuestions = (questions) => {
  if (!Array.isArray(questions)) return [];
  return questions.map((q) => (
    q && SHUFFLE_TYPES.has(q.type ?? 'mcq') && Array.isArray(q.options) && q.options.length > 1
      ? { ...q, options: shuffleArray(q.options) }
      : q
  ));
};
