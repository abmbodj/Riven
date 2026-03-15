export const createHttpError = (message, status, extra = {}) => {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
};

const requireNonEmptyId = (value, label) => {
  const normalized = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  if (!normalized) {
    throw createHttpError(`${label} is required`, 400);
  }

  return normalized;
};

const requirePositiveInt = (value, label) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw createHttpError(`${label} must be a valid id`, 400);
  }

  return parsed;
};

const requireGroupMember = async (loadMembership, groupId, userId, message = 'Not a member of this group') => {
  const membership = await loadMembership(groupId, userId);
  if (!membership) {
    throw createHttpError(message, 403);
  }

  return membership;
};

const loadActiveSession = async (loadSession, sessionId) => {
  const session = await loadSession(sessionId);
  if (!session || session.status !== 'active') {
    throw createHttpError('Active session not found', 404);
  }

  return session;
};

export const startGroupSessionAction = async ({
  actorId,
  groupId,
  deckId,
  loadMembership,
  loadSharedDeck,
  createSession,
}) => {
  const normalizedGroupId = requireNonEmptyId(groupId, 'groupId');
  const normalizedDeckId = requirePositiveInt(deckId, 'deckId');

  await requireGroupMember(loadMembership, normalizedGroupId, actorId, 'Not a member');

  const sharedDeck = await loadSharedDeck(normalizedGroupId, normalizedDeckId);
  if (!sharedDeck) {
    throw createHttpError('Deck is not shared with this group', 404);
  }

  return createSession({
    groupId: normalizedGroupId,
    deckId: normalizedDeckId,
    startedBy: actorId,
  });
};

export const joinGroupSessionAction = async ({
  actorId,
  sessionId,
  loadSession,
  loadMembership,
}) => {
  const normalizedSessionId = requireNonEmptyId(sessionId, 'sessionId');
  const session = await loadActiveSession(loadSession, normalizedSessionId);

  await requireGroupMember(loadMembership, session.group_id, actorId);

  return {
    message: 'Joined session successfully',
    session,
  };
};

export const respondToGroupSessionCardAction = async ({
  actorId,
  sessionId,
  cardId,
  knewIt,
  loadSession,
  loadMembership,
  upsertResponse,
}) => {
  const normalizedSessionId = requireNonEmptyId(sessionId, 'sessionId');
  const normalizedCardId = requirePositiveInt(cardId, 'cardId');

  if (typeof knewIt !== 'boolean') {
    throw createHttpError('knewIt must be true or false', 400);
  }

  const session = await loadActiveSession(loadSession, normalizedSessionId);
  await requireGroupMember(loadMembership, session.group_id, actorId);

  await upsertResponse({
    sessionId: normalizedSessionId,
    userId: actorId,
    cardId: normalizedCardId,
    knewIt,
  });

  return { success: true };
};

export const endGroupSessionAction = async ({
  actorId,
  sessionId,
  loadSession,
  loadMembership,
  endSession,
}) => {
  const normalizedSessionId = requireNonEmptyId(sessionId, 'sessionId');
  const session = await loadSession(normalizedSessionId);

  if (!session) {
    throw createHttpError('Session not found', 404);
  }

  if (Number(session.started_by) !== Number(actorId)) {
    const membership = await loadMembership(session.group_id, actorId);
    if (!membership || membership.role !== 'admin') {
      throw createHttpError('Only the session starter or an admin can end the session', 403);
    }
  }

  if (session.status !== 'ended') {
    await endSession(normalizedSessionId);
  }

  return { message: 'Session ended' };
};
