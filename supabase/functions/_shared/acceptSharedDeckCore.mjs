const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeDeckData = (rawDeckData) => {
  if (!rawDeckData) {
    return null;
  }

  if (typeof rawDeckData === 'string') {
    try {
      return JSON.parse(rawDeckData);
    } catch {
      throw createHttpError('Invalid deck data in message', 400);
    }
  }

  if (typeof rawDeckData === 'object') {
    return rawDeckData;
  }

  return null;
};

export const acceptSharedDeckCore = async ({
  messageId,
  receiverId,
  loadMessageForReceiver,
  loadDeck,
  loadDeckCards,
  loadDeckTags,
  createDeck,
  insertDeckCards,
  insertDeckTags,
  updateMessageDeckData,
}) => {
  const message = await loadMessageForReceiver(messageId, receiverId);
  if (!message) {
    throw createHttpError('Message not found', 404);
  }

  if (message.message_type !== 'deck') {
    throw createHttpError('Not a deck message', 400);
  }

  const deckData = normalizeDeckData(message.deck_data);
  if (!deckData?.id) {
    throw createHttpError('Invalid deck data in message', 400);
  }

  if (deckData.acceptedDeckId) {
    throw createHttpError('Deck already accepted', 400);
  }

  const originalDeck = await loadDeck(deckData.id);
  if (!originalDeck) {
    throw createHttpError('Original deck no longer exists', 404);
  }

  const [cards, tags] = await Promise.all([
    loadDeckCards(deckData.id),
    loadDeckTags(deckData.id),
  ]);

  const newDeck = await createDeck(receiverId, originalDeck);

  if (cards.length > 0) {
    await insertDeckCards(newDeck.id, cards);
  }

  if (tags.length > 0) {
    await insertDeckTags(newDeck.id, tags);
  }

  const updatedDeckData = {
    ...deckData,
    acceptedDeckId: newDeck.id,
  };

  await updateMessageDeckData(messageId, updatedDeckData);

  return {
    newDeck,
    messageId,
  };
};
