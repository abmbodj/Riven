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

const buildJsonResponse = (body) => ({
  ok: true,
  headers: {
    get: () => 'application/json',
  },
  text: vi.fn().mockResolvedValue(JSON.stringify(body)),
});

describe('authApi direct messages via Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    supabase.channel.mockReset();
    supabase.removeChannel.mockReset();
    localStorage.clear();
    authApi.setToken('supabase-token');
  });

  it('builds the conversation list from Supabase messages and user profiles', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(buildJsonResponse({ id: 42, username: 'avery', avatar: '/me.png' }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const order = vi.fn().mockResolvedValue({
      data: [
        { id: 4, sender_id: 42, receiver_id: 18, content: 'Deck looks good', message_type: 'text', is_read: 1, created_at: '2026-03-13T12:10:00.000Z' },
        { id: 3, sender_id: 12, receiver_id: 42, content: 'See you in lab', message_type: 'text', is_read: 0, created_at: '2026-03-13T12:09:00.000Z' },
        { id: 2, sender_id: 12, receiver_id: 42, content: 'Quiz at 2?', message_type: 'text', is_read: 0, created_at: '2026-03-13T12:07:00.000Z' },
        { id: 1, sender_id: 42, receiver_id: 12, content: 'Sounds good', message_type: 'text', is_read: 1, created_at: '2026-03-13T12:05:00.000Z' },
      ],
      error: null,
    });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });

    supabase.from.mockReturnValue({ select });
    supabase.rpc.mockImplementation((fn, params) => {
      if (fn === 'get_public_user_profile' && params?.target_user_id === 12) {
        return Promise.resolve({
          data: [{ id: 12, username: 'bianca', avatar: '/bianca.png', banner: null, bio: '', share_code: 'BIO12345', created_at: null, role: 'user', is_admin: false, is_owner: false, deck_count: 0, friendship_status: null, friendship_direction: null }],
          error: null,
        });
      }
      if (fn === 'get_public_user_profile' && params?.target_user_id === 18) {
        return Promise.resolve({
          data: [{ id: 18, username: 'marcus', avatar: '/marcus.png', banner: null, bio: '', share_code: 'PHY12345', created_at: null, role: 'user', is_admin: false, is_owner: false, deck_count: 0, friendship_status: null, friendship_direction: null }],
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const conversations = await authApi.getConversations();

    expect(or).toHaveBeenCalledWith('sender_id.eq.42,receiver_id.eq.42');
    expect(conversations).toEqual([
      {
        userId: 18,
        username: 'marcus',
        avatar: '/marcus.png',
        lastMessage: 'Deck looks good',
        lastMessageType: 'text',
        lastMessageAt: '2026-03-13T12:10:00.000Z',
        isOwnMessage: true,
        unreadCount: 0,
      },
      {
        userId: 12,
        username: 'bianca',
        avatar: '/bianca.png',
        lastMessage: 'See you in lab',
        lastMessageType: 'text',
        lastMessageAt: '2026-03-13T12:09:00.000Z',
        isOwnMessage: false,
        unreadCount: 2,
      },
    ]);
  });

  it('loads a conversation chronologically and marks incoming unread rows as read', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({ id: 42, username: 'avery', avatar: '/me.png' }));

    const limit = vi.fn().mockResolvedValue({
      data: [
        { id: 11, sender_id: 12, receiver_id: 42, content: 'older', message_type: 'text', deck_data: null, image_url: null, is_edited: 0, is_read: 1, created_at: '2026-03-13T12:05:00.000Z' },
        { id: 12, sender_id: 42, receiver_id: 12, content: 'latest', message_type: 'text', deck_data: null, image_url: null, is_edited: 0, is_read: 1, created_at: '2026-03-13T12:10:00.000Z' },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });

    supabase.from.mockReturnValue({ select });
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    const messages = await authApi.getMessages(12, 50);

    expect(or).toHaveBeenCalledWith('and(sender_id.eq.42,receiver_id.eq.12),and(sender_id.eq.12,receiver_id.eq.42)');
    expect(supabase.rpc).toHaveBeenCalledWith('mark_messages_read', { other_user_id: 12 });
    expect(messages).toEqual([
      {
        id: 11,
        senderId: 12,
        receiverId: 42,
        senderUsername: null,
        senderAvatar: null,
        content: 'older',
        messageType: 'text',
        deckData: null,
        imageUrl: null,
        isEdited: false,
        isRead: true,
        createdAt: '2026-03-13T12:05:00.000Z',
        isMine: false,
      },
      {
        id: 12,
        senderId: 42,
        receiverId: 12,
        senderUsername: 'avery',
        senderAvatar: '/me.png',
        content: 'latest',
        messageType: 'text',
        deckData: null,
        imageUrl: null,
        isEdited: false,
        isRead: true,
        createdAt: '2026-03-13T12:10:00.000Z',
        isMine: true,
      },
    ]);
  });

  it('loads messages with a provided current user and does not fail when mark_messages_read errors', async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('getMe should not be called');
    });

    const limit = vi.fn().mockResolvedValue({
      data: [
        { id: 11, sender_id: 12, receiver_id: 42, content: 'older', message_type: 'text', deck_data: null, image_url: null, is_edited: 0, is_read: 1, created_at: '2026-03-13T12:05:00.000Z' },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });

    supabase.from.mockReturnValue({ select });
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'missing rpc' } });

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const messages = await authApi.getMessages(
      12,
      50,
      undefined,
      { id: 42, username: 'avery', avatar: '/me.png' },
    );

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(messages).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalledWith('[authApi] Failed to mark messages as read:', 'missing rpc');

    warnSpy.mockRestore();
  });

  it('creates messages in Supabase with sender_id and serialized deck payloads', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({
      id: 42,
      username: 'avery',
      avatar: '/me.png',
      email: 'avery@example.com',
    }));

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 77,
        sender_id: 42,
        receiver_id: 12,
        content: 'Shared a deck: Biology',
        message_type: 'deck',
        deck_data: JSON.stringify({ id: 5, title: 'Biology', cardCount: 24 }),
        image_url: null,
        is_edited: 0,
        is_read: 0,
        created_at: '2026-03-13T12:12:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    supabase.from.mockReturnValue({ insert });

    const message = await authApi.sendMessage(12, 'Shared a deck: Biology', 'deck', { id: 5, title: 'Biology', cardCount: 24 });

    expect(insert).toHaveBeenCalledWith({
      sender_id: 42,
      receiver_id: 12,
      content: 'Shared a deck: Biology',
      message_type: 'deck',
      deck_data: JSON.stringify({ id: 5, title: 'Biology', cardCount: 24 }),
      image_url: null,
    });
    expect(message).toEqual({
      id: 77,
      senderId: 42,
      receiverId: 12,
      senderUsername: 'avery',
      senderAvatar: '/me.png',
      content: 'Shared a deck: Biology',
      messageType: 'deck',
      deckData: { id: 5, title: 'Biology', cardCount: 24 },
      imageUrl: null,
      isEdited: false,
      isRead: false,
      createdAt: '2026-03-13T12:12:00.000Z',
      isMine: true,
    });
  });

  it('creates messages without fetching auth/me when a current user override is provided', async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('getMe should not be called');
    });

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 88,
        sender_id: 42,
        receiver_id: 12,
        content: 'hello',
        message_type: 'text',
        deck_data: null,
        image_url: null,
        is_edited: 0,
        is_read: 0,
        created_at: '2026-03-13T12:15:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    supabase.from.mockReturnValue({ insert });

    const message = await authApi.sendMessage(
      12,
      'hello',
      'text',
      null,
      null,
      { id: 42, username: 'avery', avatar: '/me.png' },
    );

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({
      sender_id: 42,
      receiver_id: 12,
      content: 'hello',
      message_type: 'text',
      deck_data: null,
      image_url: null,
    });
    expect(message.senderUsername).toBe('avery');
  });

  it('subscribes to Supabase Realtime and maps row payloads into message events', () => {
    const insertHandler = vi.fn();
    const updateHandler = vi.fn();
    const deleteHandler = vi.fn();
    const subscribe = vi.fn();
    const on = vi.fn()
      .mockImplementationOnce((_event, _config, handler) => {
        insertHandler.mockImplementation(handler);
        return channel;
      })
      .mockImplementationOnce((_event, _config, handler) => {
        updateHandler.mockImplementation(handler);
        return channel;
      })
      .mockImplementationOnce((_event, _config, handler) => {
        deleteHandler.mockImplementation(handler);
        return channel;
      });

    const channel = { on, subscribe };
    supabase.channel.mockReturnValue(channel);

    const handlers = {
      onInsert: vi.fn(),
      onUpdate: vi.fn(),
      onDelete: vi.fn(),
    };

    const unsubscribe = authApi.subscribeToMessages(42, handlers);

    insertHandler({
      new: {
        id: 88,
        sender_id: 12,
        receiver_id: 42,
        content: 'Incoming',
        message_type: 'text',
        deck_data: null,
        image_url: null,
        is_edited: 0,
        is_read: 0,
        created_at: '2026-03-13T12:15:00.000Z',
      },
    });

    updateHandler({
      new: {
        id: 88,
        sender_id: 12,
        receiver_id: 42,
        content: 'Edited',
        message_type: 'text',
        deck_data: null,
        image_url: null,
        is_edited: 1,
        is_read: 1,
        created_at: '2026-03-13T12:15:00.000Z',
      },
    });

    deleteHandler({
      old: {
        id: 88,
        sender_id: 12,
        receiver_id: 42,
        content: 'Edited',
        message_type: 'text',
        deck_data: null,
        image_url: null,
        is_edited: 1,
        is_read: 1,
        created_at: '2026-03-13T12:15:00.000Z',
      },
    });

    expect(supabase.channel).toHaveBeenCalledWith('messages_42');
    expect(handlers.onInsert).toHaveBeenCalledWith(expect.objectContaining({
      id: 88,
      senderId: 12,
      receiverId: 42,
      content: 'Incoming',
      isMine: false,
    }));
    expect(handlers.onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 88,
      content: 'Edited',
      isEdited: true,
      isRead: true,
    }));
    expect(handlers.onDelete).toHaveBeenCalledWith(expect.objectContaining({
      id: 88,
    }));

    unsubscribe();
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });

  it('tracks DM typing state through Supabase Presence', async () => {
    const syncHandler = vi.fn();
    const track = vi.fn().mockResolvedValue(undefined);
    const untrack = vi.fn();
    const presenceState = vi.fn(() => ({
      'user-12': [{ userId: 12, isTyping: true }],
    }));
    const subscribe = vi.fn((callback) => {
      callback?.('SUBSCRIBED');
      return channel;
    });
    const on = vi.fn().mockImplementation((_event, _config, handler) => {
      syncHandler.mockImplementation(handler);
      return channel;
    });

    const channel = { on, subscribe, track, untrack, presenceState };
    supabase.channel.mockReturnValue(channel);

    const onTypingChange = vi.fn();
    const typing = authApi.subscribeToTypingPresence(42, 12, {
      onTypingChange,
    });

    await Promise.resolve();

    expect(supabase.channel).toHaveBeenCalledWith('dm_12_42', expect.any(Object));
    expect(track).toHaveBeenCalledWith({ userId: 42, isTyping: false });

    syncHandler();
    expect(onTypingChange).toHaveBeenCalledWith(true);
    expect(typing.startTyping).toBeTypeOf('function');
    expect(typing.stopTyping).toBeTypeOf('function');

    await typing.startTyping();
    await typing.stopTyping();

    expect(track).toHaveBeenNthCalledWith(2, { userId: 42, isTyping: true });
    expect(track).toHaveBeenNthCalledWith(3, { userId: 42, isTyping: false });

    typing.unsubscribe();
    expect(untrack).toHaveBeenCalledTimes(1);
    expect(supabase.removeChannel).toHaveBeenCalledWith(channel);
  });
});
