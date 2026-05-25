import { describe, expect, it } from 'vitest';

import {
  buildStudyGuideSummaryDoc,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
  studyGuideDataToPlainText,
  validateTutorSessionQuality,
} from '../../supabase/functions/_shared/studyGuideCore.mjs';

const makeStrongTeaching = (topic = 'mitosis') => ({
  learning_objective: `Explain ${topic} by tracing the mechanism, outcome, examples, and likely mistakes.`,
  explain: [
    `${topic} starts with a concrete job, not a vocabulary label. The student first needs to know what the process is responsible for and what finished result would prove that the process worked. That turns the topic into a checkable claim instead of a loose definition.`,
    `The mechanism is the second layer. A strong learner can describe what changes first, why that change makes the next step possible, and how the parts stay coordinated. This matters because exam questions often change the wording while still testing the same chain of cause and effect.`,
    `The final layer is transfer. Once the student can follow the mechanism, examples become easier because each example is just a different surface version of the same underlying pattern. The student should be able to explain the result, reject a tempting distractor, and say why the correction is true. That is what makes the lesson useful after the exact wording changes.`,
  ].join('\n\n'),
  intuition: `Think of ${topic} like a handoff line where each person must pass the right item to the next person; if one handoff is wrong, the final result exposes the mistake.`,
  worked_examples: [
    {
      title: 'Example 1: Basic application',
      problem: `A short-answer question asks what ${topic} produces and why that result matters.`,
      steps: [
        { step: 'Name the final product.', detail: 'Starting from the final product keeps the answer anchored to what the grader needs to see.' },
        { step: 'Connect the product to the mechanism.', detail: 'The mechanism explains why the output is not just memorized but logically produced by the process.' },
      ],
      result: `The answer identifies the output of ${topic} and the reason the process produces it.`,
      takeaway: 'The safest answer pairs outcome with mechanism.',
    },
    {
      title: 'Example 2: Distractor application',
      problem: `A harder question asks the student to separate ${topic} from a similar process.`,
      steps: [
        { step: 'Compare what each process changes.', detail: 'Similar processes often share words, so the changed quantity or structure is the reliable separator.' },
        { step: 'Reject the option with the wrong result.', detail: 'A familiar-sounding option is still wrong when its final result does not match the prompt.' },
      ],
      result: `The correct choice is the process whose mechanism and final result match ${topic}.`,
      takeaway: 'Distractors fall apart when mechanism and outcome are checked together.',
    },
  ],
  common_mistakes: [
    `Only naming the topic is wrong because the correction requires explaining what ${topic} actually changes.`,
    `Choosing a similar process is wrong because the final result should be used to correct the mix-up.`,
  ],
  example: `${topic} can be tested by asking what changes, why it changes, and what final state proves the change happened.`,
  steps: ['Name the output.', 'Trace the mechanism.', 'Reject the distractor.'],
  why_it_matters: `${topic} matters because it turns memorized vocabulary into usable exam reasoning.`,
});

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
    lecture_style: 'storybook seminar',
    river_role: 'witty lecture cat',
  },
  lecture: {
    opening: 'Welcome to today’s River lecture on how cell division actually works.',
    agenda: [
      'Lock the outcome of mitosis.',
      'Separate mitosis from meiosis.',
    ],
    closing: 'You do not need perfection here. You need a clean mental frame you can retrieve again.',
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
      teach: { expression: 'focus_lean_in', animation: 'beanie_bob_teach' },
      point: { expression: 'focus_lean_in', animation: 'paw_point_stage' },
      encourage: { expression: 'blink_soft', animation: 'soft_nod_glow' },
      thinking: { expression: 'ear_tilt_curious', animation: 'tail_think_loop' },
      'gentle-correct': { expression: 'soft_concern_mistake', animation: 'paw_point_hint' },
      celebrate: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
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
      teaching: {
        explain: 'Mitosis is the division step that preserves the original genetic blueprint while making two new cells.',
        example: 'If your skin needs repair, mitosis helps create replacement cells with the same DNA instructions.',
        steps: [
          'Start with one parent cell.',
          'Copy the DNA so the information is ready to share.',
          'Separate the copies so each new cell gets the same set.',
        ],
        why_it_matters: 'This is the foundation for growth, repair, and keeping body tissues genetically consistent.',
      },
      assist_options: [
        {
          id: 'explain-simply',
          label: 'Explain simply',
          text: 'In simple terms: mitosis makes two matching replacement cells.',
          pose: 'encourage',
        },
        {
          id: 'show-example',
          label: 'Show another example',
          text: 'A healing cut uses mitosis to make more skin cells with the same DNA as the original ones.',
          pose: 'point',
        },
        {
          id: 'break-it-down',
          label: 'Break it down',
          text: 'One cell copies its DNA, lines it up, and splits into two equal genetic matches.',
          pose: 'teach',
        },
        {
          id: 'why-it-matters',
          label: 'Why this matters',
          text: 'If you confuse mitosis, you will also confuse how the body grows and repairs itself.',
          pose: 'thinking',
        },
      ],
      presentation: {
        pose: 'teach',
        emphasis_target: 'Two genetically identical daughter cells',
        reaction_cue: { expression: 'focus_lean_in', animation: 'ear_tilt_curious' },
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
    pass_threshold: 0.5,
    partial_advances: true,
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
        lecture_style: 'storybook seminar',
        river_role: 'witty lecture cat',
      }),
      lecture: expect.objectContaining({
        opening: 'Welcome to today’s River lecture on how cell division actually works.',
        agenda: expect.arrayContaining(['Lock the outcome of mitosis.']),
      }),
      river: expect.objectContaining({
        name: 'River',
      }),
      sections: [
        expect.objectContaining({ id: 'concept-mitosis', title: 'Mitosis' }),
        expect.objectContaining({ id: 'concept-cytokinesis', title: 'Cytokinesis' }),
      ],
    }));
    expect(guideData.cards[0]).toEqual(expect.objectContaining({
      teaching: expect.objectContaining({
        explain: expect.any(String),
        example: expect.any(String),
        steps: expect.any(Array),
        why_it_matters: expect.any(String),
      }),
      assist_options: expect.arrayContaining([
        expect.objectContaining({ id: 'explain-simply' }),
        expect.objectContaining({ id: 'show-example' }),
        expect.objectContaining({ id: 'break-it-down' }),
        expect.objectContaining({ id: 'why-it-matters' }),
      ]),
      presentation: expect.objectContaining({
        pose: 'teach',
        emphasis_target: 'Two genetically identical daughter cells',
      }),
    }));
    expect(guideData.evaluation_rules).toEqual(expect.objectContaining({
      pass_threshold: 0.5,
      partial_advances: true,
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

  it('accepts a strong mini-lecture tutor card', () => {
    const guideData = makeGuideData();
    const strongGuide = {
      ...guideData,
      knowledge_map: {
        concepts: [guideData.knowledge_map.concepts[0]],
      },
      cards: [{
        ...guideData.cards[0],
        teaching: makeStrongTeaching('mitosis'),
      }],
    };

    expect(validateTutorSessionQuality(strongGuide)).toEqual({
      ok: true,
      issues: [],
    });
  });

  it('rejects one-paragraph explanations', () => {
    const guideData = makeGuideData();
    const teaching = {
      ...makeStrongTeaching('mitosis'),
      explain: 'Mitosis makes two cells and has steps, examples, and mistakes, but this single paragraph is intentionally too compressed to be a useful tutor lesson.',
    };

    const quality = validateTutorSessionQuality({
      ...guideData,
      knowledge_map: { concepts: [guideData.knowledge_map.concepts[0]] },
      cards: [{ ...guideData.cards[0], teaching }],
    });

    expect(quality.ok).toBe(false);
    expect(quality.issues.join(' ')).toContain('explanation must be at least 3 paragraphs');
  });

  it('rejects repeated worked examples', () => {
    const guideData = makeGuideData();
    const teaching = makeStrongTeaching('mitosis');
    teaching.worked_examples = [
      teaching.worked_examples[0],
      { ...teaching.worked_examples[0], title: 'Example 2: Same example again' },
    ];

    const quality = validateTutorSessionQuality({
      ...guideData,
      knowledge_map: { concepts: [guideData.knowledge_map.concepts[0]] },
      cards: [{ ...guideData.cards[0], teaching }],
    });

    expect(quality.ok).toBe(false);
    expect(quality.issues.join(' ')).toContain('worked examples are too repetitive');
  });

  it('rejects missing examples or missing mistake corrections', () => {
    const guideData = makeGuideData();
    const teaching = {
      ...makeStrongTeaching('mitosis'),
      worked_examples: [],
      common_mistakes: ['Vague answer.', 'Wrong process.'],
    };

    const quality = validateTutorSessionQuality({
      ...guideData,
      knowledge_map: { concepts: [guideData.knowledge_map.concepts[0]] },
      cards: [{ ...guideData.cards[0], teaching }],
    });

    expect(quality.ok).toBe(false);
    expect(quality.issues.join(' ')).toContain('include at least 2 worked examples');
    expect(quality.issues.join(' ')).toContain('name the error and explain the correction');
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
