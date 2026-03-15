import { describe, it, expect } from 'vitest';

import { acceptSharedDeckCore } from '../../supabase/functions/_shared/acceptSharedDeckCore.mjs';

describe('acceptSharedDeckCore', () => {
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
      updateMessageDeckData: async (messageId, deckData) => {
        updatedMessages.push({ messageId, deckData });
      },
    });

    expect(result).toEqual({
      newDeck: { id: 99, user_id: 42, title: 'Biology', description: 'Lab prep' },
      messageId: 18,
    });
    expect(createdDecks).toEqual([{ userId: 42, deck: { id: 7, title: 'Biology', description: 'Lab prep' } }]);
    expect(insertedCards).toEqual([{ deckId: 99, cards: [
      { front: 'Q1', back: 'A1', front_image: null, back_image: null, position: 0 },
      { front: 'Q2', back: 'A2', front_image: '/front.png', back_image: null, position: 1 },
    ] }]);
    expect(insertedTags).toEqual([{ deckId: 99, tagIds: [3, 5] }]);
    expect(updatedMessages).toEqual([{ messageId: 18, deckData: { id: 7, title: 'Biology', acceptedDeckId: 99 } }]);
  });

  it('rejects already-accepted deck messages', async () => {
    await expect(acceptSharedDeckCore({
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
      updateMessageDeckData: async () => {},
    })).rejects.toMatchObject({
      message: 'Deck already accepted',
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
      updateMessageDeckData: async () => {},
    })).rejects.toMatchObject({
      message: 'Original deck no longer exists',
      status: 404,
    });
  });
});
