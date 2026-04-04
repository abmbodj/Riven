import { describe, expect, it } from 'vitest';
import {
    getSessionSections,
    getSectionStatus,
    getWeakSections,
    normalizeGuideData,
    normalizeGuideStudyState,
    updateSection,
    getRecommendedSession,
    getSessionDelta,
    getGuideMasterySnapshot,
} from './studyGuides.js';

const makeGuideData = (overrides = []) => ({
    overview: 'Review before revealing.',
    sections: [
        {
            id: 'sec-1',
            title: 'Cell Structure',
            recall_prompt: 'Describe cell structure.',
            answer_points: ['Has a nucleus', 'Has a membrane'],
            key_terms: ['nucleus'],
            mini_quiz: [{ prompt: 'What contains DNA?', answer: 'Nucleus' }],
            common_traps: [],
        },
        {
            id: 'sec-2',
            title: 'Mitosis',
            recall_prompt: 'Explain mitosis.',
            answer_points: ['4 phases', 'Produces 2 daughter cells'],
            key_terms: ['mitosis'],
            mini_quiz: [],
            common_traps: ['Confusing mitosis with meiosis'],
        },
        {
            id: 'sec-3',
            title: 'Protein Synthesis',
            recall_prompt: 'Explain protein synthesis.',
            answer_points: ['Transcription', 'Translation'],
            key_terms: [],
            mini_quiz: [{ prompt: 'Where does translation occur?', answer: 'Ribosomes' }],
            common_traps: [],
        },
        ...overrides,
    ],
});

const makeStudyState = (sectionOverrides = {}) => ({
    current_section_id: 'sec-1',
    section_states: {
        'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-2': { revealed: true, confidence: 'need_work', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
        ...sectionOverrides,
    },
    last_reviewed_at: new Date().toISOString(),
});

describe('normalizeGuideStudyState', () => {
    it('normalizes v3 topic/subtopic guides into flat checkpoint sections', () => {
        const guideData = normalizeGuideData({
            overview: 'Core biology review.',
            topics: [
                {
                    id: 'topic-cells',
                    title: 'Cells',
                    subtopics: [
                        {
                            id: 'subtopic-membrane',
                            title: 'Cell Membrane',
                            summary: 'The membrane controls what enters and exits the cell.',
                            recall_prompt: 'Explain the role of the cell membrane.',
                            answer_points: ['It regulates transport.', 'It helps maintain homeostasis.'],
                            key_terms: [
                                { term: 'selective permeability', definition: 'Allows some substances through more easily than others.' },
                            ],
                            checks: [{ prompt: 'What property controls transport?', answer: 'Selective permeability' }],
                            flashcards: [{ front: 'Cell membrane role', back: 'Regulates transport and homeostasis' }],
                            common_traps: ['Do not confuse the membrane with the cell wall.'],
                            visual: { type: 'compare', title: 'Membrane vs wall', items: ['membrane', 'wall'] },
                            ai_helpers: {
                                simpler: 'Think of it like a smart gate.',
                                example: 'It lets oxygen pass into the cell.',
                                mnemonic: 'Membrane means manage movement.',
                            },
                        },
                    ],
                },
            ],
        });

        expect(guideData.version).toBe(3);
        expect(guideData.topics).toHaveLength(1);
        expect(guideData.sections).toHaveLength(1);
        expect(guideData.sections[0]).toEqual(expect.objectContaining({
            id: 'subtopic-membrane',
            topic_id: 'topic-cells',
            topic_title: 'Cells',
            title: 'Cell Membrane',
            summary: 'The membrane controls what enters and exits the cell.',
            recall_prompt: 'Explain the role of the cell membrane.',
            answer_points: ['It regulates transport.', 'It helps maintain homeostasis.'],
            key_terms: [
                { term: 'selective permeability', definition: 'Allows some substances through more easily than others.' },
            ],
            mini_quiz: [{ prompt: 'What property controls transport?', answer: 'Selective permeability' }],
            flashcards: [{ front: 'Cell membrane role', back: 'Regulates transport and homeostasis' }],
            ai_helpers: expect.objectContaining({
                simpler: 'Think of it like a smart gate.',
                example: 'It lets oxygen pass into the cell.',
                mnemonic: 'Membrane means manage movement.',
            }),
        }));
    });

    it('includes last_reviewed_at: null in default section state', () => {
        const state = normalizeGuideStudyState(makeGuideData(), {});
        expect(state.section_states['sec-1'].last_reviewed_at).toBe(null);
    });

    it('preserves last_reviewed_at when present', () => {
        const ts = '2026-03-01T10:00:00.000Z';
        const state = normalizeGuideStudyState(makeGuideData(), {
            section_states: { 'sec-1': { last_reviewed_at: ts } },
            last_reviewed_at: null,
        });
        expect(state.section_states['sec-1'].last_reviewed_at).toBe(ts);
    });
});

describe('getSectionStatus', () => {
    it('returns review_now for null confidence (unstudied)', () => {
        expect(getSectionStatus({ confidence: null }, null)).toBe('review_now');
    });

    it('returns review_now for need_work', () => {
        expect(getSectionStatus({ confidence: 'need_work' }, new Date().toISOString())).toBe('review_now');
    });

    it('returns coming_up for okay', () => {
        expect(getSectionStatus({ confidence: 'okay' }, new Date().toISOString())).toBe('coming_up');
    });

    it('returns good for know_it reviewed within 3 days', () => {
        expect(getSectionStatus({ confidence: 'know_it' }, new Date().toISOString())).toBe('good');
    });

    it('returns review_soon for know_it reviewed more than 3 days ago', () => {
        const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        expect(getSectionStatus({ confidence: 'know_it' }, fourDaysAgo)).toBe('review_soon');
    });

    it('returns review_soon for know_it with no last_reviewed_at', () => {
        expect(getSectionStatus({ confidence: 'know_it' }, null)).toBe('review_soon');
    });
});

describe('getWeakSections', () => {
    it('returns sections with review_now or coming_up status', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState();
        const weak = getWeakSections(guideData, studyState);
        const weakIds = weak.map((s) => s.id);
        expect(weakIds).toContain('sec-2'); // need_work
        expect(weakIds).toContain('sec-3'); // unstudied
        expect(weakIds).not.toContain('sec-1'); // know_it + recent
    });

    it('returns empty array when guideData is null', () => {
        expect(getWeakSections(null, {})).toEqual([]);
    });
});

describe('getSessionSections', () => {
    it('fills time budget with highest-priority sections first', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState();
        // 5 min: sec-2 (need_work, no quiz = 3min) + sec-3 (unstudied, has quiz = 4min) → only sec-2 fits
        const sections5 = getSessionSections(guideData, studyState, 5);
        expect(sections5.map((s) => s.id)).toEqual(['sec-2']);

        // 10 min: sec-2 (3min) + sec-3 (4min) = 7min → both fit
        const sections10 = getSessionSections(guideData, studyState, 10);
        expect(sections10.map((s) => s.id)).toContain('sec-2');
        expect(sections10.map((s) => s.id)).toContain('sec-3');
    });

    it('returns empty array for null guideData', () => {
        expect(getSessionSections(null, {}, 10)).toEqual([]);
    });
});

describe('updateSection', () => {
    it('updates a section by id', () => {
        const guideData = makeGuideData();
        const updated = updateSection(guideData, 'sec-1', { title: 'Updated Title' });
        expect(updated.sections.find((s) => s.id === 'sec-1').title).toBe('Updated Title');
    });

    it('leaves other sections unchanged', () => {
        const guideData = makeGuideData();
        const updated = updateSection(guideData, 'sec-1', { title: 'X' });
        expect(updated.sections.find((s) => s.id === 'sec-2').title).toBe('Mitosis');
    });

    it('returns guideData unchanged when id not found', () => {
        const guideData = makeGuideData();
        const updated = updateSection(guideData, 'nonexistent', { title: 'X' });
        expect(updated.sections).toHaveLength(3);
    });
});

// --- getRecommendedSession ---

describe('getRecommendedSession', () => {
    it('returns type "weak" when weak sections exist', () => {
        const guideData = makeGuideData();
        // sec-2 has need_work → weak
        const studyState = makeStudyState();
        const result = getRecommendedSession(guideData, studyState);
        expect(result.type).toBe('weak');
        expect(result.sections.length).toBeGreaterThan(0);
    });

    it('returns type "continue" when no weak sections but guide incomplete', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState({
            'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-2': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-3': { revealed: true, confidence: 'know_it', completed: false, note: '', last_reviewed_at: new Date().toISOString() },
        });
        const result = getRecommendedSession(guideData, studyState);
        expect(result.type).toBe('continue');
        expect(result.sections.length).toBeGreaterThan(0);
    });

    it('returns type "full" when guide is 100% complete', () => {
        const guideData = makeGuideData();
        const studyState = makeStudyState({
            'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-2': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-3': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
        });
        const result = getRecommendedSession(guideData, studyState);
        expect(result.type).toBe('full');
    });
});

// --- getSessionDelta ---

describe('getSessionDelta', () => {
    it('returns mastery delta and weak count delta between two states', () => {
        const guideData = makeGuideData();
        const stateBefore = makeStudyState({
            'sec-1': { revealed: true, confidence: 'need_work', completed: false, note: '', last_reviewed_at: null },
            'sec-2': { revealed: true, confidence: 'need_work', completed: false, note: '', last_reviewed_at: null },
            'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
        });
        const stateAfter = makeStudyState({
            'sec-1': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-2': { revealed: true, confidence: 'know_it', completed: true, note: '', last_reviewed_at: new Date().toISOString() },
            'sec-3': { revealed: false, confidence: null, completed: false, note: '', last_reviewed_at: null },
        });
        const delta = getSessionDelta(guideData, stateBefore, stateAfter);
        expect(delta.masteryDeltaPercent).toBeGreaterThan(0);
        expect(delta.weakCountAfter).toBeLessThan(delta.weakCountBefore);
        expect(delta.sectionsReviewed).toBe(2);
    });

    it('returns zeroes when nothing changed', () => {
        const guideData = makeGuideData();
        const state = makeStudyState();
        const delta = getSessionDelta(guideData, state, state);
        expect(delta.masteryDeltaPercent).toBe(0);
        expect(delta.sectionsReviewed).toBe(0);
    });
});

describe('getGuideMasterySnapshot', () => {
    it('scores weak exam-linked topics ahead of generic incomplete coverage', () => {
        const guideData = normalizeGuideData({
            overview: 'History review.',
            topics: [
                {
                    id: 'topic-war',
                    title: 'World War I',
                    subtopics: [
                        {
                            id: 'alliances',
                            title: 'Alliance System',
                            summary: 'The alliance system made escalation more likely.',
                            recall_prompt: 'Explain how alliances escalated the war.',
                            answer_points: ['They pulled more nations into the conflict.'],
                            key_terms: [],
                            checks: [],
                            flashcards: [],
                            common_traps: [],
                        },
                        {
                            id: 'treaty',
                            title: 'Treaty of Versailles',
                            summary: 'The treaty reshaped Europe after the war.',
                            recall_prompt: 'What changed after the treaty?',
                            answer_points: ['It imposed reparations on Germany.'],
                            key_terms: [],
                            checks: [],
                            flashcards: [],
                            common_traps: [],
                        },
                    ],
                },
            ],
        });

        const snapshot = getGuideMasterySnapshot(
            guideData,
            {
                current_section_id: 'alliances',
                section_states: {
                    alliances: {
                        revealed: true,
                        confidence: 'need_work',
                        completed: true,
                        note: '',
                        last_reviewed_at: '2026-04-01T10:00:00.000Z',
                        quiz_correct: 0,
                        quiz_total: 2,
                    },
                    treaty: {
                        revealed: false,
                        confidence: null,
                        completed: false,
                        note: '',
                        last_reviewed_at: null,
                        quiz_correct: 0,
                        quiz_total: 0,
                    },
                },
                last_reviewed_at: '2026-04-01T10:00:00.000Z',
            },
            {
                linkedExamAt: '2026-04-05T12:00:00.000Z',
                now: '2026-04-04T12:00:00.000Z',
            },
        );

        expect(snapshot.masteryBands.support.map((item) => item.id)).toContain('alliances');
        expect(snapshot.recommendedSections[0].id).toBe('alliances');
        expect(snapshot.recommendedSections[0].priorityReason).toContain('exam');
        expect(snapshot.weakCount).toBeGreaterThan(0);
    });
});
