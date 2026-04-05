import { describe, expect, it } from 'vitest';

import {
  buildStudyGuideSummaryDoc,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
  studyGuideDataToPlainText,
} from '../../supabase/functions/_shared/studyGuideCore.mjs';

const makeGuideData = () => ({
  session_meta: {
    subject: 'Biology',
    student_goal: 'Master cell division',
    student_level: 'intermediate',
    exam_context: {
      label: 'Biology Midterm',
      date: '2026-05-14',
    },
    source_mode: 'hybrid',
    estimated_minutes: 18,
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
      opening: ['We will build this one step at a time.'],
      encouragement: ['Stay with the structure, not the panic.'],
      recovery: ['Take a smaller step first.'],
      mastery: ['That is solid. Keep the same standard on the next one.'],
    },
  },
  knowledge_map: {
    concepts: [
      {
        id: 'concept-mitosis',
        title: 'Mitosis',
        summary: 'Mitosis produces two genetically identical daughter cells.',
        depends_on: [],
        weak_points: ['stage-order', 'purpose'],
        misconception_tags: ['meiosis-mixup'],
      },
      {
        id: 'concept-cytokinesis',
        title: 'Cytokinesis',
        summary: 'Cytokinesis splits the cytoplasm after mitosis.',
        depends_on: ['concept-mitosis'],
        weak_points: ['timing'],
        misconception_tags: [],
      },
    ],
  },
  cards: [
    {
      id: 'card-diagnose-mitosis',
      concept_id: 'concept-mitosis',
      phase: 'diagnostic',
      difficulty: 'low',
      card_type: 'short_answer',
      prompt: 'What is the main outcome of mitosis?',
      target_answer: 'Two genetically identical daughter cells.',
      required_idea_tags: ['two-daughter-cells', 'identical-genetic-material'],
      optional_idea_tags: ['growth-repair'],
      misconception_tags: ['meiosis-mixup'],
      hints: [
        {
          level: 1,
          text: 'Think about how many cells you end with.',
          cue: { expression: 'ear_tilt_curious', animation: 'paw_point_hint' },
        },
      ],
      feedback: {
        correct: ['Clean answer.'],
        partial: ['Partly there.'],
        incorrect: ['Reset around the outcome.'],
        empty: ['Start with the number of cells.'],
        misconception: [
          {
            misconception_id: 'meiosis-mixup',
            responses: ['That describes meiosis, not mitosis.'],
          },
        ],
      },
      river: {
        intro: 'Try it before I help.',
        success: 'That lands exactly where it should.',
        struggle: 'Let me narrow the frame.',
      },
      transitions: {
        on_correct: 'card-apply-cytokinesis',
        on_partial: 'retry',
        on_incorrect: 'hint',
        on_struggle: 'card-recovery-mitosis',
      },
      mastery_weight: 1,
    },
    {
      id: 'card-apply-cytokinesis',
      concept_id: 'concept-cytokinesis',
      phase: 'apply',
      difficulty: 'medium',
      card_type: 'short_answer',
      prompt: 'What does cytokinesis split, and when does it happen relative to mitosis?',
      target_answer: 'It splits the cytoplasm after mitosis.',
      required_idea_tags: ['splits-cytoplasm', 'after-mitosis'],
      optional_idea_tags: [],
      misconception_tags: [],
      hints: [],
      feedback: {
        correct: ['Exactly.'],
        partial: ['Add what gets split or when it happens.'],
        incorrect: ['Anchor on nuclear division versus cytoplasmic division.'],
        empty: ['Name what gets divided after mitosis finishes.'],
        misconception: [],
      },
      river: {
        intro: 'Now apply the sequence.',
        success: 'That is clear and exam-ready.',
        struggle: 'Separate the jobs of the two processes.',
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
      'splits-cytoplasm': ['splits the cytoplasm'],
      'after-mitosis': ['after mitosis'],
    },
    misconception_rules: [
      {
        id: 'meiosis-mixup',
        concept_id: 'concept-mitosis',
        trigger_phrases: ['four daughter cells', 'half the chromosomes'],
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
    confidence_close: 'You do not need to reread this pass. You need one more clean retrieval later.',
    next_review_message: 'Return tomorrow for a short reinforcement pass.',
    river_cue: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
  },
});

describe('studyGuideCore', () => {
  it('normalizes the River v4 tutor-session payload and derives the runtime state', () => {
    const guideData = normalizeStudyGuideData(makeGuideData());

    expect(guideData).toEqual(expect.objectContaining({
      version: 4,
      session_meta: expect.objectContaining({
        subject: 'Biology',
        student_goal: 'Master cell division',
      }),
      river: expect.objectContaining({
        name: 'River',
      }),
      sections: [
        expect.objectContaining({ id: 'concept-mitosis', title: 'Mitosis' }),
        expect.objectContaining({ id: 'concept-cytokinesis', title: 'Cytokinesis' }),
      ],
    }));

    expect(createDefaultStudyGuideState(guideData)).toEqual({
      current_card_id: 'card-diagnose-mitosis',
      session_phase: 'diagnostic',
      card_states: expect.objectContaining({
        'card-diagnose-mitosis': expect.objectContaining({
          attempts: 0,
          hints_used: 0,
          status: 'unseen',
          completed: false,
        }),
      }),
      concept_mastery: expect.objectContaining({
        'concept-mitosis': expect.objectContaining({
          score: 0,
          status: 'unseen',
          attempts: 0,
        }),
      }),
      last_interaction_at: null,
      completed_at: null,
      last_reviewed_at: null,
    });
  });

  it('rejects pre-v4 section-based guide payloads', () => {
    expect(normalizeStudyGuideData({
      overview: 'Old guide',
      sections: [
        {
          id: 'old-1',
          title: 'Old section',
          recall_prompt: 'Old prompt',
          answer_points: ['Old answer'],
        },
      ],
    })).toBe(null);
  });

  it('builds summary docs and plain text exports from the River contract', () => {
    const guideData = makeGuideData();
    const summaryDoc = buildStudyGuideSummaryDoc(guideData);
    const plainText = studyGuideDataToPlainText(guideData);

    expect(summaryDoc).toEqual(expect.objectContaining({
      type: 'doc',
      content: expect.arrayContaining([
        expect.objectContaining({
          type: 'heading',
          attrs: { level: 1 },
        }),
      ]),
    }));
    expect(plainText).toContain('Subject: Biology');
    expect(plainText).toContain('Goal: Master cell division');
    expect(plainText).toContain('Concept 1: Mitosis');
    expect(plainText).toContain('Two genetically identical daughter cells.');
  });
});
