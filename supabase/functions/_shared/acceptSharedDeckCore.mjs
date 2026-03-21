import {
  STUDY_GUIDE_FORMAT_VERSION,
  createDefaultStudyGuideState,
  normalizeStudyGuideData,
} from './studyGuideCore.mjs';

const SHARED_RESOURCE_TYPES = new Set(['deck', 'note', 'guide']);

const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) return value;
  return null;
};

const normalizeSharedData = (rawSharedData, messageType) => {
  if (!rawSharedData) {
    return null;
  }

  let parsedData = rawSharedData;

  if (typeof rawSharedData === 'string') {
    try {
      parsedData = JSON.parse(rawSharedData);
    } catch {
      throw createHttpError('Invalid shared resource data in message', 400);
    }
  }

  if (!parsedData || typeof parsedData !== 'object') {
    return null;
  }

  const kind = SHARED_RESOURCE_TYPES.has(parsedData.kind) ? parsedData.kind : messageType;
  const sourceId = normalizeId(parsedData.sourceId ?? parsedData.id);

  if (!SHARED_RESOURCE_TYPES.has(kind) || sourceId === null) {
    return null;
  }

  const acceptedId = normalizeId(
    parsedData.acceptedId
    ?? parsedData.acceptedDeckId
    ?? parsedData.acceptedNoteId
    ?? parsedData.acceptedGuideId,
  );
  const title = typeof parsedData.title === 'string' && parsedData.title.trim()
    ? parsedData.title.trim()
    : 'Untitled';
  const previewText = typeof parsedData.previewText === 'string' && parsedData.previewText.trim()
    ? parsedData.previewText.trim()
    : null;
  const parsedCardCount = Number(parsedData.cardCount);
  const cardCount = Number.isFinite(parsedCardCount) ? parsedCardCount : null;

  return {
    kind,
    sourceId,
    title,
    previewText,
    cardCount,
    acceptedId,
  };
};

const serializeSharedData = ({
  kind,
  sourceId,
  title,
  previewText = null,
  cardCount = null,
  acceptedId = null,
}) => {
  const payload = {
    kind,
    sourceId,
    id: sourceId,
    title,
  };

  if (typeof previewText === 'string' && previewText.trim()) {
    payload.previewText = previewText.trim();
  }

  if (cardCount !== null && cardCount !== undefined && cardCount !== '') {
    const parsedCardCount = Number(cardCount);
    if (Number.isFinite(parsedCardCount)) {
      payload.cardCount = parsedCardCount;
    }
  }

  if (acceptedId !== null && acceptedId !== undefined) {
    payload.acceptedId = acceptedId;
    if (kind === 'deck') payload.acceptedDeckId = acceptedId;
    if (kind === 'note') payload.acceptedNoteId = acceptedId;
    if (kind === 'guide') payload.acceptedGuideId = acceptedId;
  }

  return payload;
};

const acceptDeckResource = async ({
  receiverId,
  sharedData,
  loadDeck,
  loadDeckCards,
  loadDeckTags,
  createDeck,
  insertDeckCards,
  insertDeckTags,
}) => {
  const originalDeck = await loadDeck(sharedData.sourceId);
  if (!originalDeck) {
    throw createHttpError('Original deck no longer exists', 404);
  }

  const [cards, tags] = await Promise.all([
    loadDeckCards(sharedData.sourceId),
    loadDeckTags(sharedData.sourceId),
  ]);

  const newDeck = await createDeck(receiverId, originalDeck);

  if (cards.length > 0) {
    await insertDeckCards(newDeck.id, cards);
  }

  if (tags.length > 0) {
    await insertDeckTags(newDeck.id, tags);
  }

  return {
    resource: newDeck,
    sharedData: {
      ...sharedData,
      title: sharedData.title || originalDeck.title,
      cardCount: sharedData.cardCount ?? cards.length,
    },
  };
};

const acceptNoteResource = async ({
  receiverId,
  sharedData,
  loadNote,
  createNote,
}) => {
  const originalNote = await loadNote(sharedData.sourceId);
  if (!originalNote) {
    throw createHttpError('Original note no longer exists', 404);
  }

  const visibleContent = originalNote.enhanced_content ?? originalNote.content ?? {};
  const newNote = await createNote(receiverId, {
    title: originalNote.title,
    content: visibleContent,
    enhanced_content: null,
    class_id: null,
    audio_url: null,
    audio_duration_seconds: null,
    source_type: 'import',
  });

  return {
    resource: newNote,
    sharedData: {
      ...sharedData,
      title: sharedData.title || originalNote.title,
    },
  };
};

const acceptGuideResource = async ({
  receiverId,
  sharedData,
  loadGuide,
  createGuide,
}) => {
  const originalGuide = await loadGuide(sharedData.sourceId);
  if (!originalGuide) {
    throw createHttpError('Original guide no longer exists', 404);
  }

  const normalizedGuideData = normalizeStudyGuideData(originalGuide.guide_data);
  const formatVersion = normalizedGuideData ? STUDY_GUIDE_FORMAT_VERSION : 1;

  const newGuide = await createGuide(receiverId, {
    title: originalGuide.title,
    content: originalGuide.content ?? {},
    format_version: formatVersion,
    guide_data: normalizedGuideData,
    study_state: normalizedGuideData ? createDefaultStudyGuideState(normalizedGuideData) : {},
    note_id: null,
    class_id: null,
  });

  return {
    resource: newGuide,
    sharedData: {
      ...sharedData,
      title: sharedData.title || originalGuide.title,
      previewText: sharedData.previewText ?? null,
    },
  };
};

export const acceptSharedResourceCore = async ({
  messageId,
  receiverId,
  loadMessageForReceiver,
  loadDeck,
  loadDeckCards,
  loadDeckTags,
  createDeck,
  insertDeckCards,
  insertDeckTags,
  loadNote,
  createNote,
  loadGuide,
  createGuide,
  updateMessageSharedData,
}) => {
  const message = await loadMessageForReceiver(messageId, receiverId);
  if (!message) {
    throw createHttpError('Message not found', 404);
  }

  if (!SHARED_RESOURCE_TYPES.has(message.message_type)) {
    throw createHttpError('Not a shared resource message', 400);
  }

  const sharedData = normalizeSharedData(message.deck_data, message.message_type);
  if (!sharedData?.sourceId) {
    throw createHttpError('Invalid shared resource data in message', 400);
  }

  if (sharedData.acceptedId) {
    throw createHttpError('Resource already accepted', 400);
  }

  let acceptedResult;

  if (sharedData.kind === 'deck') {
    acceptedResult = await acceptDeckResource({
      receiverId,
      sharedData,
      loadDeck,
      loadDeckCards,
      loadDeckTags,
      createDeck,
      insertDeckCards,
      insertDeckTags,
    });
  } else if (sharedData.kind === 'note') {
    acceptedResult = await acceptNoteResource({
      receiverId,
      sharedData,
      loadNote,
      createNote,
    });
  } else {
    acceptedResult = await acceptGuideResource({
      receiverId,
      sharedData,
      loadGuide,
      createGuide,
    });
  }

  const updatedSharedData = serializeSharedData({
    ...acceptedResult.sharedData,
    acceptedId: acceptedResult.resource.id,
  });

  await updateMessageSharedData(messageId, updatedSharedData);

  const response = {
    kind: sharedData.kind,
    resource: acceptedResult.resource,
    messageId,
  };

  if (sharedData.kind === 'deck') response.newDeck = acceptedResult.resource;
  if (sharedData.kind === 'note') response.newNote = acceptedResult.resource;
  if (sharedData.kind === 'guide') response.newGuide = acceptedResult.resource;

  return response;
};

export const acceptSharedDeckCore = acceptSharedResourceCore;
