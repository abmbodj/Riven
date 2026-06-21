import { describe, expect, it } from 'vitest';

import {
  isObjectiveType,
  getQuestionMarks,
  gradeObjective,
  multiSelectPartial,
} from './examGrading';

describe('isObjectiveType', () => {
  it('recognizes auto-gradable types and excludes short_answer', () => {
    ['mcq', 'true_false', 'numeric', 'multi_select'].forEach((t) => expect(isObjectiveType(t)).toBe(true));
    expect(isObjectiveType('short_answer')).toBe(false);
  });
});

describe('getQuestionMarks', () => {
  it('defaults to 1 and honors positive integers', () => {
    expect(getQuestionMarks({})).toBe(1);
    expect(getQuestionMarks({ marks: 0 })).toBe(1);
    expect(getQuestionMarks({ marks: 4 })).toBe(4);
    expect(getQuestionMarks({ marks: 'x' })).toBe(1);
  });
});

describe('gradeObjective', () => {
  it('grades mcq and true_false by exact match with marks', () => {
    expect(gradeObjective({ type: 'mcq', correct_answer: '4', marks: 2 }, '4')).toEqual({ isCorrect: true, credit: 1, earnedMarks: 2 });
    expect(gradeObjective({ type: 'mcq', correct_answer: '4' }, '5')).toEqual({ isCorrect: false, credit: 0, earnedMarks: 0 });
    expect(gradeObjective({ type: 'true_false', correct_answer: 'true' }, 'true').isCorrect).toBe(true);
    expect(gradeObjective({ type: 'true_false', correct_answer: 'false' }, 'true').isCorrect).toBe(false);
  });

  it('grades numeric within tolerance and tolerates formatting', () => {
    expect(gradeObjective({ type: 'numeric', correct_answer: '3.14' }, '3.14').isCorrect).toBe(true);
    expect(gradeObjective({ type: 'numeric', correct_answer: '100', tolerance: 2 }, '101').isCorrect).toBe(true);
    expect(gradeObjective({ type: 'numeric', correct_answer: '100', tolerance: 2 }, '103').isCorrect).toBe(false);
    expect(gradeObjective({ type: 'numeric', correct_answer: '1000' }, '1,000').isCorrect).toBe(true);
    expect(gradeObjective({ type: 'numeric', correct_answer: '5' }, 'abc').isCorrect).toBe(false);
  });

  it('grades multi_select as all-or-nothing set equality', () => {
    const q = { type: 'multi_select', correct_answers: ['a', 'c'], marks: 3 };
    expect(gradeObjective(q, ['a', 'c'])).toEqual({ isCorrect: true, credit: 1, earnedMarks: 3 });
    expect(gradeObjective(q, ['c', 'a']).isCorrect).toBe(true); // order-insensitive
    expect(gradeObjective(q, ['a']).isCorrect).toBe(false); // incomplete
    expect(gradeObjective(q, ['a', 'c', 'b']).isCorrect).toBe(false); // extra pick
  });
});

describe('multiSelectPartial', () => {
  it('rewards hits and penalizes wrong picks', () => {
    const q = { type: 'multi_select', correct_answers: ['a', 'b'] };
    expect(multiSelectPartial(q, ['a', 'b'])).toBe(1);
    expect(multiSelectPartial(q, ['a'])).toBe(0.5);
    expect(multiSelectPartial(q, ['a', 'x'])).toBe(0); // one hit, one wrong → 0
  });
});
