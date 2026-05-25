import { describe, expect, it } from 'vitest';

import {
  buildNaturalNoteStyleInstructions,
  buildYoutubeNotesContents,
  consumeAiQuota,
  generateClassPreview,
  generateDeckFromAi,
  generateExamFromAi,
  generateStudyGuideFromAi,
  getAiLimitStatus,
} from '../../supabase/functions/_shared/aiCore.mjs';

const makeStrongTeaching = (topic) => ({
  learning_objective: `Explain ${topic} with its mechanism, outcome, examples, and common exam traps.`,
  explain: [
    `${topic} is easiest to learn when the student separates the name of the process from the job it performs. The first layer is the definition: identify where the process happens, what enters the process, and what must be true when the process is finished. That gives the learner a stable frame before any memorized details are added.`,
    `The second layer is mechanism. A strong answer should trace the sequence of events instead of listing disconnected terms. When the learner can say what changes first, what that change allows next, and what result is produced, the concept becomes usable in new questions rather than only recognizable in old notes.`,
    `The final layer is exam reasoning. Most wrong answers come from mixing similar processes or reporting a gross value when the question asks for a net value. The student should practice naming the exact output, explaining why distractors are wrong, and connecting the output to the bigger system so the answer stays clear under time pressure.`,
  ].join('\n\n'),
  intuition: `Think of ${topic} like a checkpoint route: each checkpoint only matters because it changes what the next checkpoint is allowed to do, and the final checkpoint tells you whether the whole route succeeded.`,
  worked_examples: [
    {
      title: `Example 1: Basic ${topic} recall`,
      problem: `A quiz asks for the location and final outcome of ${topic}.`,
      steps: [
        { step: 'Name the location first.', detail: 'Starting with location prevents the answer from drifting into a related process that happens somewhere else.' },
        { step: 'State the final outcome in net terms.', detail: 'The final outcome is what the grader is usually checking, so gross intermediate values must be filtered out.' },
      ],
      result: `${topic} is answered by pairing the correct location with the correct net outcome.`,
      takeaway: 'A complete answer names both where it happens and what it produces.',
    },
    {
      title: `Example 2: Distractor check for ${topic}`,
      problem: `A harder question gives two similar processes and asks which one matches ${topic}.`,
      steps: [
        { step: 'Compare the required output to each option.', detail: 'The output is the strongest clue because similar processes often share vocabulary but produce different results.' },
        { step: 'Reject the option with the wrong scale or timing.', detail: 'Distractors often sound familiar, so the safest move is to test whether the timing and final product match the prompt.' },
      ],
      result: `The correct option is the one whose mechanism and final output both match ${topic}.`,
      takeaway: 'Hard questions are solved by testing mechanism and outcome together.',
    },
  ],
  common_mistakes: [
    `Only memorizing a keyword is wrong because ${topic} questions often ask for the mechanism behind the keyword instead.`,
    `Giving an intermediate value instead of the final answer is wrong because the correction depends on whether the prompt asks for gross or net outcome.`,
  ],
  example: `${topic} can be checked by asking what changes, where it changes, and what final output remains.`,
  steps: ['Name the location.', 'Trace the mechanism.', 'State the final outcome.'],
  why_it_matters: `${topic} matters because it supports later questions that combine definitions, mechanisms, and distractor elimination.`,
});

describe('aiCore', () => {
  it('builds shared note-style instructions for natural notes without exam-question filler', () => {
    const instructions = buildNaturalNoteStyleInstructions({ includeKeyConcepts: true });

    expect(instructions).toContain('college student');
    expect(instructions).toContain('Key Concepts');
    expect(instructions).not.toContain('Potential Exam Questions');
    expect(instructions).not.toContain('takeaway');
  });

  it('builds YouTube notes prompts with the shared natural note voice', () => {
    const contents = buildYoutubeNotesContents('ATP lecture transcript', 'Biology 101', 'Biology');
    const promptText = contents[0]?.text ?? '';

    expect(promptText).toContain('college student');
    expect(promptText).toContain('Key Concepts');
    expect(promptText).not.toContain('Potential Exam Questions');
    expect(promptText).not.toContain('takeaway');
  });

  it('resets stale AI quota counters before reporting limits', () => {
    const result = getAiLimitStatus({
      user: {
        subscription_tier: 'free',
        ai_generations_count: 9,
        last_ai_generation_reset: '2026-02-14T08:00:00.000Z',
        role: 'user',
        simulate_free_tier: false,
      },
      now: new Date('2026-03-14T10:30:00.000Z'),
    });

    expect(result).toMatchObject({
      remaining: 10,
      max: 10,
      characterLimit: 15000,
      flashcardRange: [5, 15],
      canWatchAd: false,
      count: 0,
    });
  });

  it('increments from one after stale quota resets', async () => {
    const updates = [];

    const result = await consumeAiQuota({
      user: {
        subscription_tier: 'free',
        ai_generations_count: 7,
        last_ai_generation_reset: '2026-02-14T07:00:00.000Z',
        role: 'user',
        simulate_free_tier: false,
      },
      now: new Date('2026-03-14T10:00:00.000Z'),
      persistUsage: async ({ count, lastReset }) => {
        updates.push({ count, lastReset: lastReset.toISOString() });
      },
    });

    expect(result).toEqual({
      isPremium: false,
      characterLimit: 15000,
      flashcardRange: [5, 15],
    });
    expect(updates).toEqual([{
      count: 1,
      lastReset: '2026-03-14T10:00:00.000Z',
    }]);
  });

  it('generates a deck from parsed text uploads and strips fenced AI JSON', async () => {
    const createdDecks = [];
    const insertedCards = [];

    const result = await generateDeckFromAi({
      notes: 'Lecture outline',
      file: {
        data: Buffer.from('cell respiration').toString('base64'),
        mimeType: 'text/plain',
      },
      deckName: 'Biology',
      classId: 'class-1',
      aiLimitsContext: { characterLimit: 15000, flashcardRange: [5, 15] },
      apiKey: 'gemini-key',
      parseDocx: async () => '',
      generateContent: async ({ model, contents }) => {
        expect(model).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
        expect(contents).toEqual(expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining('Lecture Notes/Text Content:') }),
        ]));

        return '```json\n[{"front":"What is ATP?","back":"Cell energy"}]\n```';
      },
      createDeck: async ({ userId, title, description, classId }) => {
        createdDecks.push({ userId, title, description, classId });
        return { id: 44 };
      },
      insertCards: async (deckId, cards) => {
        insertedCards.push({ deckId, cards });
      },
      deleteDeck: async () => {},
      userId: 9,
    });

    expect(result).toEqual({
      message: 'Deck generated successfully',
      deck_id: 44,
      card_count: 1,
    });
    expect(createdDecks).toEqual([{
      userId: 9,
      title: 'Biology',
      description: 'Auto-generated via AI',
      classId: 'class-1',
    }]);
    expect(insertedCards).toEqual([{
      deckId: 44,
      cards: [
        { front: 'What is ATP?', back: 'Cell energy', position: 0 },
      ],
    }]);
  });

  it('generates class previews from fenced AI JSON responses', async () => {
    const result = await generateClassPreview({
      notes: '',
      file: {
        data: Buffer.from('Course overview').toString('base64'),
        mimeType: 'text/plain',
      },
      apiKey: 'gemini-key',
      parseDocx: async () => '',
      generateContent: async () => '```json\n{"name":"Physics 201","professor":"Dr. Ray","room":"Hall 3","times":[],"assignments":[]}\n```',
    });

    expect(result).toEqual({
      classData: {
        name: 'Physics 201',
        professor: 'Dr. Ray',
        room: 'Hall 3',
        times: [],
        assignments: [],
      },
    });
  });

  it('generates a mock exam from an array response', async () => {
    const createdExams = [];

    const result = await generateExamFromAi({
      userId: 9,
      notes: 'ATP stores energy for cells.',
      file: null,
      title: 'Biology Quiz',
      sourceType: 'notes',
      sourceId: 'note-1',
      classId: 'class-1',
      className: 'Biology 101',
      aiLimitsContext: { characterLimit: 15000 },
      apiKey: 'groq-key',
      parseDocx: async () => '',
      generateContent: async ({ model, contents }) => {
        expect(model).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
        expect(contents).toEqual(expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining('Output ONLY a valid JSON array.') }),
          expect.objectContaining({ text: expect.stringContaining('Source Material:') }),
        ]));

        return JSON.stringify([
          {
            type: 'mcq',
            question: 'What molecule stores usable energy for the cell?',
            topic: 'ATP',
            difficulty: 'easy',
            options: ['ATP', 'DNA', 'Water', 'Oxygen'],
            correct_answer: 'ATP',
            explanation: 'ATP is the primary energy currency of the cell.',
          },
        ]);
      },
      createExam: async (payload) => {
        createdExams.push(payload);
        return { id: 'exam-77' };
      },
      deleteExam: async () => {},
      onParseError: () => {},
    });

    expect(result).toEqual({
      message: 'Mock exam generated successfully',
      exam_id: 'exam-77',
      question_count: 1,
    });
    expect(createdExams).toEqual([expect.objectContaining({
      userId: 9,
      title: 'Biology Quiz',
      sourceType: 'notes',
      sourceId: 'note-1',
      classId: 'class-1',
      questions: [
        expect.objectContaining({
          question: 'What molecule stores usable energy for the cell?',
          correct_answer: 'ATP',
        }),
      ],
    })]);
  });

  it('generates River tutor sessions with structured v4 guide data and tutor runtime state', async () => {
    const createdGuides = [];

    const result = await generateStudyGuideFromAi({
      notes: 'Explain glycolysis and ATP yield.',
      file: null,
      title: 'Bio River Session',
      noteId: 'note-1',
      classId: 'class-1',
      className: 'Biology 101',
      aiLimitsContext: { characterLimit: 15000 },
      apiKey: 'groq-key',
      parseDocx: async () => '',
      generateContent: async ({ model, contents }) => {
        expect(model).toBe('meta-llama/llama-4-scout-17b-16e-instruct');
        expect(contents).toEqual(expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining('River-led AI tutor session') }),
        ]));

        return JSON.stringify({
          session_meta: {
            subject: 'Biology',
            student_goal: 'Understand glycolysis and ATP yield.',
            student_level: 'intermediate',
            exam_context: {
              label: 'Biology 101 assessment',
              date: '2026-05-14',
            },
            source_mode: 'source',
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
            },
            dialogue_variants: {
              opening: ['We will train this actively.'],
              encouragement: ['Stay with the structure.'],
              recovery: ['Take the smaller step first.'],
              mastery: ['That answer is stable.'],
            },
          },
          knowledge_map: {
            concepts: [
              {
                id: 'concept-glycolysis',
                title: 'Glycolysis',
                summary: 'Glycolysis happens in the cytoplasm and yields net ATP.',
                depends_on: [],
                weak_points: ['location', 'net-yield'],
                misconception_tags: ['gross-vs-net'],
              },
            ],
          },
          cards: [
            {
              id: 'card-glycolysis-1',
              concept_id: 'concept-glycolysis',
              phase: 'diagnostic',
              difficulty: 'low',
              card_type: 'short_answer',
              prompt: 'Where does glycolysis occur, and what is the net ATP gain?',
              target_answer: 'It occurs in the cytoplasm and yields net 2 ATP.',
              required_idea_tags: ['cytoplasm', 'net-2-atp'],
              optional_idea_tags: ['glucose-breakdown'],
              misconception_tags: ['gross-vs-net'],
              hints: [
                {
                  level: 1,
                  text: 'Separate the location from the ATP outcome.',
                  cue: { expression: 'ear_tilt_curious', animation: 'paw_point_hint' },
                },
              ],
              feedback: {
                correct: ['Clean answer.'],
                partial: ['You have one part. Add the missing piece.'],
                incorrect: ['Reset around location and net yield.'],
                empty: ['Start with where the process happens.'],
                misconception: [
                  {
                    misconception_id: 'gross-vs-net',
                    responses: ['Careful: gross ATP and net ATP are not the same.'],
                  },
                ],
              },
              river: {
                intro: 'Try it before I help.',
                success: 'That lands exactly where it should.',
                struggle: 'Let me narrow the frame.',
              },
              teaching: makeStrongTeaching('glycolysis'),
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
              cytoplasm: ['cytoplasm'],
              'net-2-atp': ['net 2 atp', '2 atp'],
              'glucose-breakdown': ['glucose breakdown'],
            },
            misconception_rules: [
              {
                id: 'gross-vs-net',
                concept_id: 'concept-glycolysis',
                trigger_phrases: ['4 atp gross'],
                correction: 'Careful: gross ATP and net ATP are different values.',
              },
            ],
          },
          adaptation_rules: {
            max_attempts_before_recovery: 2,
            max_hints_per_card: 2,
            performance_bands: {
              struggling: { mastery_below: 45, river_expression: 'soft_concern_mistake', river_animation: 'paw_point_hint' },
              mastery: { mastery_below: 101, river_expression: 'whisker_pride', river_animation: 'sparkle_mastery' },
            },
          },
          completion: {
            title: 'Session complete',
            mastery_message: 'You converted recall into structure.',
            confidence_close: 'One more clean retrieval will lock it in.',
            next_review_message: 'Return tomorrow for reinforcement.',
            river_cue: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
          },
        });
      },
      createGuide: async (payload) => {
        createdGuides.push(payload);
        return { id: 'guide-55' };
      },
      deleteGuide: async () => {},
      userId: 9,
    });

    expect(result).toEqual({
      message: 'Tutor session generated successfully',
      guide_id: 'guide-55',
      title: 'Bio River Session',
    });
    expect(createdGuides).toEqual([expect.objectContaining({
      userId: 9,
      title: 'Bio River Session',
      formatVersion: 4,
      noteId: 'note-1',
      classId: 'class-1',
      guideData: expect.objectContaining({
        session_meta: expect.objectContaining({
          subject: 'Biology',
          preferred_tutor_tone: 'calm review',
        }),
        river: expect.objectContaining({
          name: 'River',
        }),
        cards: [expect.objectContaining({
          id: 'card-glycolysis-1',
          concept_id: 'concept-glycolysis',
        })],
      }),
      studyState: expect.objectContaining({
        current_card_id: 'card-glycolysis-1',
        card_states: {
          'card-glycolysis-1': expect.objectContaining({
            attempts: 0,
            hints_used: 0,
            completed: false,
          }),
        },
        concept_mastery: {
          'concept-glycolysis': expect.objectContaining({
            score: 0,
            status: 'unseen',
          }),
        },
        last_reviewed_at: null,
      }),
      content: expect.objectContaining({
        type: 'doc',
        content: expect.any(Array),
      }),
    })]);
  });

  it('can generate a River tutor session from setup answers without separate source material', async () => {
    const createdGuides = [];

    const result = await generateStudyGuideFromAi({
      notes: '',
      file: null,
      title: 'Biology Midterm River Session',
      noteId: null,
      classId: null,
      className: null,
      coachConfig: {
        creationMode: 'setup',
        examLabel: 'Biology Midterm',
        examDate: '2026-05-14',
        userTopics: ['Cells', 'Mitosis'],
        weakTopics: ['Mitosis'],
        preferredTone: 'calm review',
      },
      aiLimitsContext: { characterLimit: 15000 },
      apiKey: 'groq-key',
      parseDocx: async () => '',
      generateContent: async ({ contents }) => {
        expect(contents).toEqual(expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining('Student Setup:') }),
          expect.objectContaining({ text: expect.stringContaining('Biology Midterm') }),
        ]));

        return JSON.stringify({
          session_meta: {
            subject: 'Biology',
            student_goal: 'Prepare for Biology Midterm',
            student_level: 'intermediate',
            exam_context: {
              label: 'Biology Midterm',
              date: '2026-05-14',
            },
            source_mode: 'setup',
            estimated_minutes: 14,
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
            },
            dialogue_variants: {
              opening: ['We will train the weak spots first.'],
              encouragement: ['Stay with the structure.'],
              recovery: ['We can narrow the target.'],
              mastery: ['That answer is stable.'],
            },
          },
          knowledge_map: {
            concepts: [
              {
                id: 'concept-mitosis',
                title: 'Mitosis',
                summary: 'Mitosis produces two daughter cells.',
                depends_on: [],
                weak_points: ['outcome'],
                misconception_tags: ['meiosis-mixup'],
              },
            ],
          },
          cards: [
            {
              id: 'card-mitosis-1',
              concept_id: 'concept-mitosis',
              phase: 'diagnostic',
              difficulty: 'low',
              card_type: 'short_answer',
              prompt: 'What does mitosis create?',
              target_answer: 'Two daughter cells.',
              required_idea_tags: ['two-daughter-cells'],
              optional_idea_tags: [],
              misconception_tags: ['meiosis-mixup'],
              hints: [
                { level: 1, text: 'Focus on the final number of cells.', cue: { expression: 'ear_tilt_curious', animation: 'paw_point_hint' } },
              ],
              feedback: {
                correct: ['Good.'],
                partial: ['Add the final number.'],
                incorrect: ['Reset around the outcome.'],
                empty: ['Start with the number of cells.'],
                misconception: [{ misconception_id: 'meiosis-mixup', responses: ['That describes meiosis, not mitosis.'] }],
              },
              river: {
                intro: 'Try it before I help.',
                success: 'That lands exactly where it should.',
                struggle: 'Let me narrow the frame.',
              },
              teaching: makeStrongTeaching('mitosis'),
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
            },
            misconception_rules: [
              {
                id: 'meiosis-mixup',
                concept_id: 'concept-mitosis',
                trigger_phrases: ['four cells'],
                correction: 'That describes meiosis, not mitosis.',
              },
            ],
          },
          adaptation_rules: {
            max_attempts_before_recovery: 2,
            max_hints_per_card: 2,
            performance_bands: {
              struggling: { mastery_below: 45, river_expression: 'soft_concern_mistake', river_animation: 'paw_point_hint' },
              mastery: { mastery_below: 101, river_expression: 'whisker_pride', river_animation: 'sparkle_mastery' },
            },
          },
          completion: {
            title: 'Session complete',
            mastery_message: 'You converted recall into structure.',
            confidence_close: 'One more clean retrieval will lock it in.',
            next_review_message: 'Return tomorrow for reinforcement.',
            river_cue: { expression: 'whisker_pride', animation: 'sparkle_mastery' },
          },
        });
      },
      createGuide: async (payload) => {
        createdGuides.push(payload);
        return { id: 'guide-setup-1' };
      },
      deleteGuide: async () => {},
      userId: 9,
    });

    expect(result).toEqual({
      message: 'Tutor session generated successfully',
      guide_id: 'guide-setup-1',
      title: 'Biology Midterm River Session',
    });
    expect(createdGuides).toEqual([expect.objectContaining({
      guideData: expect.objectContaining({
        session_meta: expect.objectContaining({
          exam_context: expect.objectContaining({
            label: 'Biology Midterm',
          }),
          preferred_tutor_tone: 'calm review',
        }),
      }),
    })]);
  });
});
