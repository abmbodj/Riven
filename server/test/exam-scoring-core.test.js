import { describe, expect, it } from 'vitest';
import { isObjectiveAnswerCorrect, recoverResponse, scoreAttempt } from '../../supabase/functions/_shared/examScoringCore.mjs';
import { gradeObjective } from '../../client/src/utils/examGrading.js';

const questions = [
  { type: 'mcq', options: ['A', 'B', 'C', 'D'], correct_answer: 'B' },
  { type: 'true_false', correct_answer: 'true' },
  { type: 'numeric', correct_answer: '30', tolerance: 2, unit: 'ATP' },
  { type: 'multi_select', options: ['NADH', 'FADH2', 'Glucose', 'CO2'], correct_answers: ['NADH', 'FADH2', 'CO2'] },
  { type: 'short_answer', correct_answer: 'Protons flow through ATP synthase.' },
];

describe('exam scoring core', () => {
  it('matches the client gradeObjective verdict for every objective case', () => {
    const cases = [
      [questions[0], 'B'], [questions[0], 'A'], [questions[0], null],
      [questions[1], 'true'], [questions[1], 'false'],
      [questions[2], '31'], [questions[2], '33'], [questions[2], '1,000'], [questions[2], 'abc'], [questions[2], 30],
      [questions[3], ['CO2', 'NADH', 'FADH2']], [questions[3], ['NADH', 'FADH2']], [questions[3], 'NADH'],
      [{ type: 'mystery', correct_answer: 'x' }, 'x'],
    ];
    for (const [q, a] of cases) {
      expect(isObjectiveAnswerCorrect(q, a), JSON.stringify([q.type, a])).toBe(gradeObjective(q, a).isCorrect);
    }
  });

  it('prefers the raw response and reverses the display string for older clients', () => {
    expect(recoverResponse(questions[3], { response: ['NADH'], selected: 'ignored' })).toEqual(['NADH']);
    expect(recoverResponse(questions[3], { selected: 'NADH; FADH2; CO2' })).toEqual(['NADH', 'FADH2', 'CO2']);
    expect(recoverResponse(questions[2], { selected: '31 ATP' })).toBe('31');
    expect(recoverResponse(questions[1], { selected: 'True' })).toBe('true');
    expect(recoverResponse(questions[0], { selected: '' })).toBe(null);
  });

  it('counts correct questions out of all questions, ignoring client-claimed objective results', () => {
    const answers = [
      { response: 'B', isCorrect: true },
      { response: 'false', isCorrect: true }, // client lies: wrong answer marked correct
      { selected: '29 ATP', isCorrect: false }, // legacy entry, actually within tolerance
      { response: ['NADH'], isCorrect: true }, // client lies
      { selected: 'Protons...', isCorrect: true }, // short answer: AI verdict accepted
    ];
    expect(scoreAttempt(questions, answers)).toEqual({ score: 3, total: 5 });
  });

  it('gives nothing for missing answers or a missing exam', () => {
    expect(scoreAttempt(questions, [])).toEqual({ score: 0, total: 5 });
    expect(scoreAttempt([], [{ response: 'B', isCorrect: true }])).toEqual({ score: 0, total: 0 });
    expect(scoreAttempt(null, null)).toEqual({ score: 0, total: 0 });
  });
});
