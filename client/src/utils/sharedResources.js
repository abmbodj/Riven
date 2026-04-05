const SHARED_RESOURCE_KINDS = new Set(['deck', 'note', 'guide']);

const normalizeId = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') return value;
    return null;
};

const normalizeText = (value) => {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed || null;
};

export const isSharedResourceKind = (kind) => SHARED_RESOURCE_KINDS.has(kind);

export const isSharedMessageType = (messageType) => isSharedResourceKind(messageType);

export const extractTextFromDoc = (doc) => {
    if (!doc || typeof doc !== 'object') return '';

    const texts = [];
    const walk = (nodes) => {
        if (!Array.isArray(nodes)) return;

        for (const node of nodes) {
            if (typeof node?.text === 'string') {
                texts.push(node.text);
            }

            if (Array.isArray(node?.content)) {
                walk(node.content);
            }
        }
    };

    walk(doc.content);
    return texts.join('\n');
};

export const cloneRichTextDoc = (doc) => {
    if (!doc || typeof doc !== 'object') {
        return {};
    }

    if (typeof structuredClone === 'function') {
        return structuredClone(doc);
    }

    return JSON.parse(JSON.stringify(doc));
};

export const buildSharedPreviewText = (doc, maxLength = 140) => {
    const collapsed = extractTextFromDoc(doc).replace(/\s+/g, ' ').trim();
    if (!collapsed) return null;
    if (collapsed.length <= maxLength) return collapsed;
    return `${collapsed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
};

export const normalizeSharedPayload = (rawPayload, fallbackKind = null) => {
    if (!rawPayload || typeof rawPayload !== 'object') return null;

    const kind = isSharedResourceKind(rawPayload.kind)
        ? rawPayload.kind
        : (isSharedResourceKind(fallbackKind) ? fallbackKind : null);
    const sourceId = normalizeId(rawPayload.sourceId ?? rawPayload.id);

    if (!kind || sourceId === null) {
        return null;
    }

    const acceptedId = normalizeId(
        rawPayload.acceptedId
        ?? rawPayload.acceptedDeckId
        ?? rawPayload.acceptedNoteId
        ?? rawPayload.acceptedGuideId,
    );
    const title = normalizeText(rawPayload.title) || 'Untitled';
    const previewText = normalizeText(rawPayload.previewText);
    const parsedCardCount = Number(rawPayload.cardCount);
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

export const serializeSharedPayload = ({
    kind,
    sourceId,
    title,
    previewText = null,
    cardCount = null,
    acceptedId = null,
}) => {
    if (!isSharedResourceKind(kind)) {
        return null;
    }

    const normalizedSourceId = normalizeId(sourceId);
    if (normalizedSourceId === null) {
        return null;
    }

    const payload = {
        kind,
        sourceId: normalizedSourceId,
        id: normalizedSourceId,
        title: normalizeText(title) || 'Untitled',
    };

    const normalizedPreview = normalizeText(previewText);
    if (normalizedPreview) {
        payload.previewText = normalizedPreview;
    }

    if (cardCount !== null && cardCount !== undefined && cardCount !== '') {
        const parsedCardCount = Number(cardCount);
        if (Number.isFinite(parsedCardCount)) {
            payload.cardCount = parsedCardCount;
        }
    }

    const normalizedAcceptedId = normalizeId(acceptedId);
    if (normalizedAcceptedId !== null) {
        payload.acceptedId = normalizedAcceptedId;

        if (kind === 'deck') payload.acceptedDeckId = normalizedAcceptedId;
        if (kind === 'note') payload.acceptedNoteId = normalizedAcceptedId;
        if (kind === 'guide') payload.acceptedGuideId = normalizedAcceptedId;
    }

    return payload;
};

export const buildShareMessageContent = (kind, title) => {
    const normalizedKind = normalizeText(kind) || 'item';
    const normalizedTitle = normalizeText(title) || 'Untitled';
    const article = /^[aeiou]/i.test(normalizedKind) ? 'an' : 'a';
    return `Shared ${article} ${normalizedKind}: ${normalizedTitle}`;
};

export const getSharedResourceLabel = (kind) => {
    if (!isSharedResourceKind(kind)) return 'item';
    if (kind === 'study guide' || kind === 'guide') return 'exam coach';
    return kind;
};

export const getSharedResourcePluralLabel = (kind) => {
    if (kind === 'study guide' || kind === 'guide') return 'exam coaches';
    if (kind === 'note') return 'notes';
    if (kind === 'deck') return 'decks';
    return 'items';
};

export const getSharedResourceRoute = (kind, resourceId) => {
    if (resourceId === null || resourceId === undefined) return null;
    if (kind === 'deck') return `/deck/${resourceId}`;
    if (kind === 'note') return `/note/${resourceId}`;
    if (kind === 'guide') return `/guide/${resourceId}`;
    return null;
};

export const getSharedResourceVerb = (kind) => {
    if (kind === 'deck') return 'deck';
    if (kind === 'note') return 'note';
    if (kind === 'guide') return 'exam coach';
    return 'item';
};

export const getSharedResourceCta = (kind) => {
    if (kind === 'deck') return 'Add to Collection';
    if (kind === 'note') return 'Add to Notes';
    if (kind === 'guide') return 'Add to Exam Coach';
    return 'Add';
};

export const getSharedResourceOpenLabel = (kind, accepted = false) => {
    if (kind === 'deck') {
        return accepted ? 'View in Collection' : 'View Deck';
    }
    if (kind === 'note') {
        return accepted ? 'Open Imported Note' : 'Open Note';
    }
    if (kind === 'guide') {
        return accepted ? 'Open Imported Coach' : 'Open Coach';
    }
    return 'Open';
};
