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
      overview: 'Review before revealing answers.',
      sections: [
        {
          id: 'atp-yield',
          title: 'ATP Yield',
          recall_prompt: 'State the ATP yield of glycolysis.',
          answer_points: ['Net gain is 2 ATP.'],
          key_terms: ['ATP'],
          mini_quiz: [{ prompt: 'Net ATP?', answer: '2 ATP' }],
          common_traps: ['Gross ATP is not the same as net ATP.'],
        },
      ],
    });

    expect(createDefaultStudyGuideState(guideData)).toEqual({
      current_section_id: 'atp-yield',
      section_states: {
        'atp-yield': {
          revealed: false,
          confidence: null,
          completed: false,
          note: '',
        },
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
    expect(plainText).toContain('Section 1: ATP Yield');
    expect(plainText).toContain('Net gain is 2 ATP.');
    expect(plainText).toContain('Gross ATP is not net ATP.');
  });
});
