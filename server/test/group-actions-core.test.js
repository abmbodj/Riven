import { describe, expect, it } from 'vitest';

import {
  ensureUniqueJoinCode,
  extractGroupFileStoragePath,
  leaveGroupAction,
  removeSharedDeckAction,
} from '../../supabase/functions/_shared/groupActionsCore.mjs';

describe('groupActionsCore', () => {
  it('retries join-code generation until it finds a unique code', async () => {
    const attempts = [];
    const codes = ['RIV-AAA', 'RIV-BBB'];

    const result = await ensureUniqueJoinCode({
      generateCode: () => codes.shift(),
      isCodeTaken: async (code) => {
        attempts.push(code);
        return code === 'RIV-AAA';
      },
    });

    expect(result).toBe('RIV-BBB');
    expect(attempts).toEqual(['RIV-AAA', 'RIV-BBB']);
  });

  it('blocks the last admin from leaving while other members remain', async () => {
    await expect(leaveGroupAction({
      actorId: 7,
      groupId: 'group-1',
      loadMembership: async () => ({ role: 'admin' }),
      countAdmins: async () => 1,
      countMembers: async () => 3,
      deleteGroup: async () => {},
      removeMembership: async () => {},
    })).rejects.toMatchObject({
      message: 'You must promote another admin before leaving, or delete the group.',
      status: 400,
    });
  });

  it('deletes the group when the last admin is also the last member', async () => {
    const deletedGroups = [];
    const removedMemberships = [];

    const result = await leaveGroupAction({
      actorId: 7,
      groupId: 'group-1',
      loadMembership: async () => ({ role: 'admin' }),
      countAdmins: async () => 1,
      countMembers: async () => 1,
      deleteGroup: async (groupId) => {
        deletedGroups.push(groupId);
      },
      removeMembership: async (groupId, userId) => {
        removedMemberships.push({ groupId, userId });
      },
    });

    expect(result).toEqual({ message: 'Group deleted as the last member left' });
    expect(deletedGroups).toEqual(['group-1']);
    expect(removedMemberships).toEqual([]);
  });

  it('allows the original sharer to remove a shared deck without admin rights', async () => {
    const removedDecks = [];

    const result = await removeSharedDeckAction({
      actorId: 9,
      groupId: 'group-1',
      deckId: 44,
      loadMembership: async () => ({ role: 'member' }),
      loadSharedDeck: async () => ({ shared_by: 9 }),
      deleteSharedDeck: async (groupId, deckId) => {
        removedDecks.push({ groupId, deckId });
      },
    });

    expect(result).toEqual({ message: 'Deck removed from group' });
    expect(removedDecks).toEqual([{ groupId: 'group-1', deckId: 44 }]);
  });

  it('extracts storage paths from public group-file URLs', () => {
    expect(extractGroupFileStoragePath(
      'https://project.supabase.co/storage/v1/object/public/group-files/group-1/notes/file.pdf?download=1',
    )).toBe('group-1/notes/file.pdf');
    expect(extractGroupFileStoragePath('https://example.com/other-bucket/file.pdf')).toBeNull();
  });
});
