import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import FileViewer from './FileViewer.jsx';

const reactPdfState = vi.hoisted(() => ({
    pages: {
        1: { originalWidth: 800, originalHeight: 1200 },
        2: { originalWidth: 800, originalHeight: 1200 },
        3: { originalWidth: 800, originalHeight: 1200 },
    },
}));

vi.mock('react-pdf', async () => {
    const ReactModule = await import('react');

    return {
        pdfjs: {
            GlobalWorkerOptions: {},
        },
        Document: ({ children, onLoadSuccess }) => {
            ReactModule.useEffect(() => {
                onLoadSuccess?.({ numPages: 3 });
            }, [onLoadSuccess]);

            return <div data-testid="mock-pdf-document">{children}</div>;
        },
        Page: ({ pageNumber, width, onLoadSuccess }) => {
            ReactModule.useEffect(() => {
                const page = reactPdfState.pages[pageNumber] || reactPdfState.pages[1];
                onLoadSuccess?.({
                    pageNumber,
                    originalWidth: page.originalWidth,
                    originalHeight: page.originalHeight,
                });
            }, [onLoadSuccess, pageNumber]);

            return (
                <div
                    data-testid="mock-pdf-page"
                    data-page-number={String(pageNumber)}
                    data-width={String(width)}
                />
            );
        },
    };
});

const pdfFile = {
    name: 'lecture-notes.pdf',
    url: 'https://example.com/lecture-notes.pdf',
    file_type: 'pdf',
};

const viewportSizes = {
    'file-viewer-pdf-viewport': { width: 0, height: 0 },
};

const resizeObserverInstances = new Set();
const originalClientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const originalClientHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
const originalResizeObserver = globalThis.ResizeObserver;

function setMatchMedia(isMobile) {
    window.matchMedia = vi.fn((query) => ({
        matches: query === '(max-width: 767px)' ? isMobile : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
}

function setPdfViewportSize(width, height) {
    viewportSizes['file-viewer-pdf-viewport'] = { width, height };
}

function triggerResizeObservers() {
    for (const instance of resizeObserverInstances) {
        instance.callback([]);
    }
}

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
        configurable: true,
        get() {
            const testId = this.dataset?.testid;
            if (testId && viewportSizes[testId]) {
                return viewportSizes[testId].width;
            }

            return originalClientWidthDescriptor?.get ? originalClientWidthDescriptor.get.call(this) : 0;
        },
    });

    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
        configurable: true,
        get() {
            const testId = this.dataset?.testid;
            if (testId && viewportSizes[testId]) {
                return viewportSizes[testId].height;
            }

            return originalClientHeightDescriptor?.get ? originalClientHeightDescriptor.get.call(this) : 0;
        },
    });

    globalThis.ResizeObserver = class MockResizeObserver {
        constructor(callback) {
            this.callback = callback;
            resizeObserverInstances.add(this);
        }

        observe = vi.fn();

        disconnect = vi.fn(() => {
            resizeObserverInstances.delete(this);
        });
    };
});

afterAll(() => {
    if (originalClientWidthDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'clientWidth', originalClientWidthDescriptor);
    }

    if (originalClientHeightDescriptor) {
        Object.defineProperty(HTMLElement.prototype, 'clientHeight', originalClientHeightDescriptor);
    }

    globalThis.ResizeObserver = originalResizeObserver;
});

beforeEach(() => {
    reactPdfState.pages = {
        1: { originalWidth: 800, originalHeight: 1200 },
        2: { originalWidth: 800, originalHeight: 1200 },
        3: { originalWidth: 800, originalHeight: 1200 },
    };
    setPdfViewportSize(0, 0);
    setMatchMedia(false);
    resizeObserverInstances.clear();
});

describe('FileViewer PDF sizing', () => {
    it('keeps width-fit sizing on desktop', async () => {
        setMatchMedia(false);
        setPdfViewportSize(820, 620);

        render(<FileViewer file={pdfFile} isOpen onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-pdf-page')).toHaveAttribute('data-width', '820');
        });
    });

    it('fits the full PDF page on mobile when height is the limiting dimension', async () => {
        setMatchMedia(true);
        setPdfViewportSize(320, 360);

        render(<FileViewer file={pdfFile} isOpen onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-pdf-page')).toHaveAttribute('data-width', '240');
        });
    });

    it('applies zoom on top of the mobile fit baseline', async () => {
        setMatchMedia(true);
        setPdfViewportSize(320, 360);

        render(<FileViewer file={pdfFile} isOpen onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-pdf-page')).toHaveAttribute('data-width', '240');
        });

        fireEvent.click(screen.getByRole('button', { name: /zoom in/i }));

        await waitFor(() => {
            expect(screen.getByTestId('mock-pdf-page')).toHaveAttribute('data-width', '288');
        });

        expect(screen.getByText('120%')).toBeInTheDocument();
    });

    it('recomputes the mobile fit width when the PDF viewport resizes', async () => {
        setMatchMedia(true);
        setPdfViewportSize(320, 360);

        render(<FileViewer file={pdfFile} isOpen onClose={vi.fn()} />);

        await waitFor(() => {
            expect(screen.getByTestId('mock-pdf-page')).toHaveAttribute('data-width', '240');
        });

        setPdfViewportSize(400, 600);

        act(() => {
            triggerResizeObservers();
        });

        await waitFor(() => {
            expect(screen.getByTestId('mock-pdf-page')).toHaveAttribute('data-width', '400');
        });
    });
});
