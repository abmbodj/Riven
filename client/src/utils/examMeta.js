// Lightweight exam metadata helpers shared by the mode picker and the runners.

const PER_TYPE_MINUTES = {
  mcq: 1,
  true_false: 0.75,
  multi_select: 1.5,
  numeric: 2,
  short_answer: 4,
};

const TYPE_LABELS = {
  mcq: 'MCQ',
  true_false: 'T/F',
  multi_select: 'Select-all',
  numeric: 'Numeric',
  short_answer: 'Short answer',
};

/** Suggested exam-simulation duration (minutes), floored at 5. Blueprint duration overrides this later. */
export const estimateExamMinutes = (questions = []) =>
  Math.max(5, Math.round(questions.reduce((sum, q) => sum + (PER_TYPE_MINUTES[q?.type] ?? 1), 0)));

/** Ordered [{ type, label, count }] for the types actually present, most common first. */
export const countByType = (questions = []) => {
  const counts = {};
  questions.forEach((q) => {
    const t = q?.type || 'mcq';
    counts[t] = (counts[t] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, label: TYPE_LABELS[type] || type, count }));
};
