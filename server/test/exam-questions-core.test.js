import { describe, expect, it } from 'vitest';

import {
  EXAM_QUESTION_TYPES,
  shuffleArray,
  validateExamQuestion,
  coerceExamQuestion,
  shuffleQuestionOptions,
  normalizeExamQuestions,
} from '../../supabase/functions/_shared/examQuestions.mjs';

const mcq = (overrides = {}) => ({
  type: 'mcq',
  question: 'What is 2 + 2?',
  options: ['4', '3', '5', '22'],
  correct_answer: '4',
  topic: 'Arithmetic',
  difficulty: 'easy',
  explanation: '2 + 2 = 4.',
  ...overrides,
});

describe('shuffleArray', () => {
  it('returns a permutation without mutating the input', () => {
    const input = [1, 2, 3, 4, 5];
    const out = shuffleArray(input);
    expect(out).toHaveLength(5);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5]);
    expect(input).toEqual([1, 2, 3, 4, 5]); // unmutated
  });

  it('honors an injected rng deterministically', () => {
    const seq = [0.99, 0.01, 0.5, 0.0];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const a = shuffleArray(['a', 'b', 'c', 'd'], rng);
    i = 0;
    const b = shuffleArray(['a', 'b', 'c', 'd'], rng);
    expect(a).toEqual(b);
  });
});

describe('validateExamQuestion', () => {
  it('accepts a well-formed mcq', () => {
    expect(validateExamQuestion(mcq())).toBe(true);
  });

  it('rejects an mcq whose correct answer is not among the options', () => {
    expect(validateExamQuestion(mcq({ correct_answer: '7' }))).toBe(false);
  });

  it('rejects an mcq with a duplicated correct answer', () => {
    expect(validateExamQuestion(mcq({ options: ['4', '4', '5', '3'] }))).toBe(false);
  });

  it('validates true_false / numeric / multi_select / short_answer', () => {
    expect(validateExamQuestion(coerceExamQuestion({ type: 'true_false', question: 'q', correct_answer: true }))).toBe(true);
    expect(validateExamQuestion(coerceExamQuestion({ type: 'numeric', question: 'q', correct_answer: '3.14' }))).toBe(true);
    expect(validateExamQuestion(coerceExamQuestion({ type: 'numeric', question: 'q', correct_answer: 'not-a-number' }))).toBe(false);
    expect(validateExamQuestion(coerceExamQuestion({
      type: 'multi_select', question: 'q', options: ['a', 'b', 'c'], correct_answers: ['a', 'c'],
    }))).toBe(true);
    expect(validateExamQuestion(coerceExamQuestion({
      type: 'multi_select', question: 'q', options: ['a', 'b', 'c'], correct_answers: ['z'],
    }))).toBe(false);
    expect(validateExamQuestion(coerceExamQuestion({ type: 'short_answer', question: 'q', correct_answer: 'ans' }))).toBe(false); // no rubric
    expect(validateExamQuestion(coerceExamQuestion({ type: 'short_answer', question: 'q', correct_answer: 'ans', grading_rubric: ['k'] }))).toBe(true);
  });
});

describe('coerceExamQuestion', () => {
  it('normalizes type aliases and defaults marks to 1', () => {
    expect(coerceExamQuestion({ type: 'TrueFalse', question: 'q', correct_answer: false }).type).toBe('true_false');
    expect(coerceExamQuestion({ type: 'select_all', question: 'q' }).type).toBe('multi_select');
    expect(coerceExamQuestion({ question: 'q' }).type).toBe('mcq');
    expect(coerceExamQuestion({ type: 'mcq', question: 'q' }).marks).toBe(1);
    expect(coerceExamQuestion({ type: 'mcq', question: 'q', marks: 5 }).marks).toBe(5);
  });

  it('stringifies boolean true_false answers', () => {
    expect(coerceExamQuestion({ type: 'true_false', question: 'q', correct_answer: true }).correct_answer).toBe('true');
    expect(coerceExamQuestion({ type: 'true_false', question: 'q', correct_answer: false }).correct_answer).toBe('false');
  });
});

describe('normalizeExamQuestions', () => {
  it('drops invalid questions and keeps valid ones', () => {
    const out = normalizeExamQuestions([
      mcq(),
      mcq({ correct_answer: 'not-an-option' }),
      { type: 'short_answer', question: 'Explain X', correct_answer: 'model', grading_rubric: ['a'] },
      { type: 'numeric', question: 'value?', correct_answer: 'nope' },
    ]);
    expect(out).toHaveLength(2);
    expect(out.map((q) => q.type).sort()).toEqual(['mcq', 'short_answer']);
  });

  it('preserves the correct answer text after shuffling (grading stays intact)', () => {
    const [q] = normalizeExamQuestions([mcq()]);
    expect(q.options).toContain('4');
    expect(q.correct_answer).toBe('4');
  });

  // The core regression: the correct answer must NOT stay parked in a fixed slot.
  it('spreads the correct answer across all option positions', () => {
    const counts = [0, 0, 0, 0];
    const TRIALS = 600;
    for (let i = 0; i < TRIALS; i += 1) {
      // Correct answer is ALWAYS first in the source (the model's positional bias).
      const [q] = normalizeExamQuestions([mcq({ options: ['4', '3', '5', '22'], correct_answer: '4' })]);
      counts[q.options.indexOf('4')] += 1;
    }
    // Every slot is exercised, and no slot dominates the way the old bug did.
    counts.forEach((c) => expect(c).toBeGreaterThan(0));
    counts.forEach((c) => expect(c / TRIALS).toBeLessThan(0.5));
  });
});

describe('EXAM_QUESTION_TYPES', () => {
  it('exposes the supported set', () => {
    expect(EXAM_QUESTION_TYPES).toContain('mcq');
    expect(EXAM_QUESTION_TYPES).toContain('numeric');
    expect(EXAM_QUESTION_TYPES).toHaveLength(5);
  });
});

describe('shuffleQuestionOptions', () => {
  it('leaves option-less types untouched', () => {
    const tf = coerceExamQuestion({ type: 'true_false', question: 'q', correct_answer: true });
    expect(shuffleQuestionOptions(tf)).toEqual(tf);
  });
});
