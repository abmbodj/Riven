import { describe, expect, it } from 'vitest';

import {
  endGroupSessionAction,
  joinGroupSessionAction,
  respondToGroupSessionCardAction,
  startGroupSessionAction,
} from '../../supabase/functions/_shared/groupSessionsCore.mjs';

describe('groupSessionsCore', () => {
  it('requires a shared deck before starting a group session', async () => {
    await expect(startGroupSessionAction({
      actorId: 7,
      groupId: 'group-1',
      deckId: 44,
      loadMembership: async () => ({ role: 'member' }),
      loadSharedDeck: async () => null,
      createSession: async () => {
        throw new Error('should not create');
      },
    })).rejects.toMatchObject({
      message: 'Deck is not shared with this group',
      status: 404,
    });
  });

  it('returns the active session when a group member joins', async () => {
    const result = await joinGroupSessionAction({
      actorId: 8,
      sessionId: 'session-1',
      loadSession: async () => ({
        id: 'session-1',
        group_id: 'group-1',
        deck_id: 44,
        status: 'active',
      }),
      loadMembership: async () => ({ role: 'member' }),
    });

    expect(result).toEqual({
      message: 'Joined session successfully',
      session: {
        id: 'session-1',
        group_id: 'group-1',
        deck_id: 44,
        status: 'active',
      },
    });
  });

  it('records card responses only for active sessions and group members', async () => {
    const writes = [];

    const result = await respondToGroupSessionCardAction({
      actorId: 9,
      sessionId: 'session-1',
      cardId: 101,
      knewIt: false,
      loadSession: async () => ({
        id: 'session-1',
        group_id: 'group-1',
        status: 'active',
      }),
      loadMembership: async () => ({ role: 'member' }),
      upsertResponse: async (payload) => {
        writes.push(payload);
      },
    });

    expect(result).toEqual({ success: true });
    expect(writes).toEqual([{
      sessionId: 'session-1',
      userId: 9,
      cardId: 101,
      knewIt: false,
    }]);
  });

  it('allows admins to end a session they did not start', async () => {
    const ended = [];

    const result = await endGroupSessionAction({
      actorId: 12,
      sessionId: 'session-1',
      loadSession: async () => ({
        id: 'session-1',
        group_id: 'group-1',
        started_by: 7,
        status: 'active',
      }),
      loadMembership: async () => ({ role: 'admin' }),
      endSession: async (sessionId) => {
        ended.push(sessionId);
      },
    });

    expect(result).toEqual({ message: 'Session ended' });
    expect(ended).toEqual(['session-1']);
  });
});
