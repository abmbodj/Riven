import { describe, expect, it } from 'vitest';

import {
  buildCoverageMap,
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

const makeStrongMathTeaching = () => ({
  learning_objective: 'Solve factorable quadratic equations by choosing factoring, isolating each zero factor, and checking the roots.',
  explain: [
    'A factorable quadratic is a problem where the expression can be rewritten as a product of two simpler linear factors. The goal is not to stare at $x^2 + 5x + 6 = 0$ and guess randomly. The goal is to ask which two numbers multiply to $6$ and add to $5$, because those two numbers become the constants inside the factors.',
    'Once the expression becomes $(x + 2)(x + 3) = 0$, the zero-product property is the reason the method works. If a product equals zero, at least one factor must equal zero. That lets us split one quadratic equation into two linear equations: $x + 2 = 0$ or $x + 3 = 0$.',
    'The final skill is checking the roots back in the original equation. If $x = -2$, then $(-2)^2 + 5(-2) + 6 = 4 - 10 + 6 = 0$. If $x = -3$, then $(-3)^2 + 5(-3) + 6 = 9 - 15 + 6 = 0$. The check proves the algebra did not just look plausible; it actually satisfies the original equation.',
  ].join('\n\n'),
  intuition: 'Think of factoring like rewinding multiplication: the quadratic is the expanded answer, and the factors are the two smaller pieces that created it.',
  worked_examples: [
    {
      title: 'Example 1: Basic Solve',
      problem: 'Solve $x^2 + 5x + 6 = 0$ by factoring.',
      steps: [
        { step: '$x^2 + 5x + 6 = (x + 2)(x + 3)$', detail: 'Factor because $2 \\cdot 3 = 6$ and $2 + 3 = 5$, so the middle and constant terms match.' },
        { step: '$(x + 2)(x + 3) = 0$', detail: 'Use the zero-product property because a product can equal zero only when at least one factor is zero.' },
        { step: '$x + 2 = 0 \\Rightarrow x = -2$ and $x + 3 = 0 \\Rightarrow x = -3$', detail: 'Subtract from both sides to isolate $x$ in each smaller linear equation.' },
      ],
      result: 'The solutions are $x = -2$ and $x = -3$.',
      takeaway: 'Factoring turns one quadratic into two linear equations.',
    },
    {
      title: 'Example 2: Harder Case',
      problem: 'Solve $2x^2 - 7x + 3 = 0$ by factoring.',
      steps: [
        { step: '$2x^2 - 7x + 3 = (2x - 1)(x - 3)$', detail: 'Factor by finding binomials whose first terms multiply to $2x^2$ and whose cross terms combine to $-7x$.' },
        { step: '$(2x - 1)(x - 3) = 0$', detail: 'Apply the zero-product property because each factor is a possible way for the product to become zero.' },
        { step: '$2x - 1 = 0 \\Rightarrow x = \\frac{1}{2}$ and $x - 3 = 0 \\Rightarrow x = 3$', detail: 'Isolate $x$ by undoing subtraction and division on both sides of each equation.' },
      ],
      result: 'The solutions are $x = \\frac{1}{2}$ and $x = 3$.',
      takeaway: 'When the leading coefficient is not $1$, check the cross terms before trusting the factors.',
    },
  ],
  common_mistakes: [
    'A sign error like factoring $x^2 + 5x + 6$ as $(x - 2)(x - 3)$ is wrong because it gives $x^2 - 5x + 6$, so the signs must match the middle term.',
    'Stopping at $(x + 2)(x + 3) = 0$ is incomplete because the correction is to set each factor equal to zero and solve $x + 2 = 0$ and $x + 3 = 0$.',
  ],
  example: 'A factorable quadratic like $x^2 + 5x + 6 = 0$ can be solved by factoring, splitting, solving, and checking.',
  steps: ['Factor the quadratic.', 'Set each factor equal to zero.', 'Solve and check both roots.'],
  why_it_matters: 'Factoring matters because it is the fastest clean method when a quadratic has simple integer factors.',
});

const makeMathGuideData = (teaching = makeStrongMathTeaching()) => {
  const guideData = makeGuideData();
  return {
    ...guideData,
    session_meta: {
      ...guideData.session_meta,
      subject: 'Mathematics',
      student_goal: 'Solve quadratic equations by factoring',
    },
    knowledge_map: {
      concepts: [{
        id: 'concept-factoring-quadratics',
        title: 'Factoring Quadratics',
        summary: 'Factorable quadratics can be solved by the zero-product property.',
        depends_on: [],
        weak_points: ['sign-errors', 'zero-product-property'],
        misconception_tags: ['wrong-signs'],
      }],
    },
    cards: [{
      ...guideData.cards[0],
      id: 'card-factor-quadratics',
      concept_id: 'concept-factoring-quadratics',
      prompt: 'Solve $x^2 + 7x + 12 = 0$ by factoring.',
      target_answer: '$x = -3$ and $x = -4$.',
      required_idea_tags: ['factor', 'zero-product-property', 'both-roots'],
      misconception_tags: ['wrong-signs'],
      teaching,
    }],
  };
};

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

  it('accepts a strong math mini-lesson with LaTeX solved steps', () => {
    expect(validateTutorSessionQuality(makeMathGuideData())).toEqual({
      ok: true,
      issues: [],
    });
  });

  it('rejects math cards with prose-only examples', () => {
    const teaching = {
      ...makeStrongMathTeaching(),
      explain: makeStrongMathTeaching().explain.replace(/\$/g, ''),
      worked_examples: makeStrongMathTeaching().worked_examples.map((example) => ({
        ...example,
        problem: 'Solve a quadratic by factoring.',
        steps: example.steps.map((step) => ({
          step: step.step.replace(/\$/g, ''),
          detail: step.detail,
        })),
      })),
    };

    const quality = validateTutorSessionQuality(makeMathGuideData(teaching));

    expect(quality.ok).toBe(false);
    expect(quality.issues.join(' ')).toContain('math explanation must include the formula or setup in LaTeX');
    expect(quality.issues.join(' ')).toContain('math problem statement must include LaTeX');
  });

  it('rejects math examples without equation-bearing steps', () => {
    const teaching = {
      ...makeStrongMathTeaching(),
      worked_examples: makeStrongMathTeaching().worked_examples.map((example) => ({
        ...example,
        steps: example.steps.map((step) => ({
          ...step,
          step: '$x$ is handled by factoring.',
        })),
      })),
    };

    const quality = validateTutorSessionQuality(makeMathGuideData(teaching));

    expect(quality.ok).toBe(false);
    expect(quality.issues.join(' ')).toContain('include at least one equation-bearing LaTeX step');
  });

  it('rejects math equation steps without operation explanations', () => {
    const teaching = {
      ...makeStrongMathTeaching(),
      worked_examples: makeStrongMathTeaching().worked_examples.map((example) => ({
        ...example,
        steps: example.steps.map((step) => ({
          ...step,
          detail: 'Next line.',
        })),
      })),
    };

    const quality = validateTutorSessionQuality(makeMathGuideData(teaching));

    expect(quality.ok).toBe(false);
    expect(quality.issues.join(' ')).toContain('explain the operation, not just the next line');
  });

  it('rejects math cards missing computational mistakes', () => {
    const teaching = {
      ...makeStrongMathTeaching(),
      common_mistakes: [
        'Being careless is wrong because the correction is to be careful.',
        'Forgetting the idea is wrong because the correction is to remember it.',
      ],
    };

    const quality = validateTutorSessionQuality(makeMathGuideData(teaching));

    expect(quality.ok).toBe(false);
    expect(quality.issues.join(' ')).toContain('use an actual computational or algebraic error');
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

describe('buildCoverageMap', () => {
  it('returns zeroed totals when there are no guides', () => {
    const coverage = buildCoverageMap({ guides: [] });
    expect(coverage.totals).toMatchObject({ total: 0, mastered: 0, taught: 0, untaught: 0 });
    expect(coverage.topics).toEqual([]);
    expect(coverage.nextTopics).toEqual([]);
  });

  it('classifies topics as mastered, taught, or untaught and rolls up totals', () => {
    const guideData = makeGuideData();
    const guide = {
      id: 'guide-1',
      title: 'Cell Division',
      guide_data: guideData,
      study_state: {
        concept_mastery: {
          // Mastered concept (>=75)
          'concept-mitosis': { score: 90, attempts: 3, correct_attempts: 3, last_outcome: 'correct' },
          // Engaged but below mastery -> taught
          'concept-cytokinesis': { score: 30, attempts: 1, correct_attempts: 0, last_outcome: 'incorrect' },
        },
      },
    };

    const coverage = buildCoverageMap({ guides: [guide] });
    const byTitle = Object.fromEntries(coverage.topics.map((topic) => [topic.title, topic.status]));

    expect(byTitle.Mitosis).toBe('mastered');
    expect(byTitle.Cytokinesis).toBe('taught');
    expect(coverage.totals.total).toBe(coverage.topics.length);
    expect(coverage.totals.mastered).toBeGreaterThanOrEqual(1);
    // "what's next" excludes mastered topics
    expect(coverage.nextTopics).not.toContain('Mitosis');
  });

  it('merges the same-named topic across guides keeping the strongest mastery', () => {
    const weak = {
      id: 'g-weak',
      title: 'Attempt A',
      guide_data: makeGuideData(),
      study_state: { concept_mastery: { 'concept-mitosis': { score: 20, attempts: 1 } } },
    };
    const strong = {
      id: 'g-strong',
      title: 'Attempt B',
      guide_data: makeGuideData(),
      study_state: { concept_mastery: { 'concept-mitosis': { score: 95, attempts: 2 } } },
    };

    const coverage = buildCoverageMap({ guides: [weak, strong] });
    const mitosis = coverage.topics.find((topic) => topic.title === 'Mitosis');
    expect(mitosis.status).toBe('mastered');
    expect(mitosis.masteryScore).toBe(95);
  });
});
