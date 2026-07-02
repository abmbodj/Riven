const SHARED_RESOURCE_KINDS = new Set(['deck', 'note', 'guide']);
const SUPPORTED_NODE_TYPES = new Set([
    'doc',
    'paragraph',
    'heading',
    'text',
    'bulletList',
    'orderedList',
    'listItem',
    'blockquote',
    'codeBlock',
    'hardBreak',
    'horizontalRule',
    'table',
    'tableRow',
    'tableHeader',
    'tableCell',
]);
const INLINE_NODE_TYPES = new Set(['text', 'hardBreak']);
const TEXTBLOCK_NODE_TYPES = new Set(['paragraph', 'heading', 'codeBlock']);
const BLOCK_NODE_TYPES = new Set([
    'paragraph',
    'heading',
    'bulletList',
    'orderedList',
    'listItem',
    'blockquote',
    'codeBlock',
    'horizontalRule',
    'table',
]);
const TABLE_CELL_NODE_TYPES = new Set(['tableCell', 'tableHeader']);
const SUPPORTED_MARK_TYPES = new Set(['bold', 'italic', 'strike', 'code']);

export const EMPTY_RICH_TEXT_DOC = Object.freeze({
    type: 'doc',
    content: Object.freeze([]),
});

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

const cloneJsonObject = (value) => {
    if (!value || typeof value !== 'object') return {};

    if (typeof structuredClone === 'function') {
        return structuredClone(value);
    }

    return JSON.parse(JSON.stringify(value));
};

const textToDoc = (text) => {
    const normalized = typeof text === 'string' ? text.trim() : '';
    if (!normalized) return cloneJsonObject(EMPTY_RICH_TEXT_DOC);

    return {
        type: 'doc',
        content: [
            {
                type: 'paragraph',
                content: [{ type: 'text', text: normalized }],
            },
        ],
    };
};

const filterMarks = (marks) => {
    if (!Array.isArray(marks)) return undefined;

    const filtered = marks
        .filter((mark) => SUPPORTED_MARK_TYPES.has(mark?.type))
        .map((mark) => ({
            type: mark.type,
            ...(mark.attrs && typeof mark.attrs === 'object' ? { attrs: cloneJsonObject(mark.attrs) } : {}),
        }));

    return filtered.length ? filtered : undefined;
};

const normalizeHeadingAttrs = (attrs) => {
    const level = Number(attrs?.level);
    if ([1, 2, 3].includes(level)) return { ...(attrs || {}), level };
    return { ...(attrs || {}), level: 2 };
};

const normalizeAttrs = (node) => {
    if (node.type === 'heading') return normalizeHeadingAttrs(node.attrs);
    if (!node.attrs || typeof node.attrs !== 'object') return undefined;
    return cloneJsonObject(node.attrs);
};

const extractTextValue = (value) => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (typeof value.text === 'string') return value.text;
    if (typeof value.content === 'string') return value.content;
    if (!Array.isArray(value.content)) return '';
    return value.content.map(extractTextValue).filter(Boolean).join(' ');
};

const appendBlockFromInline = (blocks, inlineNodes) => {
    if (!inlineNodes.length) return;
    blocks.push({ type: 'paragraph', content: inlineNodes });
};

const sanitizeInlineNodes = (nodes) => {
    if (!Array.isArray(nodes)) {
        const text = extractTextValue({ content: nodes });
        return text ? [{ type: 'text', text }] : [];
    }

    const inlineNodes = [];

    for (const node of nodes) {
        if (!node || typeof node !== 'object') {
            if (typeof node === 'string' && node.trim()) {
                inlineNodes.push({ type: 'text', text: node.trim() });
            }
            continue;
        }

        if (node.type === 'text') {
            if (typeof node.text !== 'string' || !node.text) continue;
            const textNode = { type: 'text', text: node.text };
            const marks = filterMarks(node.marks);
            if (marks) textNode.marks = marks;
            inlineNodes.push(textNode);
            continue;
        }

        if (node.type === 'hardBreak') {
            inlineNodes.push({ type: 'hardBreak' });
            continue;
        }

        const text = extractTextValue(node);
        if (text) inlineNodes.push({ type: 'text', text });
    }

    return inlineNodes;
};

const sanitizeTableRowCells = (nodes) => {
    if (!Array.isArray(nodes)) return [];

    return nodes
        .filter((node) => node && typeof node === 'object' && TABLE_CELL_NODE_TYPES.has(node.type))
        .map((node) => {
            const content = sanitizeBlockNodes(node.content);
            return {
                type: node.type,
                ...(normalizeAttrs(node) ? { attrs: normalizeAttrs(node) } : {}),
                content: content.length ? content : [{ type: 'paragraph', content: [] }],
            };
        });
};

function sanitizeBlockNode(node) {
    if (!node || typeof node !== 'object') {
        if (typeof node === 'string' && node.trim()) {
            return [{ type: 'paragraph', content: [{ type: 'text', text: node.trim() }] }];
        }
        return [];
    }

    if (!SUPPORTED_NODE_TYPES.has(node.type)) {
        if (Array.isArray(node.content)) return sanitizeBlockNodes(node.content);
        const text = extractTextValue(node);
        return text ? textToDoc(text).content : [];
    }

    if (node.type === 'doc') {
        return sanitizeBlockNodes(node.content);
    }

    if (INLINE_NODE_TYPES.has(node.type)) {
        return [{ type: 'paragraph', content: sanitizeInlineNodes([node]) }];
    }

    if (TEXTBLOCK_NODE_TYPES.has(node.type)) {
        const content = sanitizeInlineNodes(node.content);
        const normalized = { type: node.type };
        const attrs = normalizeAttrs(node);
        if (attrs) normalized.attrs = attrs;
        if (content.length) normalized.content = content;
        return [normalized];
    }

    if (node.type === 'horizontalRule') {
        return [{ type: 'horizontalRule' }];
    }

    if (node.type === 'table') {
        const rows = Array.isArray(node.content)
            ? node.content
                .filter((row) => row?.type === 'tableRow')
                .map((row) => ({ type: 'tableRow', content: sanitizeTableRowCells(row.content) }))
                .filter((row) => row.content.length)
            : [];
        return rows.length ? [{ type: 'table', content: rows }] : [];
    }

    if (node.type === 'tableRow') {
        const cells = sanitizeTableRowCells(node.content);
        return cells.length ? [{ type: 'tableRow', content: cells }] : [];
    }

    if (TABLE_CELL_NODE_TYPES.has(node.type)) {
        const content = sanitizeBlockNodes(node.content);
        return [{
            type: node.type,
            ...(normalizeAttrs(node) ? { attrs: normalizeAttrs(node) } : {}),
            content: content.length ? content : [{ type: 'paragraph', content: [] }],
        }];
    }

    if (node.type === 'bulletList' || node.type === 'orderedList') {
        const items = Array.isArray(node.content)
            ? node.content
                .filter((child) => child?.type === 'listItem')
                .flatMap(sanitizeBlockNode)
            : [];
        return items.length ? [{ type: node.type, content: items }] : [];
    }

    if (node.type === 'listItem' || node.type === 'blockquote') {
        const content = sanitizeBlockNodes(node.content);
        return content.length ? [{ type: node.type, content }] : [];
    }

    return [];
}

function sanitizeBlockNodes(nodes) {
    if (!Array.isArray(nodes)) return [];

    const blocks = [];
    const pendingInline = [];

    for (const node of nodes) {
        if (node && typeof node === 'object' && INLINE_NODE_TYPES.has(node.type)) {
            pendingInline.push(...sanitizeInlineNodes([node]));
            continue;
        }

        if (node && typeof node === 'object' && BLOCK_NODE_TYPES.has(node.type)) {
            appendBlockFromInline(blocks, pendingInline.splice(0));
            blocks.push(...sanitizeBlockNode(node));
            continue;
        }

        const sanitized = sanitizeBlockNode(node);
        if (sanitized.length) {
            appendBlockFromInline(blocks, pendingInline.splice(0));
            blocks.push(...sanitized);
        }
    }

    appendBlockFromInline(blocks, pendingInline);
    return blocks;
}

export const normalizeRichTextDoc = (value) => {
    if (!value) return cloneJsonObject(EMPTY_RICH_TEXT_DOC);
    if (typeof value === 'string') return textToDoc(value);
    if (typeof value !== 'object') return cloneJsonObject(EMPTY_RICH_TEXT_DOC);

    const content = Array.isArray(value)
        ? sanitizeBlockNodes(value)
        : value.type === 'doc'
            ? sanitizeBlockNodes(value.content)
            : sanitizeBlockNode(value);

    return {
        type: 'doc',
        content: content.length ? content : [],
    };
};

const isSharedResourceKind = (kind) => SHARED_RESOURCE_KINDS.has(kind);

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
    return cloneJsonObject(normalizeRichTextDoc(doc));
};

export const buildSharedPreviewText = (doc, maxLength = 140) => {
    const collapsed = extractTextFromDoc(normalizeRichTextDoc(doc)).replace(/\s+/g, ' ').trim();
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
    if (kind === 'study guide' || kind === 'guide') return 'tutor session';
    return kind;
};


export const getSharedResourceRoute = (kind, resourceId) => {
    if (resourceId === null || resourceId === undefined) return null;
    if (kind === 'deck') return `/deck/${resourceId}`;
    if (kind === 'note') return `/note/${resourceId}`;
    if (kind === 'guide') return `/guide/${resourceId}`;
    return null;
};

export const getSharedResourceCta = (kind) => {
    if (kind === 'deck') return 'Add to Collection';
    if (kind === 'note') return 'Add to Notes';
    if (kind === 'guide') return 'Add to Tutor Sessions';
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
