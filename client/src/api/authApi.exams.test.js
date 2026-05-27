/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';
import {
  buildAggregatePaceTemperament,
  buildStrengthInsights,
  computeRushIndex,
  MIN_HUB_INSIGHT_ATTEMPTS,
} from '../lib/examInsightSignals.js';

const padAttemptsToHubMinimum = (attempts) => {
  if (attempts.length >= MIN_HUB_INSIGHT_ATTEMPTS) return attempts;
  const padded = [...attempts];
  while (padded.length < MIN_HUB_INSIGHT_ATTEMPTS) {
    const template = padded[padded.length - 1];
    padded.push(
      buildAttempt({
        id: `pad-${padded.length}`,
        examId: template.exam_id || template.mock_exams?.id || `exam-pad-${padded.length}`,
        score: template.score,
        total: template.total,
        completedAt: `2026-03-${18 + padded.length}T16:00:00.000Z`,
        durationSeconds: template.duration_seconds,
        classId: template.mock_exams?.class_id,
        title: template.mock_exams?.title,
        examMode: template.mock_exams?.exam_mode,
        answers: template.answers,
      }),
    );
  }
  return padded;
};

const buildAttempt = ({
  id,
  examId,
  score,
  total,
  completedAt,
  durationSeconds = null,
  classId = 'class-bio',
  title = 'Biology Mock',
  examMode = 'standard',
  answers = null,
  liveExam = true,
}) => ({
  id,
  exam_id: examId,
  exam_source_id: examId,
  score,
  total,
  duration_seconds: durationSeconds,
  completed_at: completedAt,
  answers,
  exam_title: title,
  class_id: classId,
  exam_mode: examMode,
  mock_exams: liveExam ? {
    id: examId,
    class_id: classId,
    title,
    exam_mode: examMode,
  } : null,
});

/** Build per-question answers for pace temperament tests */
const makeTimedAnswers = ({
  total,
  correctCount,
  perQuestionSeconds = 50,
  hardCount = 4,
  hardCorrectCount = null,
  rushIncorrect = false,
}) => {
  const resolvedHardCorrect = hardCorrectCount ?? Math.min(hardCount, correctCount);
  const answers = [];
  let correctRemaining = correctCount;
  let hardCorrectRemaining = resolvedHardCorrect;

  for (let index = 0; index < total; index += 1) {
    const isHard = index < hardCount;
    const isCorrect = correctRemaining > 0;
    if (isCorrect) correctRemaining -= 1;

    const hardIsCorrect = isHard && hardCorrectRemaining > 0;
    if (hardIsCorrect) hardCorrectRemaining -= 1;
    const finalCorrect = isHard ? hardIsCorrect : isCorrect;

    const baseMs = perQuestionSeconds * 1000;
    let timeMs = baseMs;
    if (!finalCorrect && rushIncorrect) {
      timeMs = Math.round(baseMs * 0.35);
    } else if (!finalCorrect) {
      timeMs = Math.round(baseMs * 1.6);
    } else if (finalCorrect && isHard) {
      timeMs = Math.round(baseMs * 1.05);
    }

    answers.push({
      question: `Q${index + 1}`,
      type: 'mcq',
      topic: 'Topic',
      difficulty: isHard ? 'hard' : 'medium',
      isCorrect: finalCorrect,
      time_ms: timeMs,
    });
  }

  return answers;
};

const naturalFastAnswers = (total = 20) => makeTimedAnswers({
  total,
  correctCount: Math.round(total * 0.85),
  perQuestionSeconds: 50,
  hardCount: 6,
  hardCorrectCount: 5,
  rushIncorrect: false,
});

const rushingAnswers = (total = 20) => makeTimedAnswers({
  total,
  correctCount: Math.round(total * 0.7),
  perQuestionSeconds: 45,
  hardCount: 8,
  hardCorrectCount: 2,
  rushIncorrect: true,
});

const queueExamInsightsTables = ({ attempts = [], classes = [] }) => {
  const attemptOrder = vi.fn().mockResolvedValue({ data: attempts, error: null });
  const attemptSelect = vi.fn().mockReturnValue({ order: attemptOrder });

  const classOrder = vi.fn().mockResolvedValue({ data: classes, error: null });
  const classSelect = vi.fn().mockReturnValue({ order: classOrder });

  supabase.from
    .mockReturnValueOnce({ select: attemptSelect })
    .mockReturnValueOnce({ select: classSelect });
};

describe('authApi exam insights', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReset();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('returns an empty exam insights payload when there are no attempts', async () => {
    queueExamInsightsTables({
      attempts: [],
      classes: [],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.hubReady).toBe(false);
    expect(insights.minAttemptsRequired).toBe(MIN_HUB_INSIGHT_ATTEMPTS);
    expect(insights.summary.totalAttempts).toBe(0);
    expect(insights.persona.label).toBe('Getting Started');
    expect(insights.recommendedActions[0]).toMatchObject({
      kind: 'generate_standard',
      label: 'Generate your first mock exam',
    });
  });

  it('returns collecting hub payload with one completed attempt', async () => {
    queueExamInsightsTables({
      attempts: [
        buildAttempt({ id: 'a1', examId: 'exam-1', score: 8, total: 10, completedAt: '2026-03-20T16:00:00.000Z' }),
      ],
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.hubReady).toBe(false);
    expect(insights.summary.totalAttempts).toBe(1);
    expect(insights.summary.averageScore).toBeNull();
    expect(insights.persona.key).toBe('getting-started');
    expect(insights.paceTemperament).toBeNull();
    expect(insights.strengthInsights.level).toBe('forming');
    expect(insights.strengthInsights.strengths).toHaveLength(0);
  });

  it('returns collecting hub payload with two completed attempts', async () => {
    queueExamInsightsTables({
      attempts: [
        buildAttempt({ id: 'a2', examId: 'exam-2', score: 7, total: 10, completedAt: '2026-03-22T16:00:00.000Z' }),
        buildAttempt({ id: 'a1', examId: 'exam-1', score: 6, total: 10, completedAt: '2026-03-20T16:00:00.000Z' }),
      ],
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.hubReady).toBe(false);
    expect(insights.summary.totalAttempts).toBe(2);
    expect(insights.persona.key).toBe('getting-started');
    expect(insights.strengthInsights.level).toBe('forming');
    expect(insights.recentAttempts).toHaveLength(2);
  });

  it('aggregates summary metrics and habits from all historical attempts', async () => {
    queueExamInsightsTables({
      attempts: [
        buildAttempt({ id: 'a3', examId: 'exam-3', score: 9, total: 10, completedAt: '2026-03-22T16:00:00.000Z', durationSeconds: 600 }),
        buildAttempt({ id: 'a2', examId: 'exam-2', score: 7, total: 10, completedAt: '2026-03-21T16:00:00.000Z', durationSeconds: 900 }),
        buildAttempt({ id: 'a1', examId: 'exam-1', score: 6, total: 10, completedAt: '2026-03-20T16:00:00.000Z', durationSeconds: 1200 }),
      ],
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.hubReady).toBe(true);
    expect(insights.summary.totalAttempts).toBe(3);
    expect(insights.summary.averageScore).toBeCloseTo(73.333, 2);
    expect(insights.summary.bestScore).toBe(90);
    expect(insights.summary.averagePaceSeconds).toBeCloseTo(90, 3);
    expect(insights.habits.averageDurationMinutes).toBeCloseTo(15, 3);
    expect(insights.habits.strongestStudyDay).toMatchObject({
      day: 'Sunday',
      averageScore: 90,
    });
    expect(insights.recentAttempts).toHaveLength(3);
  });

  it('uses global attempt count for hub readiness even when classId is passed', async () => {
    queueExamInsightsTables({
      attempts: [
        buildAttempt({ id: 'bio-1', examId: 'exam-b1', score: 9, total: 10, completedAt: '2026-03-22T16:00:00.000Z', classId: 'class-bio', title: 'Bio Mock' }),
        buildAttempt({ id: 'chem-1', examId: 'exam-c1', score: 5, total: 10, completedAt: '2026-03-21T16:00:00.000Z', classId: 'class-chem', title: 'Chem Mock' }),
      ],
      classes: [
        { id: 'class-bio', name: 'Biology', color: '#7a9e72' },
        { id: 'class-chem', name: 'Chemistry', color: '#cf8f43' },
      ],
    });

    const insights = await authApi.getExamInsights({ classId: 'class-chem' });

    expect(insights.hubReady).toBe(false);
    expect(insights.summary.totalAttempts).toBe(2);
    expect(insights.summary.averageScore).toBeNull();
    expect(insights.classOptions.map((option) => option.name)).toEqual(['Biology', 'Chemistry']);
    expect(insights).not.toHaveProperty('weakTopics');
  });

  it('classifies a fast and accurate exam taker at the threshold', async () => {
    const answers = naturalFastAnswers(20);
    queueExamInsightsTables({
      attempts: padAttemptsToHubMinimum([
        buildAttempt({
          id: 'a2',
          examId: 'exam-2',
          score: 16,
          total: 20,
          completedAt: '2026-03-22T16:00:00.000Z',
          durationSeconds: 1000,
          answers,
        }),
        buildAttempt({
          id: 'a1',
          examId: 'exam-1',
          score: 16,
          total: 20,
          completedAt: '2026-03-20T16:00:00.000Z',
          durationSeconds: 1000,
          answers,
        }),
      ]),
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.summary.averageScore).toBe(80);
    expect(insights.paceTemperament.key).toBe('natural-fast');
    expect(insights.persona.label).toBe('Fast & Accurate');
    expect(insights.strengthInsights.level).toBe('strong');
    expect(insights.persona.strengths?.length).toBeGreaterThan(0);
  });

  it('labels rushing temperament and avoids Fast & Accurate for fast mediocre accuracy', async () => {
    const answers = rushingAnswers(20);
    queueExamInsightsTables({
      attempts: padAttemptsToHubMinimum([
        buildAttempt({
          id: 'a2',
          examId: 'exam-2',
          score: 14,
          total: 20,
          completedAt: '2026-03-22T16:00:00.000Z',
          durationSeconds: 900,
          answers,
        }),
        buildAttempt({
          id: 'a1',
          examId: 'exam-1',
          score: 14,
          total: 20,
          completedAt: '2026-03-20T16:00:00.000Z',
          durationSeconds: 900,
          answers,
        }),
      ]),
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.paceTemperament.key).toBe('rushing');
    expect(insights.persona.label).toBe('Cramming Loop');
    expect(insights.persona.label).not.toBe('Fast & Accurate');
    expect(insights.strengthInsights.level).not.toBe('strong');
    expect(insights.strengthInsights.strengths).toHaveLength(0);
  });

  it('classifies fast inaccurate attempts as rushing with Cramming Loop persona', async () => {
    const answers = makeTimedAnswers({
      total: 20,
      correctCount: 11,
      perQuestionSeconds: 40,
      hardCount: 8,
      hardCorrectCount: 2,
      rushIncorrect: true,
    });
    queueExamInsightsTables({
      attempts: padAttemptsToHubMinimum([
        buildAttempt({
          id: 'a2',
          examId: 'exam-2',
          score: 11,
          total: 20,
          completedAt: '2026-03-22T16:00:00.000Z',
          durationSeconds: 800,
          answers,
        }),
        buildAttempt({
          id: 'a1',
          examId: 'exam-1',
          score: 11,
          total: 20,
          completedAt: '2026-03-20T16:00:00.000Z',
          durationSeconds: 800,
          answers,
        }),
      ]),
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.paceTemperament.key).toBe('rushing');
    expect(insights.persona.label).toBe('Cramming Loop');
  });

  it('classifies deliberate strong pacing separately from rushing', async () => {
    const answers = makeTimedAnswers({
      total: 20,
      correctCount: 17,
      perQuestionSeconds: 100,
      hardCount: 5,
      hardCorrectCount: 4,
      rushIncorrect: false,
    });
    queueExamInsightsTables({
      attempts: padAttemptsToHubMinimum([
        buildAttempt({
          id: 'a2',
          examId: 'exam-2',
          score: 17,
          total: 20,
          completedAt: '2026-03-22T16:00:00.000Z',
          durationSeconds: 2000,
          answers,
        }),
        buildAttempt({
          id: 'a1',
          examId: 'exam-1',
          score: 17,
          total: 20,
          completedAt: '2026-03-20T16:00:00.000Z',
          durationSeconds: 2000,
          answers,
        }),
      ]),
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.paceTemperament.key).toBe('deliberate');
    expect(insights.persona.label).toBe('Deliberate Builder');
    expect(insights.persona.description).toContain('strong');
    expect(insights.strengthInsights.level).toBe('strong');
    expect(insights.strengthInsights.strengths.length).toBeGreaterThan(0);
  });

  it('flags retake memorization when second attempt is faster without score lift', async () => {
    const slowAnswers = makeTimedAnswers({
      total: 10,
      correctCount: 6,
      perQuestionSeconds: 90,
      hardCount: 3,
      hardCorrectCount: 1,
    });
    const fastAnswers = makeTimedAnswers({
      total: 10,
      correctCount: 7,
      perQuestionSeconds: 40,
      hardCount: 3,
      hardCorrectCount: 2,
    });
    const attempts = [
      buildAttempt({
        id: 'a2',
        examId: 'exam-repeat',
        score: 7,
        total: 10,
        completedAt: '2026-03-22T16:00:00.000Z',
        durationSeconds: 400,
        answers: fastAnswers,
      }),
      buildAttempt({
        id: 'a1',
        examId: 'exam-repeat',
        score: 6,
        total: 10,
        completedAt: '2026-03-20T16:00:00.000Z',
        durationSeconds: 900,
        answers: slowAnswers,
      }),
    ];

    const temperament = buildAggregatePaceTemperament(attempts, 65);
    expect(temperament.metrics.hasMemorizationRetakes).toBe(true);
    expect(temperament.key).not.toBe('natural-fast');
  });

  it('uses active pace from time_ms when duration_seconds is missing', async () => {
    const answers = naturalFastAnswers(10);
    const attempts = [
      buildAttempt({
        id: 'a2',
        examId: 'exam-2',
        score: 9,
        total: 10,
        completedAt: '2026-03-22T16:00:00.000Z',
        durationSeconds: null,
        answers,
      }),
      buildAttempt({
        id: 'a1',
        examId: 'exam-1',
        score: 9,
        total: 10,
        completedAt: '2026-03-20T16:00:00.000Z',
        durationSeconds: null,
        answers,
      }),
    ];

    const temperament = buildAggregatePaceTemperament(attempts, 90);
    expect(temperament.key).toBe('natural-fast');
    expect(temperament.metrics.averagePaceSeconds).toBeLessThanOrEqual(75);
  });

  it('returns low confidence temperament for a single timed attempt', async () => {
    const answers = rushingAnswers(20);
    const temperament = buildAggregatePaceTemperament(
      [
        buildAttempt({
          id: 'a1',
          examId: 'exam-1',
          score: 14,
          total: 20,
          completedAt: '2026-03-20T16:00:00.000Z',
          durationSeconds: 900,
          answers,
        }),
      ],
      70,
    );
    expect(temperament.confidence).toBe('low');
    expect(temperament.key).toBe('rushing');
  });

  it('suppresses retake CTA when rushing and the latest exam was already retaken', async () => {
    const answers = rushingAnswers(10);
    queueExamInsightsTables({
      attempts: padAttemptsToHubMinimum([
        buildAttempt({
          id: 'a2',
          examId: 'exam-repeat',
          score: 6,
          total: 10,
          completedAt: '2026-03-22T16:00:00.000Z',
          durationSeconds: 450,
          answers,
        }),
        buildAttempt({
          id: 'a1',
          examId: 'exam-repeat',
          score: 7,
          total: 10,
          completedAt: '2026-03-20T16:00:00.000Z',
          durationSeconds: 500,
          answers,
        }),
      ]),
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();
    const retakeAction = insights.recommendedActions.find((action) => action.kind === 'retake_exam');

    expect(insights.paceTemperament.key).toBe('rushing');
    expect(retakeAction).toBeUndefined();
  });

  it('preserves deleted exam attempts in insights and omits retake for missing exams', async () => {
    queueExamInsightsTables({
      attempts: [
        buildAttempt({
          id: 'deleted-1',
          examId: null,
          score: 8,
          total: 10,
          completedAt: '2026-03-22T16:00:00.000Z',
          classId: 'class-bio',
          title: 'Deleted Biology Mock',
          examMode: 'focused',
          liveExam: false,
        }),
        buildAttempt({
          id: 'live-1',
          examId: 'exam-1',
          score: 7,
          total: 10,
          completedAt: '2026-03-20T16:00:00.000Z',
          classId: 'class-bio',
          title: 'Live Biology Mock',
        }),
      ],
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.summary.totalAttempts).toBe(2);
    expect(insights.recentAttempts[0]).toMatchObject({
      title: 'Deleted Biology Mock',
      classId: 'class-bio',
      examMode: 'focused',
    });
    expect(insights.classOptions).toEqual([
      expect.objectContaining({ id: 'class-bio', attemptCount: 2 }),
    ]);
    expect(insights.recommendedActions.some((action) => action.kind === 'retake_exam')).toBe(false);
  });

  it('computes a high rush index when misses are faster than correct answers', () => {
    const answers = rushingAnswers(20);
    const rushIndex = computeRushIndex(answers);
    expect(rushIndex).toBeGreaterThanOrEqual(0.35);
  });

  it('classifies a steady climber when recent performance clears the baseline by eight points', async () => {
    queueExamInsightsTables({
      attempts: [
        buildAttempt({ id: 'a6', examId: 'exam-6', score: 9, total: 10, completedAt: '2026-03-25T16:00:00.000Z' }),
        buildAttempt({ id: 'a5', examId: 'exam-5', score: 8, total: 10, completedAt: '2026-03-24T16:00:00.000Z' }),
        buildAttempt({ id: 'a4', examId: 'exam-4', score: 8, total: 10, completedAt: '2026-03-23T16:00:00.000Z' }),
        buildAttempt({ id: 'a3', examId: 'exam-3', score: 6, total: 10, completedAt: '2026-03-22T16:00:00.000Z' }),
        buildAttempt({ id: 'a2', examId: 'exam-2', score: 5, total: 10, completedAt: '2026-03-21T16:00:00.000Z' }),
        buildAttempt({ id: 'a1', examId: 'exam-1', score: 4, total: 10, completedAt: '2026-03-20T16:00:00.000Z' }),
      ],
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.summary.trendDelta).toBeCloseTo(33.333, 2);
    expect(insights.persona.label).toBe('Steady Climber');
    expect(['strong', 'solid']).toContain(insights.strengthInsights.level);
    expect(insights.strengthInsights.strengths.some((item) => item.includes('improvement'))).toBe(true);
  });

  it('does not mark a single high-score attempt as a strong exam taker', async () => {
    const answers = naturalFastAnswers(20);
    queueExamInsightsTables({
      attempts: [
        buildAttempt({
          id: 'a1',
          examId: 'exam-1',
          score: 18,
          total: 20,
          completedAt: '2026-03-20T16:00:00.000Z',
          durationSeconds: 1000,
          answers,
        }),
      ],
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.hubReady).toBe(false);
    expect(insights.summary.totalAttempts).toBe(1);
    expect(insights.summary.averageScore).toBeNull();
    expect(insights.persona.key).toBe('getting-started');
    expect(insights.strengthInsights.level).toBe('forming');
  });

  it('buildStrengthInsights returns solid for improving mid-high scores without cramming persona', () => {
    const result = buildStrengthInsights({
      totalAttempts: 3,
      averageScore: 72,
      bestScore: 78,
      trendDelta: 6,
      personaKey: 'deliberate-builder',
      paceTemperament: {
        key: 'deliberate',
        confidence: 'medium',
        label: 'Deliberate pace',
      },
      latestAttempt: null,
      personaStrengths: [],
    });

    expect(result.level).toBe('solid');
    expect(result.affirmation).toContain('on track');
  });

  it('classifies a cramming loop when retakes are high without meaningful lift', async () => {
    queueExamInsightsTables({
      attempts: [
        buildAttempt({ id: 'a4', examId: 'exam-repeat', score: 6, total: 10, completedAt: '2026-03-23T16:00:00.000Z' }),
        buildAttempt({ id: 'a3', examId: 'exam-repeat', score: 5, total: 10, completedAt: '2026-03-22T16:00:00.000Z' }),
        buildAttempt({ id: 'a2', examId: 'exam-repeat', score: 5, total: 10, completedAt: '2026-03-21T16:00:00.000Z' }),
        buildAttempt({ id: 'a1', examId: 'exam-other', score: 5, total: 10, completedAt: '2026-03-20T16:00:00.000Z' }),
      ],
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();

    expect(insights.habits.retryRate).toBeCloseTo(0.5, 3);
    expect(insights.persona.label).toBe('Cramming Loop');
  });

  it('emits only generic class-aware recommendation payloads for the hub', async () => {
    queueExamInsightsTables({
      attempts: padAttemptsToHubMinimum([
        buildAttempt({ id: 'a1', examId: 'exam-1', score: 6, total: 10, completedAt: '2026-03-20T16:00:00.000Z', classId: 'class-bio', title: 'Cell Unit Exam' }),
        buildAttempt({ id: 'a2', examId: 'exam-2', score: 7, total: 10, completedAt: '2026-03-22T16:00:00.000Z', classId: 'class-bio', title: 'Membranes Quiz' }),
      ]),
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();
    const standardAction = insights.recommendedActions.find((action) => action.kind === 'generate_standard');

    expect(insights.hubReady).toBe(true);
    expect(insights).not.toHaveProperty('weakTopics');
    expect(insights.recommendedActions.some((action) => action.kind === 'generate_focused')).toBe(false);
    expect(standardAction).toMatchObject({
      label: 'Build another Biology exam',
      payload: {
        classId: 'class-bio',
        title: 'Biology Mock Exam',
      },
    });
  });

  it('keeps persona copy free of topic wording', async () => {
    queueExamInsightsTables({
      attempts: padAttemptsToHubMinimum([
        buildAttempt({ id: 'a2', examId: 'exam-2', score: 7, total: 10, completedAt: '2026-03-22T16:00:00.000Z' }),
        buildAttempt({ id: 'a1', examId: 'exam-1', score: 7, total: 10, completedAt: '2026-03-20T16:00:00.000Z' }),
      ]),
      classes: [{ id: 'class-bio', name: 'Biology', color: '#7a9e72' }],
    });

    const insights = await authApi.getExamInsights();
    const personaCopy = [
      insights.persona.description,
      ...(insights.persona.evidence || []),
      ...(insights.persona.improvements || []),
    ].join(' ').toLowerCase();

    expect(personaCopy).not.toContain('weak topic');
    expect(personaCopy).not.toContain('topics');
  });
});
