import { describe, expect, it } from 'vitest';

import {
  consumeAiQuota,
  generateClassPreview,
  generateDeckFromAi,
  generateStudyGuideFromAi,
  getAiLimitStatus,
} from '../../supabase/functions/_shared/aiCore.mjs';

describe('aiCore', () => {
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
        expect(model).toBe('llama-3.3-70b-versatile');
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

  it('generates active-recall guides with structured guide data and default study state', async () => {
    const createdGuides = [];

    const result = await generateStudyGuideFromAi({
      notes: 'Explain glycolysis and ATP yield.',
      file: null,
      title: 'Bio Recall Workbook',
      noteId: 'note-1',
      classId: 'class-1',
      className: 'Biology 101',
      aiLimitsContext: { characterLimit: 15000 },
      apiKey: 'groq-key',
      parseDocx: async () => '',
      generateContent: async ({ model, contents }) => {
        expect(model).toBe('llama-3.3-70b-versatile');
        expect(contents).toEqual(expect.arrayContaining([
          expect.objectContaining({ text: expect.stringContaining('active-recall study workbook') }),
        ]));

        return JSON.stringify({
          overview: 'Use each section as a recall drill.',
          sections: [
            {
              title: 'Glycolysis',
              recall_prompt: 'Walk through glycolysis from memory.',
              answer_points: ['Occurs in the cytoplasm.', 'Produces a net gain of 2 ATP.'],
              key_terms: ['glucose', 'pyruvate'],
              mini_quiz: [{ prompt: 'Net ATP?', answer: '2 ATP' }],
              common_traps: ['Do not confuse gross ATP with net ATP.'],
            },
          ],
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
      message: 'Study guide generated successfully',
      guide_id: 'guide-55',
      title: 'Bio Recall Workbook',
    });
    expect(createdGuides).toEqual([expect.objectContaining({
      userId: 9,
      title: 'Bio Recall Workbook',
      formatVersion: 2,
      noteId: 'note-1',
      classId: 'class-1',
      guideData: expect.objectContaining({
        overview: 'Use each section as a recall drill.',
        sections: [expect.objectContaining({
          id: 'glycolysis',
          title: 'Glycolysis',
        })],
      }),
      studyState: {
        current_section_id: 'glycolysis',
        section_states: {
          glycolysis: {
            revealed: false,
            confidence: null,
            completed: false,
            note: '',
          },
        },
        last_reviewed_at: null,
      },
      content: expect.objectContaining({
        type: 'doc',
        content: expect.any(Array),
      }),
    })]);
  });
});
