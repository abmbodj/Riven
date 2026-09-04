import { describe, expect, it, vi } from 'vitest';

import { extractPdfText } from './pdfText.js';

describe('extractPdfText', () => {
  it('preserves page boundaries and caps extracted source text', async () => {
    const pages = [
      { getTextContent: vi.fn(async () => ({ items: [{ str: 'Cellular' }, { str: 'respiration' }] })) },
      { getTextContent: vi.fn(async () => ({ items: [{ str: 'ATP' }, { str: 'yield' }] })) },
    ];
    const getDocumentImpl = vi.fn(() => ({ promise: Promise.resolve({
      numPages: 2,
      getPage: (pageNumber) => pages[pageNumber - 1],
      destroy: vi.fn(async () => {}),
    }) }));

    const result = await extractPdfText(new Blob(['pdf']), { getDocumentImpl, maxCharacters: 40 });

    expect(result).toBe('Page 1\nCellular respiration\n\nPage 2\nATP');
    expect(getDocumentImpl).toHaveBeenCalledWith(expect.objectContaining({ data: expect.any(Uint8Array) }));
  });
});
