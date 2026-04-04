import { describe, expect, it } from 'vitest';

import {
  buildStudyGuideSummaryDoc,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
  studyGuideDataToPlainText,
} from '../../supabase/functions/_shared/studyGuideCore.mjs';

describe('studyGuideCore', () => {
  it('normalizes active-recall guide data and derives default study state', () => {
    const guideData = normalizeStudyGuideData({
      overview: 'Review before revealing answers.',
      sections: [
        {
          title: 'ATP Yield',
          recall_prompt: 'State the ATP yield of glycolysis.',
          answer_points: ['Net gain is 2 ATP.'],
          key_terms: ['ATP'],
          mini_quiz: [{ prompt: 'Net ATP?', answer: '2 ATP' }],
          common_traps: ['Gross ATP is not the same as net ATP.'],
        },
      ],
    });

    expect(guideData).toEqual({
      version: 3,
      overview: 'Review before revealing answers.',
      topics: [
        {
          id: 'topic-general',
          title: 'Study Guide',
          summary: '',
          subtopics: [
            {
              id: 'atp-yield',
              title: 'ATP Yield',
              summary: 'Net gain is 2 ATP.',
              recall_prompt: 'State the ATP yield of glycolysis.',
              answer_points: ['Net gain is 2 ATP.'],
              key_terms: [{ term: 'ATP', definition: '' }],
              checks: [{ prompt: 'Net ATP?', answer: '2 ATP' }],
              flashcards: [],
              common_traps: ['Gross ATP is not the same as net ATP.'],
              visual: null,
              ai_helpers: { simpler: '', example: '', mnemonic: '' },
            },
          ],
        },
      ],
    });

    expect(createDefaultStudyGuideState(guideData)).toEqual({
      current_section_id: 'atp-yield',
      section_states: {
        'atp-yield': expect.objectContaining({
          revealed: false,
          confidence: null,
          completed: false,
          note: '',
        }),
      },
      last_reviewed_at: null,
    });
  });

  it('builds summary docs and plain text exports from guide data', () => {
    const guideData = {
      overview: 'Master the core ATP facts.',
      sections: [
        {
          id: 'atp-yield',
          title: 'ATP Yield',
          recall_prompt: 'State the ATP yield of glycolysis.',
          answer_points: ['Net gain is 2 ATP.'],
          key_terms: ['ATP', 'glycolysis'],
          mini_quiz: [{ prompt: 'Net ATP?', answer: '2 ATP' }],
          common_traps: ['Gross ATP is not net ATP.'],
        },
      ],
    };

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
    expect(plainText).toContain('Overview:');
    expect(plainText).toContain('Topic 1: Study Guide');
    expect(plainText).toContain('Subtopic 1: ATP Yield');
    expect(plainText).toContain('Net gain is 2 ATP.');
    expect(plainText).toContain('Gross ATP is not net ATP.');
  });

  it('normalizes v3 topics and subtopics with adaptive helper fields', () => {
    const guideData = normalizeStudyGuideData({
      overview: 'Focus on membrane transport first.',
      topics: [
        {
          id: 'cells',
          title: 'Cells',
          subtopics: [
            {
              id: 'membrane',
              title: 'Cell Membrane',
              summary: 'Controls what enters and leaves the cell.',
              recall_prompt: 'Explain how the membrane maintains homeostasis.',
              answer_points: ['Selective permeability regulates transport.'],
              key_terms: [{ term: 'osmosis', definition: 'Movement of water across a membrane.' }],
              checks: [{ prompt: 'What moves in osmosis?', answer: 'Water' }],
              flashcards: [{ front: 'Diffusion', back: 'Movement from high to low concentration' }],
              common_traps: ['Do not confuse osmosis with active transport.'],
              visual: { type: 'sequence', title: 'Membrane logic', steps: ['High concentration', 'Membrane', 'Low concentration'] },
              ai_helpers: {
                simpler: 'The membrane works like a filter.',
                example: 'Water moving into a plant cell.',
                mnemonic: 'Membrane manages movement.',
              },
            },
          ],
        },
      ],
    });

    expect(guideData).toEqual(expect.objectContaining({
      overview: 'Focus on membrane transport first.',
      topics: [
        expect.objectContaining({
          id: 'cells',
          title: 'Cells',
          subtopics: [
            expect.objectContaining({
              id: 'membrane',
              title: 'Cell Membrane',
              summary: 'Controls what enters and leaves the cell.',
              checks: [{ prompt: 'What moves in osmosis?', answer: 'Water' }],
              flashcards: [{ front: 'Diffusion', back: 'Movement from high to low concentration' }],
              ai_helpers: expect.objectContaining({
                simpler: 'The membrane works like a filter.',
              }),
            }),
          ],
        }),
      ],
    }));

    expect(createDefaultStudyGuideState(guideData)).toEqual(expect.objectContaining({
      current_section_id: 'membrane',
      section_states: expect.objectContaining({
        membrane: expect.objectContaining({
          revealed: false,
          confidence: null,
          completed: false,
          note: '',
        }),
      }),
    }));

    expect(studyGuideDataToPlainText(guideData)).toContain('Topic 1: Cells');
    expect(studyGuideDataToPlainText(guideData)).toContain('Subtopic 1: Cell Membrane');
    expect(studyGuideDataToPlainText(guideData)).toContain('Diffusion');
  });
});
