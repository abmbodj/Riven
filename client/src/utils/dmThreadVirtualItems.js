import { isSharedMessageType } from './sharedResources';

function isSameDay(a, b) {
    const da = new Date(a);
    const db = new Date(b);
    return (
        da.getFullYear() === db.getFullYear() &&
        da.getMonth() === db.getMonth() &&
        da.getDate() === db.getDate()
    );
}

function estimateMessageSize(message, hasReply = false) {
    if (!message) return 72;

    const textLength = String(message.content || '').length;
    const estimatedTextLines = Math.min(Math.ceil(textLength / 34), 5);
    const hasAttachment = Boolean(message.imageUrl || message.imagePath);
    const hasSharedResource = isSharedMessageType(message.messageType) && message.sharedResource;

    if (hasSharedResource) {
        return hasReply ? 248 : 188;
    }

    if (hasAttachment) {
        return 310 + (textLength ? Math.max(36, estimatedTextLines * 20) : 0) + (hasReply ? 64 : 0);
    }

    return Math.max(72, 58 + (estimatedTextLines * 18) + (hasReply ? 62 : 0));
}

export function buildVirtualItems(messages) {
    const items = [];
    const GROUP_GAP_MS = 5 * 60 * 1000;

    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        const prev = messages[i - 1];

        if (!prev || !isSameDay(prev.createdAt, msg.createdAt)) {
            items.push({ type: 'divider', date: msg.createdAt });
        }

        const nextMsg = messages[i + 1];
        const sameSenderAsPrev =
            prev &&
            prev.isMine === msg.isMine &&
            isSameDay(prev.createdAt, msg.createdAt) &&
            new Date(msg.createdAt) - new Date(prev.createdAt) < GROUP_GAP_MS;
        const sameSenderAsNext =
            nextMsg &&
            nextMsg.isMine === msg.isMine &&
            new Date(nextMsg.createdAt) - new Date(msg.createdAt) < GROUP_GAP_MS;
        const hasReply = Boolean(msg.replyToId);
        const isFirst = !sameSenderAsPrev || hasReply;
        const isLast = !sameSenderAsNext;

        items.push({
            type: 'message',
            index: i,
            isFirst,
            isLast,
            estimatedSize: estimateMessageSize(msg, hasReply),
        });
    }

    return items;
}

export function estimateVirtualItemSize(item) {
    return item?.type === 'divider' ? 52 : item?.estimatedSize || 72;
}

export function buildEstimatedRows(items) {
    let start = 0;
    return items.map((item, index) => {
        const size = estimateVirtualItemSize(item);
        const row = { index, start, size };
        start += size;
        return row;
    });
}
