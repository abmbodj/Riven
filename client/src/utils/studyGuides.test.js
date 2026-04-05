import { describe, expect, it } from 'vitest';
import {
    evaluateTutorCardResponse,
    getGuideMasterySnapshot,
    getSessionDelta,
    isActiveRecallGuide,
    normalizeGuideData,
    normalizeGuideStudyState,
} from './studyGuides.js';

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
                { level: 1, text: 'Think about how many cells you end with.', cue: { expression: 'ear_tilt_curious', animation: 'paw_point_hint' } },
                { level: 2, text: 'The daughter cells keep the same DNA content.', cue: { expression: 'focus_lean_in', animation: 'paw_point_hint' } },
            ],
            feedback: {
                correct: ['Clean answer. You kept the essential outcome intact.'],
                partial: ['You have part of it. Tighten the final outcome.'],
                incorrect: ['Not quite. Reset around the final result of the process.'],
                empty: ['Start with the number of cells produced.'],
                misconception: [
                    {
                        misconception_id: 'meiosis-mixup',
                        responses: ['You are mixing mitosis with meiosis. Mitosis does not produce four unique cells.'],
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
            id: 'card-recovery-mitosis',
            concept_id: 'concept-mitosis',
            phase: 'recovery',
            difficulty: 'support',
            card_type: 'short_answer',
            prompt: 'Fill the frame: mitosis ends with ____ daughter cells that are ____.',
            target_answer: 'Two daughter cells that are genetically identical.',
            required_idea_tags: ['two-daughter-cells', 'identical-genetic-material'],
            optional_idea_tags: [],
            misconception_tags: [],
            hints: [
                { level: 1, text: 'One number, one relationship.', cue: { expression: 'soft_concern_mistake', animation: 'paw_point_hint' } },
            ],
            feedback: {
                correct: ['Good. That is the exact frame to keep in memory.'],
                partial: ['You are close. Lock both blanks precisely.'],
                incorrect: ['Strip it back to the two blanks.'],
                empty: ['Start with the number.'],
                misconception: [],
            },
            river: {
                intro: 'Smaller target. Same idea.',
                success: 'Better. Now take that back to the main card.',
                struggle: 'Use the hint and rebuild it carefully.',
            },
            transitions: {
                on_correct: 'card-apply-cytokinesis',
                on_partial: 'retry',
                on_incorrect: 'hint',
                on_struggle: 'retry',
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
            optional_idea_tags: ['cell-separation'],
            misconception_tags: [],
            hints: [
                { level: 1, text: 'Mitosis handles the nucleus. What is left to divide?', cue: { expression: 'focus_lean_in', animation: 'paw_point_hint' } },
            ],
            feedback: {
                correct: ['Exactly. You separated the nucleus stage from the cell split.'],
                partial: ['One part is there. Add what gets split or when it happens.'],
                incorrect: ['Anchor on the difference between nuclear division and cytoplasmic division.'],
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
        score_bands: {
            correct: 0.85,
            partial: 0.4,
        },
        empty_patterns: ['idk', 'i do not know', 'blank'],
        tag_synonyms: {
            'two-daughter-cells': ['two daughter cells', '2 daughter cells', 'two cells'],
            'identical-genetic-material': ['identical genetic material', 'same dna', 'genetically identical'],
            'growth-repair': ['growth', 'repair'],
            'splits-cytoplasm': ['splits the cytoplasm', 'divides the cytoplasm', 'cytoplasm splits'],
            'after-mitosis': ['after mitosis', 'at the end of mitosis', 'following mitosis'],
            'cell-separation': ['separates the cells', 'cell separation'],
        },
        misconception_rules: [
            {
                id: 'meiosis-mixup',
                concept_id: 'concept-mitosis',
                trigger_phrases: ['four cells', 'four daughter cells', 'genetically different', 'half the chromosomes'],
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

const makeStudyState = (overrides = {}) => ({
    current_card_id: 'card-diagnose-mitosis',
    session_phase: 'diagnostic',
    card_states: {
        'card-diagnose-mitosis': {
            attempts: 0,
            hints_used: 0,
            status: 'active',
            last_outcome: null,
            completed: false,
        },
        'card-recovery-mitosis': {
            attempts: 0,
            hints_used: 0,
            status: 'unseen',
            last_outcome: null,
            completed: false,
        },
        'card-apply-cytokinesis': {
            attempts: 0,
            hints_used: 0,
            status: 'unseen',
            last_outcome: null,
            completed: false,
        },
    },
    concept_mastery: {
        'concept-mitosis': { score: 32, status: 'struggling', attempts: 1, correct_attempts: 0, last_outcome: 'incorrect' },
        'concept-cytokinesis': { score: 58, status: 'developing', attempts: 1, correct_attempts: 1, last_outcome: 'partial' },
    },
    last_interaction_at: '2026-04-05T10:00:00.000Z',
    completed_at: null,
    last_reviewed_at: '2026-04-05T10:00:00.000Z',
    ...overrides,
});

describe('normalizeGuideData', () => {
    it('normalizes the River tutor-session v4 contract', () => {
        const guideData = normalizeGuideData(makeGuideData());

        expect(guideData.version).toBe(4);
        expect(guideData.session_meta.subject).toBe('Biology');
        expect(guideData.river.name).toBe('River');
        expect(guideData.cards).toHaveLength(3);
        expect(guideData.sections.map((section) => section.id)).toEqual(['concept-mitosis', 'concept-cytokinesis']);
    });

    it('fails fast on old exam-coach guide data', () => {
        expect(normalizeGuideData({
            overview: 'Old guide',
            sections: [
                {
                    id: 'sec-1',
                    title: 'Old section',
                    recall_prompt: 'Old prompt',
                    answer_points: ['Old answer'],
                },
            ],
        })).toBe(null);
    });

    it('marks only v4 tutor-session guides as active', () => {
        expect(isActiveRecallGuide({
            format_version: 4,
            guide_data: makeGuideData(),
        })).toBe(true);

        expect(isActiveRecallGuide({
            format_version: 3,
            guide_data: makeGuideData(),
        })).toBe(false);
    });
});

describe('normalizeGuideStudyState', () => {
    it('creates tutor runtime defaults for every card and concept', () => {
        const state = normalizeGuideStudyState(makeGuideData(), {});

        expect(state.current_card_id).toBe('card-diagnose-mitosis');
        expect(state.session_phase).toBe('diagnostic');
        expect(state.card_states['card-diagnose-mitosis']).toEqual(expect.objectContaining({
            attempts: 0,
            hints_used: 0,
            status: 'unseen',
            completed: false,
        }));
        expect(state.concept_mastery['concept-mitosis']).toEqual(expect.objectContaining({
            score: 0,
            status: 'unseen',
            attempts: 0,
        }));
    });
});

describe('evaluateTutorCardResponse', () => {
    const guideData = normalizeGuideData(makeGuideData());
    const card = guideData.cards[0];

    it('detects correct answers using tag synonyms', () => {
        const result = evaluateTutorCardResponse(guideData, card, 'Mitosis makes two cells with the same DNA.');
        expect(result.outcome).toBe('correct');
        expect(result.matchedTags).toEqual(expect.arrayContaining(['two-daughter-cells', 'identical-genetic-material']));
        expect(result.feedback).toBeTruthy();
    });

    it('returns partial when only some required ideas are present', () => {
        const result = evaluateTutorCardResponse(guideData, card, 'It makes two daughter cells.');
        expect(result.outcome).toBe('partial');
        expect(result.missingTags).toContain('identical-genetic-material');
    });

    it('routes misconception-shaped answers separately', () => {
        const result = evaluateTutorCardResponse(guideData, card, 'It makes four daughter cells with half the chromosomes.');
        expect(result.outcome).toBe('misconception');
        expect(result.misconceptionId).toBe('meiosis-mixup');
    });

    it('treats blank-style answers as empty', () => {
        const result = evaluateTutorCardResponse(guideData, card, 'idk');
        expect(result.outcome).toBe('empty');
    });
});

describe('mastery helpers', () => {
    it('prioritizes struggling concepts in the mastery snapshot', () => {
        const snapshot = getGuideMasterySnapshot(makeGuideData(), makeStudyState(), {
            now: '2026-04-05T12:00:00.000Z',
        });

        expect(snapshot.averageMastery).toBeGreaterThanOrEqual(0);
        expect(snapshot.recommendedSections[0].id).toBe('concept-mitosis');
        expect(snapshot.masteryBands.struggling.map((item) => item.id)).toContain('concept-mitosis');
    });

    it('reports mastery improvement and reviewed concept count between sessions', () => {
        const before = makeStudyState({
            concept_mastery: {
                'concept-mitosis': { score: 22, status: 'struggling', attempts: 1, correct_attempts: 0, last_outcome: 'incorrect' },
                'concept-cytokinesis': { score: 40, status: 'developing', attempts: 1, correct_attempts: 0, last_outcome: 'partial' },
            },
            card_states: {
                'card-diagnose-mitosis': { attempts: 1, hints_used: 1, status: 'needs_review', last_outcome: 'incorrect', completed: false },
                'card-recovery-mitosis': { attempts: 0, hints_used: 0, status: 'unseen', last_outcome: null, completed: false },
                'card-apply-cytokinesis': { attempts: 1, hints_used: 0, status: 'active', last_outcome: 'partial', completed: false },
            },
        });
        const after = makeStudyState({
            concept_mastery: {
                'concept-mitosis': { score: 84, status: 'mastered', attempts: 3, correct_attempts: 2, last_outcome: 'correct' },
                'concept-cytokinesis': { score: 78, status: 'secure', attempts: 2, correct_attempts: 1, last_outcome: 'correct' },
            },
            card_states: {
                'card-diagnose-mitosis': { attempts: 2, hints_used: 1, status: 'mastered', last_outcome: 'correct', completed: true },
                'card-recovery-mitosis': { attempts: 1, hints_used: 0, status: 'mastered', last_outcome: 'correct', completed: true },
                'card-apply-cytokinesis': { attempts: 2, hints_used: 0, status: 'mastered', last_outcome: 'correct', completed: true },
            },
            completed_at: '2026-04-05T12:00:00.000Z',
        });

        const delta = getSessionDelta(makeGuideData(), before, after);

        expect(delta.masteryDeltaPercent).toBeGreaterThan(0);
        expect(delta.reviewedSections).toBe(2);
        expect(delta.weakCountAfter).toBeLessThan(delta.weakCountBefore);
    });
});
