import { describe, expect, it } from 'vitest';
import {
    getSessionSections,
    getSectionStatus,
    getWeakSections,
    normalizeGuideStudyState,
    updateSection,
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
