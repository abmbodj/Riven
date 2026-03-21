import { describe, expect, it } from 'vitest';

import { persistGeneratedStudyGuide } from '../../supabase/functions/_shared/studyGuidePersistence.mjs';

const buildPayload = () => ({
  userId: 9,
  title: 'Bio Recall Workbook',
  formatVersion: 2,
  guideData: {
    overview: 'Review the core material.',
    sections: [{ id: 'cell', title: 'Cell Theory' }],
  },
  studyState: {
    current_section_id: 'cell',
    section_states: {
      cell: { revealed: false, confidence: null, completed: false, note: '' },
    },
    last_reviewed_at: null,
  },
  content: {
    type: 'doc',
    content: [],
  },
  noteId: 'note-1',
  classId: 'class-1',
});

const createAdminMock = ({ existingGuide = { id: 'guide-1' }, insertId = 'guide-55', updateId = 'guide-1' } = {}) => {
  const calls = {
    insert: [],
    update: [],
  };

  const from = () => ({
    select() {
      return this;
    },
    insert(payload) {
      calls.insert.push(payload);
      return {
        select() {
          return {
            single: async () => ({ data: { id: insertId }, error: null }),
          };
        },
      };
    },
    update(payload) {
      calls.update.push(payload);
      return {
        eq() {
          return this;
        },
        select() {
          return {
            single: async () => ({ data: { id: updateId }, error: null }),
          };
        },
      };
    },
    eq() {
      return this;
    },
    maybeSingle: async () => ({ data: existingGuide, error: null }),
  });

  return {
    admin: { from },
    calls,
  };
};

describe('studyGuidePersistence', () => {
  it('inserts a new workbook guide when no replacement id is provided', async () => {
    const { admin, calls } = createAdminMock();

    const result = await persistGeneratedStudyGuide({
      admin,
      ...buildPayload(),
    });

    expect(result).toEqual({ id: 'guide-55' });
    expect(calls.insert).toEqual([{
      user_id: 9,
      title: 'Bio Recall Workbook',
      format_version: 2,
      guide_data: {
        overview: 'Review the core material.',
        sections: [{ id: 'cell', title: 'Cell Theory' }],
      },
      study_state: {
        current_section_id: 'cell',
        section_states: {
          cell: { revealed: false, confidence: null, completed: false, note: '' },
        },
        last_reviewed_at: null,
      },
      content: {
        type: 'doc',
        content: [],
      },
      note_id: 'note-1',
      class_id: 'class-1',
    }]);
    expect(calls.update).toEqual([]);
  });

  it('replaces an existing owned guide in place when a replacement id is provided', async () => {
    const { admin, calls } = createAdminMock({ updateId: 'guide-9' });

    const result = await persistGeneratedStudyGuide({
      admin,
      ...buildPayload(),
      replaceGuideId: 'guide-9',
    });

    expect(result).toEqual({ id: 'guide-9' });
    expect(calls.insert).toEqual([]);
    expect(calls.update).toEqual([{
      title: 'Bio Recall Workbook',
      format_version: 2,
      guide_data: {
        overview: 'Review the core material.',
        sections: [{ id: 'cell', title: 'Cell Theory' }],
      },
      study_state: {
        current_section_id: 'cell',
        section_states: {
          cell: { revealed: false, confidence: null, completed: false, note: '' },
        },
        last_reviewed_at: null,
      },
      content: {
        type: 'doc',
        content: [],
      },
      note_id: 'note-1',
      class_id: 'class-1',
    }]);
  });
});
