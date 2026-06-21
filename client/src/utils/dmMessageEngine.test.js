import { describe, expect, it } from 'vitest';
import { buildOptimisticMessage, reduceDmMessages } from './dmMessageEngine';

const currentUser = { id: 42, username: 'avery', avatar: '/me.png' };

describe('dmMessageEngine', () => {
  it('hydrates messages chronologically with delivery status defaults', () => {
    const messages = reduceDmMessages([], {
      type: 'hydrate',
      messages: [
        { id: 2, senderId: 12, receiverId: 42, content: 'newer', createdAt: '2026-03-13T12:02:00.000Z', isMine: false },
        { id: 1, senderId: 42, receiverId: 12, content: 'older', createdAt: '2026-03-13T12:01:00.000Z', isMine: true },
      ],
    });

    expect(messages.map((message) => message.id)).toEqual([1, 2]);
    expect(messages[0].deliveryStatus).toBe('sent');
    expect(messages[1].deliveryStatus).toBe('received');
  });

  it('adds an optimistic send and reconciles the server ack by clientMessageId', () => {
    const optimistic = buildOptimisticMessage({
      clientMessageId: 'client-1',
      currentUser,
      partnerId: 12,
      content: 'hello',
      createdAt: '2026-03-13T12:01:00.000Z',
    });

    const pending = reduceDmMessages([], { type: 'optimistic_send', message: optimistic });
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({
      id: null,
      clientMessageId: 'client-1',
      deliveryStatus: 'sending',
      content: 'hello',
    });

    const acknowledged = reduceDmMessages(pending, {
      type: 'server_ack',
      message: {
        id: 77,
        clientMessageId: 'client-1',
        senderId: 42,
        receiverId: 12,
        content: 'hello',
        createdAt: '2026-03-13T12:01:01.000Z',
        isMine: true,
        deliveryStatus: 'sent',
      },
    });

    expect(acknowledged).toHaveLength(1);
    expect(acknowledged[0]).toMatchObject({
      id: 77,
      clientMessageId: 'client-1',
      deliveryStatus: 'sent',
    });
  });

  it('dedupes realtime echoes for acknowledged optimistic messages', () => {
    const current = reduceDmMessages([], {
      type: 'server_ack',
      message: {
        id: 77,
        clientMessageId: 'client-1',
        senderId: 42,
        receiverId: 12,
        content: 'hello',
        createdAt: '2026-03-13T12:01:01.000Z',
        isMine: true,
        deliveryStatus: 'sent',
      },
    });

    const echoed = reduceDmMessages(current, {
      type: 'realtime_insert',
      message: {
        id: 77,
        clientMessageId: 'client-1',
        senderId: 42,
        receiverId: 12,
        content: 'hello',
        createdAt: '2026-03-13T12:01:01.000Z',
        isMine: true,
        deliveryStatus: 'sent',
      },
    });

    expect(echoed).toHaveLength(1);
  });

  it('marks failed sends as retryable and resets them on retry', () => {
    const optimistic = buildOptimisticMessage({
      clientMessageId: 'client-2',
      currentUser,
      partnerId: 12,
      content: 'will fail',
    });

    const failed = reduceDmMessages([optimistic], {
      type: 'send_failed',
      clientMessageId: 'client-2',
      error: new Error('network down'),
    });

    expect(failed[0]).toMatchObject({
      deliveryStatus: 'failed',
      sendError: 'network down',
    });

    const retrying = reduceDmMessages(failed, {
      type: 'retry',
      clientMessageId: 'client-2',
    });

    expect(retrying[0]).toMatchObject({
      deliveryStatus: 'sending',
      sendError: null,
    });
  });

  it('updates read state without duplicating messages', () => {
    const current = reduceDmMessages([], {
      type: 'hydrate',
      messages: [
        { id: 88, senderId: 42, receiverId: 12, content: 'read me', createdAt: '2026-03-13T12:02:00.000Z', isMine: true },
      ],
    });

    const read = reduceDmMessages(current, {
      type: 'read_state',
      message: {
        id: 88,
        isMine: true,
        isRead: true,
        readAt: '2026-03-13T12:03:00.000Z',
        deliveryStatus: 'read',
      },
    });

    expect(read).toHaveLength(1);
    expect(read[0]).toMatchObject({
      id: 88,
      isRead: true,
      deliveryStatus: 'read',
    });
  });
});
