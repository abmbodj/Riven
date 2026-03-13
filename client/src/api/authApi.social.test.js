/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => false,
  },
}));

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    channel: vi.fn(),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    },
  },
}));

import { supabase } from '../lib/supabaseClient';
import * as authApi from './authApi';

describe('authApi social features via Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.rpc.mockReset();
    authApi.setToken('supabase-token');
  });

  it('searches public users through Supabase RPC', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          id: 12,
          username: 'bianca',
          avatar: '/bianca.png',
          banner: '/banner.png',
          bio: 'Organic chemistry',
          share_code: 'BIO12345',
          role: 'user',
          is_admin: false,
          is_owner: false,
        },
      ],
      error: null,
    });

    const users = await authApi.searchUsers('bi');

    expect(supabase.rpc).toHaveBeenCalledWith('search_public_users', { search_query: 'bi' });
    expect(users).toEqual([
      {
        id: 12,
        username: 'bianca',
        avatar: '/bianca.png',
        banner: '/banner.png',
        bio: 'Organic chemistry',
        shareCode: 'BIO12345',
        role: 'user',
        isAdmin: false,
        isOwner: false,
      },
    ]);
  });

  it('loads a public user profile through Supabase RPC', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          id: 12,
          username: 'bianca',
          avatar: '/bianca.png',
          banner: '/banner.png',
          bio: 'Organic chemistry',
          share_code: 'BIO12345',
          created_at: '2026-03-13T12:30:00.000Z',
          role: 'admin',
          is_admin: true,
          is_owner: false,
          deck_count: 7,
          friendship_status: 'pending',
          friendship_direction: 'incoming',
        },
      ],
      error: null,
    });

    const profile = await authApi.getUserProfile(12);

    expect(supabase.rpc).toHaveBeenCalledWith('get_public_user_profile', { target_user_id: 12 });
    expect(profile).toEqual({
      id: 12,
      username: 'bianca',
      avatar: '/bianca.png',
      banner: '/banner.png',
      bio: 'Organic chemistry',
      shareCode: 'BIO12345',
      createdAt: '2026-03-13T12:30:00.000Z',
      role: 'admin',
      isAdmin: true,
      isOwner: false,
      deckCount: 7,
      friendshipStatus: 'pending',
      friendshipDirection: 'incoming',
    });
  });

  it('loads friends and pending requests through Supabase RPC', async () => {
    supabase.rpc.mockResolvedValue({
      data: [
        {
          id: 18,
          username: 'marcus',
          avatar: '/marcus.png',
          bio: 'Physics major',
          status: 'accepted',
          role: 'owner',
          is_admin: false,
          is_owner: true,
          is_outgoing: false,
          created_at: '2026-03-13T12:35:00.000Z',
        },
      ],
      error: null,
    });

    const friends = await authApi.getFriends();

    expect(supabase.rpc).toHaveBeenCalledWith('list_friends');
    expect(friends).toEqual([
      {
        id: 18,
        username: 'marcus',
        avatar: '/marcus.png',
        bio: 'Physics major',
        status: 'accepted',
        role: 'owner',
        isAdmin: true,
        isOwner: true,
        isOutgoing: false,
        createdAt: '2026-03-13T12:35:00.000Z',
      },
    ]);
  });

  it('sends a friend request through Supabase RPC', async () => {
    supabase.rpc.mockResolvedValue({
      data: { message: 'Friend request sent', username: 'bianca' },
      error: null,
    });

    const result = await authApi.sendFriendRequest(12);

    expect(supabase.rpc).toHaveBeenCalledWith('send_friend_request', { target_user_id: 12 });
    expect(result).toEqual({ message: 'Friend request sent', username: 'bianca' });
  });

  it('accepts and removes friendships through Supabase RPC', async () => {
    supabase.rpc
      .mockResolvedValueOnce({ data: { message: 'Friend request accepted' }, error: null })
      .mockResolvedValueOnce({ data: { message: 'Friend removed' }, error: null });

    const accepted = await authApi.acceptFriendRequest(12);
    const removed = await authApi.removeFriend(12);

    expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'accept_friend_request', { requester_user_id: 12 });
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'remove_friendship', { target_user_id: 12 });
    expect(accepted).toEqual({ message: 'Friend request accepted' });
    expect(removed).toEqual({ message: 'Friend removed' });
  });
});
