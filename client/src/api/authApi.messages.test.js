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
    storage: {
      from: vi.fn(),
    },
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

const emptySharedFields = {
  sharedResource: null,
  deckData: null,
  clientMessageId: null,
  replyToId: null,
  replyTo: null,
  imagePath: null,
  imageLoadError: false,
  deliveredAt: null,
  readAt: null,
};

describe('authApi direct messages via Supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReset();
    supabase.rpc.mockReset();
    supabase.channel.mockReset();
    supabase.removeChannel.mockReset();
    supabase.storage.from.mockReset();
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

  it('uses list_dm_conversations when the RPC is available', async () => {
    globalThis.fetch = vi.fn((url) => {
      if (url.endsWith('/auth/me')) {
        return Promise.resolve(buildJsonResponse({ id: 42, username: 'avery', avatar: '/me.png' }));
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    supabase.rpc.mockResolvedValueOnce({
      data: [
        {
          user_id: 12,
          username: 'bianca',
          avatar: '/bianca.png',
          last_message: 'See you in lab',
          last_message_type: 'text',
          last_message_at: '2026-03-13T12:09:00.000Z',
          is_own_message: false,
          unread_count: 2,
        },
      ],
      error: null,
    });

    const conversations = await authApi.getConversations();

    expect(supabase.rpc).toHaveBeenCalledWith('list_dm_conversations');
    expect(supabase.from).not.toHaveBeenCalled();
    expect(conversations).toEqual([
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
        ...emptySharedFields,
        imageUrl: null,
        isEdited: false,
        isRead: true,
        deliveryStatus: 'received',
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
        ...emptySharedFields,
        imageUrl: null,
        isEdited: false,
        isRead: true,
        deliveryStatus: 'read',
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

  it('maps storage-backed image paths to signed URLs while preserving legacy image_url rows', async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('getMe should not be called');
    });

    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 14,
          sender_id: 12,
          receiver_id: 42,
          content: '',
          message_type: 'text',
          deck_data: null,
          image_url: null,
          image_path: '12/42/stored.webp',
          is_edited: 0,
          is_read: 1,
          created_at: '2026-03-13T12:06:00.000Z',
        },
        {
          id: 15,
          sender_id: 42,
          receiver_id: 12,
          content: '',
          message_type: 'text',
          deck_data: null,
          image_url: 'data:image/png;base64,legacy',
          image_path: null,
          is_edited: 0,
          is_read: 1,
          created_at: '2026-03-13T12:07:00.000Z',
        },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/stored.webp' },
      error: null,
    });

    supabase.from.mockReturnValue({ select });
    supabase.rpc.mockResolvedValue({ data: null, error: null });
    supabase.storage.from.mockReturnValue({ createSignedUrl });

    const messages = await authApi.getMessages(
      12,
      50,
      undefined,
      { id: 42, username: 'avery', avatar: '/me.png' },
    );

    expect(createSignedUrl).toHaveBeenCalledWith('12/42/stored.webp', 3600);
    expect(messages[0]).toMatchObject({
      id: 14,
      imagePath: '12/42/stored.webp',
      imageUrl: 'https://signed.example/stored.webp',
      imageLoadError: false,
    });
    expect(messages[1]).toMatchObject({
      id: 15,
      imagePath: null,
      imageUrl: 'data:image/png;base64,legacy',
      imageLoadError: false,
    });
  });

  it('normalizes legacy deck payloads and new guide payloads into sharedResource data', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({ id: 42, username: 'avery', avatar: '/me.png' }));

    const limit = vi.fn().mockResolvedValue({
      data: [
        {
          id: 20,
          sender_id: 12,
          receiver_id: 42,
          content: 'Shared a deck: Biology',
          message_type: 'deck',
          deck_data: JSON.stringify({ id: 5, title: 'Biology', cardCount: 24, acceptedDeckId: 55 }),
          image_url: null,
          is_edited: 0,
          is_read: 1,
          created_at: '2026-03-13T12:05:00.000Z',
        },
        {
          id: 21,
          sender_id: 12,
          receiver_id: 42,
          content: 'Shared a guide: World War I',
          message_type: 'guide',
          deck_data: JSON.stringify({ kind: 'guide', sourceId: 'guide-7', title: 'World War I', previewText: 'Treaty summary' }),
          image_url: null,
          is_edited: 0,
          is_read: 1,
          created_at: '2026-03-13T12:06:00.000Z',
        },
      ],
      error: null,
    });
    const order = vi.fn().mockReturnValue({ limit });
    const or = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ or });

    supabase.from.mockReturnValue({ select });
    supabase.rpc.mockResolvedValue({ data: null, error: null });

    const messages = await authApi.getMessages(12, 50);

    expect(messages[0].sharedResource).toEqual({
      kind: 'deck',
      sourceId: 5,
      title: 'Biology',
      previewText: null,
      cardCount: 24,
      acceptedId: 55,
    });
    expect(messages[0].deckData).toEqual(messages[0].sharedResource);
    expect(messages[1].sharedResource).toEqual({
      kind: 'guide',
      sourceId: 'guide-7',
      title: 'World War I',
      previewText: 'Treaty summary',
      cardCount: null,
      acceptedId: null,
    });
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
        deck_data: JSON.stringify({ kind: 'deck', sourceId: 5, id: 5, title: 'Biology', cardCount: 24 }),
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
      deck_data: JSON.stringify({ kind: 'deck', sourceId: 5, id: 5, title: 'Biology', cardCount: 24 }),
      image_url: null,
      reply_to_id: null,
    });
    expect(message).toEqual({
      id: 77,
      senderId: 42,
      receiverId: 12,
      senderUsername: 'avery',
      senderAvatar: '/me.png',
      content: 'Shared a deck: Biology',
      messageType: 'deck',
      sharedResource: {
        kind: 'deck',
        sourceId: 5,
        title: 'Biology',
        previewText: null,
        cardCount: 24,
        acceptedId: null,
      },
      deckData: {
        kind: 'deck',
        sourceId: 5,
        title: 'Biology',
        previewText: null,
        cardCount: 24,
        acceptedId: null,
      },
      imageUrl: null,
      imagePath: null,
      imageLoadError: false,
      isEdited: false,
      isRead: false,
      deliveredAt: null,
      readAt: null,
      deliveryStatus: 'sent',
      createdAt: '2026-03-13T12:12:00.000Z',
      isMine: true,
      clientMessageId: null,
      replyToId: null,
      replyTo: null,
    });
  });

  it('creates shared note messages with normalized payloads', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({
      id: 42,
      username: 'avery',
      avatar: '/me.png',
      email: 'avery@example.com',
    }));

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 78,
        sender_id: 42,
        receiver_id: 12,
        content: 'Shared a note: Bio Notes',
        message_type: 'note',
        deck_data: JSON.stringify({ kind: 'note', sourceId: 'note-1', id: 'note-1', title: 'Bio Notes', previewText: 'ATP and glycolysis' }),
        image_url: null,
        is_edited: 0,
        is_read: 0,
        created_at: '2026-03-13T12:13:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });

    await authApi.sendMessage(12, 'Shared a note: Bio Notes', 'note', {
      sourceId: 'note-1',
      title: 'Bio Notes',
      previewText: 'ATP and glycolysis',
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      message_type: 'note',
      deck_data: JSON.stringify({ kind: 'note', sourceId: 'note-1', id: 'note-1', title: 'Bio Notes', previewText: 'ATP and glycolysis' }),
    }));
  });

  it('creates shared guide messages with normalized payloads', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({
      id: 42,
      username: 'avery',
      avatar: '/me.png',
      email: 'avery@example.com',
    }));

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 79,
        sender_id: 42,
        receiver_id: 12,
        content: 'Shared a guide: WWI Guide',
        message_type: 'guide',
        deck_data: JSON.stringify({ kind: 'guide', sourceId: 'guide-1', id: 'guide-1', title: 'WWI Guide', previewText: 'Treaty of Versailles' }),
        image_url: null,
        is_edited: 0,
        is_read: 0,
        created_at: '2026-03-13T12:14:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });

    await authApi.sendMessage(12, 'Shared a guide: WWI Guide', 'guide', {
      sourceId: 'guide-1',
      title: 'WWI Guide',
      previewText: 'Treaty of Versailles',
    });

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      message_type: 'guide',
      deck_data: JSON.stringify({ kind: 'guide', sourceId: 'guide-1', id: 'guide-1', title: 'WWI Guide', previewText: 'Treaty of Versailles' }),
    }));
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
      reply_to_id: null,
    });
    expect(message.senderUsername).toBe('avery');
  });

  it('stores client_message_id when sending an optimistic message', async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('getMe should not be called');
    });

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 90,
        client_message_id: 'client-123',
        sender_id: 42,
        receiver_id: 12,
        content: 'optimistic hello',
        message_type: 'text',
        deck_data: null,
        image_url: null,
        is_edited: 0,
        is_read: 0,
        delivered_at: null,
        read_at: null,
        created_at: '2026-03-13T12:17:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });

    const message = await authApi.sendMessage(
      12,
      'optimistic hello',
      'text',
      null,
      null,
      { id: 42, username: 'avery', avatar: '/me.png' },
      null,
      null,
      { clientMessageId: 'client-123' },
    );

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({
      client_message_id: 'client-123',
    }));
    expect(message.clientMessageId).toBe('client-123');
    expect(message.deliveryStatus).toBe('sent');
  });

  it('retries optimistic sends without client_message_id when the schema cache is stale', async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('getMe should not be called');
    });

    const single = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'client_message_id' column of 'messages' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 91,
          sender_id: 42,
          receiver_id: 12,
          content: 'fallback hello',
          message_type: 'text',
          deck_data: null,
          image_url: null,
          is_edited: 0,
          is_read: 0,
          delivered_at: null,
          read_at: null,
          created_at: '2026-03-13T12:18:00.000Z',
        },
        error: null,
      });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });

    const message = await authApi.sendMessage(
      12,
      'fallback hello',
      'text',
      null,
      null,
      { id: 42, username: 'avery', avatar: '/me.png' },
      null,
      null,
      { clientMessageId: 'client-stale-schema' },
    );

    expect(insert).toHaveBeenNthCalledWith(1, expect.objectContaining({
      client_message_id: 'client-stale-schema',
    }));
    expect(insert).toHaveBeenNthCalledWith(2, {
      sender_id: 42,
      receiver_id: 12,
      content: 'fallback hello',
      message_type: 'text',
      deck_data: null,
      image_url: null,
      reply_to_id: null,
    });
    expect(message.id).toBe(91);
    expect(message.clientMessageId).toBeNull();
    expect(message.deliveryStatus).toBe('sent');
  });

  it('does not retry optimistic sends for unsupported insert errors', async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('getMe should not be called');
    });

    const single = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42501',
        message: 'new row violates row-level security policy',
      },
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    supabase.from.mockReturnValue({ insert });

    await expect(authApi.sendMessage(
      12,
      'blocked hello',
      'text',
      null,
      null,
      { id: 42, username: 'avery', avatar: '/me.png' },
      null,
      null,
      { clientMessageId: 'client-rls-error' },
    )).rejects.toMatchObject({
      code: '42501',
      status: 403,
    });

    expect(insert).toHaveBeenCalledTimes(1);
  });

  it('uploads direct-message images into private message storage', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    supabase.storage.from.mockReturnValue({ upload });

    const image = new File(['image-bytes'], 'photo.png', { type: 'image/png' });
    const result = await authApi.uploadMessageImage(
      12,
      image,
      { id: 42, username: 'avery', avatar: '/me.png' },
    );

    expect(supabase.storage.from).toHaveBeenCalledWith('message-images');
    expect(result.path).toMatch(/^42\/12\/.+\.png$/);
    expect(upload).toHaveBeenCalledWith(
      result.path,
      image,
      { contentType: 'image/png', upsert: false },
    );
  });

  it('stores image_path and signs it for storage-backed image messages', async () => {
    globalThis.fetch = vi.fn(() => {
      throw new Error('getMe should not be called');
    });

    const single = vi.fn().mockResolvedValue({
      data: {
        id: 89,
        sender_id: 42,
        receiver_id: 12,
        content: '',
        message_type: 'text',
        deck_data: null,
        image_url: null,
        image_path: '42/12/photo.png',
        is_edited: 0,
        is_read: 0,
        created_at: '2026-03-13T12:16:00.000Z',
      },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/photo.png' },
      error: null,
    });

    supabase.from.mockReturnValue({ insert });
    supabase.storage.from.mockReturnValue({ createSignedUrl });

    const message = await authApi.sendMessage(
      12,
      '',
      'text',
      null,
      null,
      { id: 42, username: 'avery', avatar: '/me.png' },
      null,
      '42/12/photo.png',
    );

    expect(insert).toHaveBeenCalledWith({
      sender_id: 42,
      receiver_id: 12,
      content: '',
      message_type: 'text',
      deck_data: null,
      image_url: null,
      reply_to_id: null,
      image_path: '42/12/photo.png',
    });
    expect(createSignedUrl).toHaveBeenCalledWith('42/12/photo.png', 3600);
    expect(message.imagePath).toBe('42/12/photo.png');
    expect(message.imageUrl).toBe('https://signed.example/photo.png');
  });

  it('refreshes signed URLs for private direct-message images', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/refreshed.png' },
      error: null,
    });
    supabase.storage.from.mockReturnValue({ createSignedUrl });

    const url = await authApi.refreshMessageImageUrl('42/12/photo.png');

    expect(supabase.storage.from).toHaveBeenCalledWith('message-images');
    expect(createSignedUrl).toHaveBeenCalledWith('42/12/photo.png', 3600);
    expect(url).toBe('https://signed.example/refreshed.png');
  });

  it('subscribes to Supabase Realtime and maps row payloads into message events', async () => {
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
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: 'https://signed.example/realtime.png' },
      error: null,
    });
    supabase.storage.from.mockReturnValue({ createSignedUrl });

    const unsubscribe = authApi.subscribeToMessages(42, handlers);

    await insertHandler({
      new: {
        id: 88,
        sender_id: 12,
        receiver_id: 42,
        content: 'Incoming',
        message_type: 'text',
        deck_data: null,
        image_url: null,
        image_path: '12/42/realtime.png',
        is_edited: 0,
        is_read: 0,
        created_at: '2026-03-13T12:15:00.000Z',
      },
    });

    await updateHandler({
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

    await deleteHandler({
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
      imagePath: '12/42/realtime.png',
      imageUrl: 'https://signed.example/realtime.png',
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

  it('loads group messages chronologically even when the RPC returns newest first', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(buildJsonResponse({ id: 42, username: 'avery', avatar: '/me.png' }));
    supabase.rpc.mockResolvedValue({
      data: [
        {
          id: 'newer',
          group_id: 'group-1',
          sender_id: 12,
          sender_username: 'bianca',
          sender_avatar: '/bianca.png',
          content: 'newer',
          is_edited: false,
          created_at: '2026-06-01T17:05:00.000Z',
        },
        {
          id: 'older',
          group_id: 'group-1',
          sender_id: 42,
          sender_username: 'avery',
          sender_avatar: '/me.png',
          content: 'older',
          is_edited: false,
          created_at: '2026-06-01T17:00:00.000Z',
        },
      ],
      error: null,
    });

    const messages = await authApi.getGroupMessages('group-1');

    expect(supabase.rpc).toHaveBeenCalledWith('list_group_messages', {
      target_group_id: 'group-1',
      before_id: null,
      page_limit: 50,
    });
    expect(messages.map((message) => message.id)).toEqual(['older', 'newer']);
  });

  it('tracks group typing state through Supabase Presence', async () => {
    const syncHandler = vi.fn();
    const track = vi.fn().mockResolvedValue(undefined);
    const untrack = vi.fn();
    const presenceState = vi.fn(() => ({
      'user-12': [{ userId: 12, isTyping: true }],
      'user-42': [{ userId: 42, isTyping: true }],
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

    const onTypingUsersChange = vi.fn();
    const typing = authApi.subscribeToGroupTypingPresence('group-1', 42, {
      onTypingUsersChange,
    });

    await Promise.resolve();

    expect(supabase.channel).toHaveBeenCalledWith('group_typing_group-1', expect.any(Object));
    expect(track).toHaveBeenCalledWith({ userId: 42, isTyping: false });

    syncHandler();
    expect(onTypingUsersChange).toHaveBeenCalledWith([12]);
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

  it('no-ops group typing presence when inputs are missing', async () => {
    const typing = authApi.subscribeToGroupTypingPresence('', 'not-a-user', {
      onTypingUsersChange: vi.fn(),
    });

    await expect(typing.startTyping()).resolves.toBeUndefined();
    await expect(typing.stopTyping()).resolves.toBeUndefined();
    typing.unsubscribe();

    expect(supabase.channel).not.toHaveBeenCalled();
  });
});
