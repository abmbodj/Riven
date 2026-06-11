/**
 * Graduated scoring bands for a single graded answer (0-100 from the LLM grader).
 *
 * Replaces the old binary "score >= 70 = correct, else wrong" cutoff so a half-right
 * answer earns partial credit and reads as "partial" (amber) rather than a hard fail.
 *
 * credit is the fraction of the point this answer earns toward the exam total:
 *   correct  (>=70) -> 1
 *   partial  (40-69) -> proportional (score/100, so 60 -> 0.6)
 *   incorrect (<40) -> 0
 */
export const SCORE_BAND_THRESHOLDS = { correct: 70, partial: 40 };

export const scoreBand = (rawScore) => {
  const score = Math.max(0, Math.min(100, Number(rawScore) || 0));

  if (score >= SCORE_BAND_THRESHOLDS.correct) {
    return {
      band: 'correct',
      credit: 1,
      label: 'Correct',
      text: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/30',
    };
  }
  if (score >= SCORE_BAND_THRESHOLDS.partial) {
    return {
      band: 'partial',
      credit: Math.round((score / 100) * 100) / 100,
      label: 'Partial credit',
      text: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/30',
    };
  }
  return {
    band: 'incorrect',
    credit: 0,
    label: 'Incorrect',
    text: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  };
};
