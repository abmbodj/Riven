import { describe, it, expect } from 'vitest';

import {
  acceptSharedDeckCore,
  acceptSharedResourceCore,
} from '../../supabase/functions/_shared/acceptSharedDeckCore.mjs';

describe('acceptSharedResourceCore', () => {
  it('clones a shared deck, cards, and tags and marks the message accepted', async () => {
    const createdDecks = [];
    const insertedCards = [];
    const insertedTags = [];
    const updatedMessages = [];

    const result = await acceptSharedDeckCore({
      messageId: 18,
      receiverId: 42,
      loadMessageForReceiver: async () => ({
        id: 18,
        receiver_id: 42,
        message_type: 'deck',
        deck_data: JSON.stringify({ id: 7, title: 'Biology' }),
      }),
      loadDeck: async () => ({
        id: 7,
        title: 'Biology',
        description: 'Lab prep',
      }),
      loadDeckCards: async () => ([
        { front: 'Q1', back: 'A1', front_image: null, back_image: null, position: 0 },
        { front: 'Q2', back: 'A2', front_image: '/front.png', back_image: null, position: 1 },
      ]),
      loadDeckTags: async () => ([3, 5]),
      createDeck: async (userId, deck) => {
        createdDecks.push({ userId, deck });
        return { id: 99, user_id: userId, title: deck.title, description: deck.description };
      },
      insertDeckCards: async (deckId, cards) => {
        insertedCards.push({ deckId, cards });
      },
      insertDeckTags: async (deckId, tagIds) => {
        insertedTags.push({ deckId, tagIds });
      },
      loadNote: async () => null,
      createNote: async () => null,
      loadGuide: async () => null,
      createGuide: async () => null,
      updateMessageSharedData: async (messageId, sharedData) => {
        updatedMessages.push({ messageId, sharedData });
      },
    });

    expect(result).toEqual({
      kind: 'deck',
      resource: { id: 99, user_id: 42, title: 'Biology', description: 'Lab prep' },
      newDeck: { id: 99, user_id: 42, title: 'Biology', description: 'Lab prep' },
      messageId: 18,
    });
    expect(createdDecks).toEqual([{ userId: 42, deck: { id: 7, title: 'Biology', description: 'Lab prep' } }]);
    expect(insertedCards).toEqual([{ deckId: 99, cards: [
      { front: 'Q1', back: 'A1', front_image: null, back_image: null, position: 0 },
      { front: 'Q2', back: 'A2', front_image: '/front.png', back_image: null, position: 1 },
    ] }]);
    expect(insertedTags).toEqual([{ deckId: 99, tagIds: [3, 5] }]);
    expect(updatedMessages).toEqual([{ messageId: 18, sharedData: {
      kind: 'deck',
      sourceId: 7,
      id: 7,
      title: 'Biology',
      cardCount: 2,
      acceptedId: 99,
      acceptedDeckId: 99,
    } }]);
  });

  it('clones a shared note into a private imported note', async () => {
    const updatedMessages = [];

    const result = await acceptSharedResourceCore({
      messageId: 19,
      receiverId: 42,
      loadMessageForReceiver: async () => ({
        id: 19,
        receiver_id: 42,
        message_type: 'note',
        deck_data: JSON.stringify({
          kind: 'note',
          sourceId: 'note-7',
          title: 'Lecture Notes',
          previewText: 'Electron transport chain',
        }),
      }),
      loadDeck: async () => null,
      loadDeckCards: async () => [],
      loadDeckTags: async () => [],
      createDeck: async () => null,
      insertDeckCards: async () => {},
      insertDeckTags: async () => {},
      loadNote: async () => ({
        id: 'note-7',
        title: 'Lecture Notes',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        enhanced_content: { type: 'doc', content: [{ type: 'heading' }] },
      }),
      createNote: async (userId, note) => ({
        id: 'note-copy',
        user_id: userId,
        ...note,
      }),
      loadGuide: async () => null,
      createGuide: async () => null,
      updateMessageSharedData: async (messageId, sharedData) => {
        updatedMessages.push({ messageId, sharedData });
      },
    });

    expect(result).toEqual({
      kind: 'note',
      resource: {
        id: 'note-copy',
        user_id: 42,
        title: 'Lecture Notes',
        content: { type: 'doc', content: [{ type: 'heading' }] },
        enhanced_content: null,
        class_id: null,
        audio_url: null,
        audio_duration_seconds: null,
        source_type: 'import',
      },
      newNote: {
        id: 'note-copy',
        user_id: 42,
        title: 'Lecture Notes',
        content: { type: 'doc', content: [{ type: 'heading' }] },
        enhanced_content: null,
        class_id: null,
        audio_url: null,
        audio_duration_seconds: null,
        source_type: 'import',
      },
      messageId: 19,
    });
    expect(updatedMessages).toEqual([{ messageId: 19, sharedData: {
      kind: 'note',
      sourceId: 'note-7',
      id: 'note-7',
      title: 'Lecture Notes',
      previewText: 'Electron transport chain',
      acceptedId: 'note-copy',
      acceptedNoteId: 'note-copy',
    } }]);
  });

  it('clones a shared guide into a private imported guide', async () => {
    const result = await acceptSharedResourceCore({
      messageId: 20,
      receiverId: 42,
      loadMessageForReceiver: async () => ({
        id: 20,
        receiver_id: 42,
        message_type: 'guide',
        deck_data: JSON.stringify({
          kind: 'guide',
          sourceId: 'guide-7',
          title: 'World War I Guide',
          previewText: 'Treaty overview',
        }),
      }),
      loadDeck: async () => null,
      loadDeckCards: async () => [],
      loadDeckTags: async () => [],
      createDeck: async () => null,
      insertDeckCards: async () => {},
      insertDeckTags: async () => {},
      loadNote: async () => null,
      createNote: async () => null,
      loadGuide: async () => ({
        id: 'guide-7',
        title: 'World War I Guide',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
      }),
      createGuide: async (userId, guide) => ({
        id: 'guide-copy',
        user_id: userId,
        ...guide,
      }),
      updateMessageSharedData: async () => {},
    });

    expect(result).toEqual({
      kind: 'guide',
      resource: {
        id: 'guide-copy',
        user_id: 42,
        title: 'World War I Guide',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        note_id: null,
        class_id: null,
      },
      newGuide: {
        id: 'guide-copy',
        user_id: 42,
        title: 'World War I Guide',
        content: { type: 'doc', content: [{ type: 'paragraph' }] },
        note_id: null,
        class_id: null,
      },
      messageId: 20,
    });
  });

  it('rejects already-accepted shared messages', async () => {
    await expect(acceptSharedResourceCore({
      messageId: 18,
      receiverId: 42,
      loadMessageForReceiver: async () => ({
        id: 18,
        receiver_id: 42,
        message_type: 'deck',
        deck_data: JSON.stringify({ id: 7, acceptedDeckId: 99 }),
      }),
      loadDeck: async () => null,
      loadDeckCards: async () => [],
      loadDeckTags: async () => [],
      createDeck: async () => null,
      insertDeckCards: async () => {},
      insertDeckTags: async () => {},
      loadNote: async () => null,
      createNote: async () => null,
      loadGuide: async () => null,
      createGuide: async () => null,
      updateMessageSharedData: async () => {},
    })).rejects.toMatchObject({
      message: 'Resource already accepted',
      status: 400,
    });
  });

  it('rejects non-shared message types', async () => {
    await expect(acceptSharedResourceCore({
      messageId: 18,
      receiverId: 42,
      loadMessageForReceiver: async () => ({
        id: 18,
        receiver_id: 42,
        message_type: 'text',
        deck_data: null,
      }),
      loadDeck: async () => null,
      loadDeckCards: async () => [],
      loadDeckTags: async () => [],
      createDeck: async () => null,
      insertDeckCards: async () => {},
      insertDeckTags: async () => {},
      loadNote: async () => null,
      createNote: async () => null,
      loadGuide: async () => null,
      createGuide: async () => null,
      updateMessageSharedData: async () => {},
    })).rejects.toMatchObject({
      message: 'Not a shared resource message',
      status: 400,
    });
  });

  it('returns a 404 when the original deck no longer exists', async () => {
    await expect(acceptSharedDeckCore({
      messageId: 18,
      receiverId: 42,
      loadMessageForReceiver: async () => ({
        id: 18,
        receiver_id: 42,
        message_type: 'deck',
        deck_data: JSON.stringify({ id: 7 }),
      }),
      loadDeck: async () => null,
      loadDeckCards: async () => [],
      loadDeckTags: async () => [],
      createDeck: async () => null,
      insertDeckCards: async () => {},
      insertDeckTags: async () => {},
      loadNote: async () => null,
      createNote: async () => null,
      loadGuide: async () => null,
      createGuide: async () => null,
      updateMessageSharedData: async () => {},
    })).rejects.toMatchObject({
      message: 'Original deck no longer exists',
      status: 404,
    });
  });
});
