import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const registerStudyRoutes = require('../routes/study');

const makeGuideData = () => ({
  session_meta: {
    subject: 'Biology',
    student_goal: 'Understand mitosis',
    student_level: 'intermediate',
    exam_context: { label: 'Midterm', date: '2026-05-14' },
    source_mode: 'hybrid',
    estimated_minutes: 16,
    preferred_tutor_tone: 'calm review',
  },
  river: {
    name: 'River',
    species: 'grey cat',
    style: 'premium svg mascot',
    tone: 'calm, precise, encouraging',
    default_expression: 'blink_soft',
    default_animation: 'tail_sway_idle',
    cue_map: {
      idle: { expression: 'blink_soft', animation: 'tail_sway_idle' },
      focus: { expression: 'focus_lean_in', animation: 'ear_tilt_curious' },
      recover: { expression: 'soft_concern_mistake', animation: 'paw_point_hint' },
      mastery: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
    },
    dialogue_variants: {
      opening: ['We will train this one step at a time.'],
      encouragement: ['Stay with the structure.'],
      recovery: ['Take the smaller step first.'],
      mastery: ['That is stable.'],
    },
  },
  knowledge_map: {
    concepts: [
      {
        id: 'concept-mitosis',
        title: 'Mitosis',
        summary: 'Mitosis produces identical daughter cells.',
        depends_on: [],
        weak_points: ['outcome'],
        misconception_tags: ['meiosis-mixup'],
      },
    ],
  },
  cards: [
    {
      id: 'card-1',
      concept_id: 'concept-mitosis',
      phase: 'diagnostic',
      difficulty: 'low',
      card_type: 'short_answer',
      prompt: 'What is the outcome of mitosis?',
      target_answer: 'Two genetically identical daughter cells.',
      required_idea_tags: ['two-daughter-cells', 'identical-genetic-material'],
      optional_idea_tags: [],
      misconception_tags: ['meiosis-mixup'],
      hints: [
        { level: 1, text: 'Think about how many cells you end with.', cue: { expression: 'ear_tilt_curious', animation: 'paw_point_hint' } },
      ],
      feedback: {
        correct: ['Clean answer.'],
        partial: ['Partly there.'],
        incorrect: ['Reset around the outcome.'],
        empty: ['Start with the number of cells.'],
        misconception: [{ misconception_id: 'meiosis-mixup', responses: ['That describes meiosis, not mitosis.'] }],
      },
      river: {
        intro: 'Try it before I help.',
        success: 'That lands exactly where it should.',
        struggle: 'Let me narrow the frame.',
      },
      transitions: {
        on_correct: null,
        on_partial: 'retry',
        on_incorrect: 'hint',
        on_struggle: 'retry',
      },
      mastery_weight: 1,
    },
  ],
  evaluation_rules: {
    score_bands: { correct: 0.85, partial: 0.4 },
    empty_patterns: ['idk'],
    tag_synonyms: {
      'two-daughter-cells': ['two daughter cells', '2 daughter cells'],
      'identical-genetic-material': ['same dna', 'genetically identical'],
    },
    misconception_rules: [
      {
        id: 'meiosis-mixup',
        concept_id: 'concept-mitosis',
        trigger_phrases: ['four daughter cells'],
        correction: 'That describes meiosis, not mitosis.',
      },
    ],
  },
  adaptation_rules: {
    max_attempts_before_recovery: 2,
    max_hints_per_card: 2,
    performance_bands: {
      struggling: { mastery_below: 45, river_expression: 'soft_concern_mistake', river_animation: 'paw_point_hint' },
      steady: { mastery_below: 80, river_expression: 'focus_lean_in', river_animation: 'ear_tilt_curious' },
      mastery: { mastery_below: 101, river_expression: 'whisker_pride', river_animation: 'sparkle_mastery' },
    },
  },
  completion: {
    title: 'Session complete',
    mastery_message: 'You converted recall into stable structure.',
    confidence_close: 'Ready for the next pass.',
    next_review_message: 'Come back tomorrow.',
    river_cue: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
  },
});

const makeStudyState = (overrides = {}) => ({
  current_card_id: 'card-1',
  session_phase: 'diagnostic',
  card_states: {
    'card-1': {
      attempts: 0,
      hints_used: 0,
      status: 'unseen',
      last_outcome: null,
      completed: false,
      assist_count: 0,
      last_assist_at: null,
      revealed_answer: false,
      skipped: false,
    },
  },
  concept_mastery: {
    'concept-mitosis': { score: 0, status: 'unseen', attempts: 0, correct_attempts: 0, last_outcome: null },
  },
  last_interaction_at: null,
  completed_at: null,
  last_reviewed_at: null,
  ...overrides,
});

describe('POST /api/study/session-complete', () => {
  let app;
  let db;
  let client;

  beforeEach(() => {
    app = express();
    app.use(express.json());

    client = {
      query: vi.fn(async (text) => {
        if (text.includes('SELECT xp_total, level, sessions_completed, topics_mastered')) {
          return { rows: [{ xp_total: 0, level: 1, sessions_completed: 0, topics_mastered: 0 }] };
        }
        if (text.includes('SELECT COUNT(*)::int AS mastered_count')) {
          return { rows: [{ mastered_count: 0 }] };
        }
        if (text.includes('SELECT streak_data')) {
          return { rows: [{ streak_data: '{}' }] };
        }
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    db = {
      queryOne: vi.fn(async () => ({
        id: 'guide-1',
        title: 'Biology River Session',
        class_id: 'class-1',
        guide_data: makeGuideData(),
        study_state: makeStudyState(),
      })),
      pool: {
        connect: vi.fn(async () => client),
      },
    };

    registerStudyRoutes({
      app,
      db,
      authMiddleware: (req, _res, next) => {
        req.user = { id: 1 };
        next();
      },
    });
  });

  it('stores stopped-early session metadata and reduces credit for early exits', async () => {
    const before = makeStudyState();
    const after = makeStudyState({
      current_card_id: 'card-1',
      card_states: {
        'card-1': {
          attempts: 1,
          hints_used: 0,
          status: 'needs_review',
          last_outcome: 'revealed',
          completed: false,
          assist_count: 1,
          last_assist_at: '2026-04-05T12:00:00.000Z',
          revealed_answer: true,
          skipped: false,
        },
      },
      concept_mastery: {
        'concept-mitosis': { score: 0, status: 'unseen', attempts: 0, correct_attempts: 0, last_outcome: null },
      },
      last_interaction_at: '2026-04-05T12:00:00.000Z',
    });

    const response = await request(app)
      .post('/api/study/session-complete')
      .send({
        guideId: 'guide-1',
        guideData: makeGuideData(),
        studyStateBefore: before,
        studyStateAfter: after,
        sessionOutcome: 'stopped_early',
        exitReason: 'user_left',
      });

    expect(response.status).toBe(200);
    expect(response.body.xpEarned).toBe(0);

    const sessionInsertCall = client.query.mock.calls.find(([text]) => text.includes('INSERT INTO study_sessions'));
    expect(sessionInsertCall).toBeTruthy();
    expect(JSON.parse(sessionInsertCall[1][9])).toEqual(expect.objectContaining({
      sessionOutcome: 'stopped_early',
      exitReason: 'user_left',
    }));
  });
});
