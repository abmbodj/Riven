export function createClientMessageId() {
    return globalThis.crypto?.randomUUID?.()
        || `dm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function messageKey(message) {
    if (!message) return null;
    if (message.clientMessageId) return `client:${message.clientMessageId}`;
    if (message.id !== null && message.id !== undefined) return `id:${message.id}`;
    return null;
}

function sameMessage(left, right) {
    if (!left || !right) return false;
    if (left.clientMessageId && right.clientMessageId && left.clientMessageId === right.clientMessageId) return true;
    if (left.id !== null && left.id !== undefined && right.id !== null && right.id !== undefined && left.id === right.id) return true;
    return false;
}

function normalizeStatus(message) {
    if (message.deliveryStatus) return message.deliveryStatus;
    if (!message.isMine) return 'received';
    if (message.isRead || message.readAt) return 'read';
    if (message.deliveredAt) return 'delivered';
    return message.id ? 'sent' : 'sending';
}

function normalizeMessage(message) {
    if (!message) return message;
    const normalized = {
        ...message,
        clientMessageId: message.clientMessageId || null,
        deliveredAt: message.deliveredAt || null,
        readAt: message.readAt || null,
        deliveryStatus: normalizeStatus(message),
    };
    normalized.isRead = Boolean(normalized.isRead || normalized.readAt);
    return normalized;
}

function messageTime(message) {
    const time = new Date(message?.createdAt || 0).getTime();
    return Number.isFinite(time) ? time : 0;
}

function sortMessages(messages) {
    return [...messages].sort((left, right) => {
        const timeDelta = messageTime(left) - messageTime(right);
        if (timeDelta !== 0) return timeDelta;
        return String(left.id || left.clientMessageId || '').localeCompare(String(right.id || right.clientMessageId || ''));
    });
}

function upsertMessage(messages, incoming, merge = true) {
    const normalizedIncoming = normalizeMessage(incoming);
    const index = messages.findIndex((message) => sameMessage(message, normalizedIncoming));
    if (index === -1) return sortMessages([...messages, normalizedIncoming]);

    const next = [...messages];
    next[index] = merge
        ? normalizeMessage({
            ...next[index],
            ...normalizedIncoming,
            localImagePreview: normalizedIncoming.localImagePreview || next[index].localImagePreview || null,
            sendError: normalizedIncoming.sendError ?? null,
        })
        : normalizedIncoming;
    return sortMessages(next);
}

export function buildOptimisticMessage({
    clientMessageId = createClientMessageId(),
    currentUser,
    partnerId,
    content = '',
    imagePreview = null,
    imagePath = null,
    replyTarget = null,
    createdAt = new Date().toISOString(),
}) {
    return normalizeMessage({
        id: null,
        clientMessageId,
        senderId: currentUser?.id,
        receiverId: Number(partnerId),
        senderUsername: currentUser?.username || null,
        senderAvatar: currentUser?.avatar || null,
        content: content || '',
        messageType: 'text',
        sharedResource: null,
        deckData: null,
        imageUrl: imagePreview || null,
        imagePath: imagePath || null,
        localImagePreview: imagePreview || null,
        imageLoadError: false,
        isEdited: false,
        isRead: false,
        deliveredAt: null,
        readAt: null,
        deliveryStatus: 'sending',
        replyToId: replyTarget?.id || null,
        replyTo: replyTarget || null,
        createdAt,
        isMine: true,
        sendError: null,
    });
}

export function reduceDmMessages(messages = [], action = {}) {
    const current = Array.isArray(messages) ? messages.map(normalizeMessage) : [];

    switch (action.type) {
        case 'hydrate':
            return sortMessages((action.messages || []).map(normalizeMessage));

        case 'optimistic_send':
            return upsertMessage(current, {
                ...action.message,
                deliveryStatus: action.message?.deliveryStatus || 'sending',
                sendError: null,
            });

        case 'server_ack':
        case 'realtime_insert':
            return upsertMessage(current, {
                ...action.message,
                deliveryStatus: action.message?.deliveryStatus || (action.message?.isMine ? 'sent' : 'received'),
                sendError: null,
            });

        case 'realtime_update':
        case 'read_state':
            return upsertMessage(current, action.message || action.patch);

        case 'send_failed':
            return current.map((message) => {
                if (!sameMessage(message, action.message || { clientMessageId: action.clientMessageId, id: action.id })) return message;
                return normalizeMessage({
                    ...message,
                    deliveryStatus: 'failed',
                    sendError: action.error?.message || action.error || 'Failed to send',
                });
            });

        case 'retry':
            return current.map((message) => {
                if (!sameMessage(message, action.message || { clientMessageId: action.clientMessageId, id: action.id })) return message;
                return normalizeMessage({
                    ...message,
                    deliveryStatus: 'sending',
                    sendError: null,
                });
            });

        case 'delete':
            return current.filter((message) => !sameMessage(message, action.message || { clientMessageId: action.clientMessageId, id: action.id }));

        default:
            return current;
    }
}

export function getMessageIdentity(message) {
    return messageKey(message) || `created:${message?.createdAt || ''}`;
}
