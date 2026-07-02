import { describe, expect, it } from 'vitest';

import {
    EMPTY_RICH_TEXT_DOC,
    extractTextFromDoc,
    normalizeRichTextDoc,
} from './sharedResources.js';

describe('normalizeRichTextDoc', () => {
    it('normalizes empty or non-object values to an empty document', () => {
        expect(normalizeRichTextDoc(null)).toEqual(EMPTY_RICH_TEXT_DOC);
        expect(normalizeRichTextDoc({})).toEqual(EMPTY_RICH_TEXT_DOC);
        expect(normalizeRichTextDoc(42)).toEqual(EMPTY_RICH_TEXT_DOC);
    });

    it('turns plain text into a paragraph document', () => {
        expect(normalizeRichTextDoc('  Intro notes  ')).toEqual({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Intro notes' }],
                },
            ],
        });
    });

    it('preserves supported Tiptap documents', () => {
        const doc = {
            type: 'doc',
            content: [
                {
                    type: 'heading',
                    attrs: { level: 2 },
                    content: [{ type: 'text', text: 'Chapter 1', marks: [{ type: 'bold' }] }],
                },
                { type: 'horizontalRule' },
            ],
        };

        expect(normalizeRichTextDoc(doc)).toEqual(doc);
    });

    it('recovers text from malformed nodes without preserving unsupported node types', () => {
        const normalized = normalizeRichTextDoc({
            type: 'doc',
            content: [
                { text: 'Loose text' },
                {
                    type: 'unsupportedBlock',
                    content: [
                        {
                            type: 'paragraph',
                            content: [{ text: 'Nested text without a type' }],
                        },
                    ],
                },
            ],
        });

        expect(extractTextFromDoc(normalized)).toContain('Loose text');
        expect(extractTextFromDoc(normalized)).toContain('Nested text without a type');
        expect(JSON.stringify(normalized)).not.toContain('unsupportedBlock');
    });

    it('filters unsupported marks that would break the editor schema', () => {
        expect(normalizeRichTextDoc({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'Marked',
                            marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://example.com' } }],
                        },
                    ],
                },
            ],
        })).toEqual({
            type: 'doc',
            content: [
                {
                    type: 'paragraph',
                    content: [
                        {
                            type: 'text',
                            text: 'Marked',
                            marks: [{ type: 'bold' }],
                        },
                    ],
                },
            ],
        });
    });
});
