import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
    X,
    Download,
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    FileText,
    ImageIcon,
    File as FileIcon,
    ExternalLink,
    FileCode,
    Video,
    Music
} from 'lucide-react';
// Heavy deps loaded dynamically to avoid bundling on pages that don't use FileViewer
let pdfModule = null;
let docxModule = null;

async function loadPdfModule() {
    if (!pdfModule) {
        const [mod] = await Promise.all([
            import('react-pdf'),
            import('react-pdf/dist/Page/AnnotationLayer.css'),
            import('react-pdf/dist/Page/TextLayer.css'),
        ]);
        mod.pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
        pdfModule = mod;
    }
    return pdfModule;
}

async function loadDocxModule() {
    if (!docxModule) {
        docxModule = await import('docx-preview');
    }
    return docxModule;
}

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'svg', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov', 'm4v', 'ogg']);
const AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
const TEXT_EXTENSIONS = new Set([
    'txt',
    'md',
    'csv',
    'json',
    'xml',
    'yml',
    'yaml',
    'log',
    'js',
    'jsx',
    'ts',
    'tsx',
    'css',
    'html'
]);
const OFFICE_EMBED_EXTENSIONS = new Set(['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx', 'odt', 'ods', 'odp']);

function getExtension(file) {
    if (file?.extension) return String(file.extension).toLowerCase();
    if (file?.name?.includes('.')) return file.name.split('.').pop().toLowerCase();

    try {
        const pathname = new URL(file?.url || '', window.location.origin).pathname;
        const candidate = pathname.split('.').pop()?.toLowerCase();
        if (candidate && candidate !== pathname.toLowerCase()) return candidate;
    } catch {
        // Ignore URL parsing issues; extension will stay empty.
    }

    return '';
}

function normalizeMime(file) {
    const rawType = String(file?.mimeType || file?.contentType || file?.type || file?.file_type || '').toLowerCase();
    if (rawType === 'image') return 'image/*';
    if (rawType === 'pdf') return 'application/pdf';
    if (rawType === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return rawType;
}

function resolveFileKind(file) {
    const extension = getExtension(file);
    const mimeType = normalizeMime(file);

    const isImage = IMAGE_EXTENSIONS.has(extension) || mimeType.startsWith('image/');
    if (isImage) return { kind: 'image', extension, mimeType };

    const isPdf = extension === 'pdf' || mimeType === 'application/pdf';
    if (isPdf) return { kind: 'pdf', extension, mimeType };

    const isDocx = extension === 'docx' || mimeType.includes('wordprocessingml.document');
    if (isDocx) return { kind: 'docx', extension, mimeType };

    const isOfficeEmbed = OFFICE_EMBED_EXTENSIONS.has(extension);
    if (isOfficeEmbed) return { kind: 'office', extension, mimeType };

    const isVideo = VIDEO_EXTENSIONS.has(extension) || mimeType.startsWith('video/');
    if (isVideo) return { kind: 'video', extension, mimeType };

    const isAudio = AUDIO_EXTENSIONS.has(extension) || mimeType.startsWith('audio/');
    if (isAudio) return { kind: 'audio', extension, mimeType };

    const isText =
        TEXT_EXTENSIONS.has(extension) ||
        mimeType.startsWith('text/') ||
        mimeType.includes('json') ||
        mimeType.includes('xml');

    if (isText) return { kind: 'text', extension, mimeType };

    return { kind: 'fallback', extension, mimeType };
}

function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
}

function getPdfRenderWidth({ availableWidth, availableHeight, pageMetrics, isMobile, zoom }) {
    const fallbackWidth = isMobile ? 280 : 796;
    const widthFitBase = availableWidth > 0 ? availableWidth : fallbackWidth;

    if (!isMobile || !pageMetrics?.originalWidth || !pageMetrics?.originalHeight || availableHeight <= 0) {
        return Math.max(Math.floor(widthFitBase * zoom), 1);
    }

    const fitScale = Math.min(
        widthFitBase / pageMetrics.originalWidth,
        availableHeight / pageMetrics.originalHeight
    );

    return Math.max(Math.floor(pageMetrics.originalWidth * fitScale * zoom), 1);
}

export default function FileViewer({ file, isOpen, onClose }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1);
    const [docxError, setDocxError] = useState(null);
    const [isDocxLoading, setIsDocxLoading] = useState(false);
    const [textContent, setTextContent] = useState('');
    const [textError, setTextError] = useState(null);
    const [isTextLoading, setIsTextLoading] = useState(false);
    const [pdfViewportSize, setPdfViewportSize] = useState({ width: 0, height: 0 });
    const [pdfPageMetrics, setPdfPageMetrics] = useState(null);
    const [PdfComponents, setPdfComponents] = useState(null);

    const docxIframeRef = useRef(null);
    const pdfContainerRef = useRef(null);
    const pdfViewportRef = useRef(null);

    const fileInfo = useMemo(() => resolveFileKind(file), [file]);
    const isMobilePdfLayout =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(max-width: 767px)').matches;
    const activePdfPageMetrics = pdfPageMetrics?.pageNumber === pageNumber ? pdfPageMetrics : null;
    const pdfRenderWidth = useMemo(() => getPdfRenderWidth({
        availableWidth: pdfViewportSize.width,
        availableHeight: pdfViewportSize.height,
        pageMetrics: activePdfPageMetrics,
        isMobile: isMobilePdfLayout,
        zoom: scale
    }), [activePdfPageMetrics, isMobilePdfLayout, pdfViewportSize.height, pdfViewportSize.width, scale]);

    useEffect(() => {
        setPageNumber(1);
        setScale(1);
        setNumPages(null);
        setDocxError(null);
        setTextError(null);
        setTextContent('');
        setPdfViewportSize({ width: 0, height: 0 });
        setPdfPageMetrics(null);
    }, [file, isOpen]);

    useEffect(() => {
        if (fileInfo.kind === 'pdf') {
            setPdfPageMetrics(null);
        }
    }, [fileInfo.kind, pageNumber]);

    // Dynamically load react-pdf when a PDF is opened
    useEffect(() => {
        if (!isOpen || fileInfo.kind !== 'pdf' || PdfComponents) return;
        let cancelled = false;
        loadPdfModule().then((mod) => {
            if (!cancelled) setPdfComponents({ Document: mod.Document, Page: mod.Page });
        });
        return () => { cancelled = true; };
    }, [isOpen, fileInfo.kind, PdfComponents]);

    useEffect(() => {
        if (!isOpen || fileInfo.kind !== 'docx' || !file?.url) return;

        let isCancelled = false;
        let blobUrl = null;
        setIsDocxLoading(true);

        const renderDocx = async () => {
            try {
                const response = await fetch(file.url);
                if (!response.ok) throw new Error('Could not fetch document');
                const arrayBuffer = await response.arrayBuffer();

                if (isCancelled) return;

                const { renderAsync } = await loadDocxModule();
                const container = document.createElement('div');
                await renderAsync(arrayBuffer, container, undefined, {
                    className: 'docx-preview',
                    inWrapper: false,
                    ignoreWidth: false,
                    ignoreHeight: false,
                });

                if (isCancelled) return;

                const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;}</style></head><body>${container.innerHTML}</body></html>`;
                const blob = new Blob([html], { type: 'text/html' });
                blobUrl = URL.createObjectURL(blob);

                if (docxIframeRef.current && !isCancelled) {
                    docxIframeRef.current.src = blobUrl;
                }
            } catch {
                if (!isCancelled) {
                    setDocxError('Unable to render this DOCX in-app.');
                }
            } finally {
                if (!isCancelled) setIsDocxLoading(false);
            }
        };

        renderDocx();

        return () => {
            isCancelled = true;
            if (blobUrl) URL.revokeObjectURL(blobUrl);
        };
    }, [isOpen, file, fileInfo.kind]);

    useEffect(() => {
        if (!isOpen || fileInfo.kind !== 'text' || !file?.url) return;

        const controller = new AbortController();
        setIsTextLoading(true);

        const loadText = async () => {
            try {
                const response = await fetch(file.url, { signal: controller.signal });
                if (!response.ok) throw new Error('Could not fetch text file');
                const text = await response.text();
                setTextContent(text.slice(0, 500000));
            } catch (error) {
                if (error.name !== 'AbortError') {
                    setTextError('Unable to preview this text file in-app.');
                }
            } finally {
                setIsTextLoading(false);
            }
        };

        loadText();

        return () => {
            controller.abort();
        };
    }, [isOpen, file, fileInfo.kind]);

    useEffect(() => {
        if (!isOpen || fileInfo.kind !== 'pdf') return;

        const measurePdfViewport = () => {
            if (!pdfViewportRef.current) return;

            const nextWidth = Math.ceil(pdfViewportRef.current.clientWidth);
            const nextHeight = Math.ceil(pdfViewportRef.current.clientHeight);

            setPdfViewportSize((current) => {
                if (current.width === nextWidth && current.height === nextHeight) {
                    return current;
                }

                return { width: nextWidth, height: nextHeight };
            });
        };

        measurePdfViewport();

        if (typeof ResizeObserver === 'function' && pdfContainerRef.current) {
            const resizeObserver = new ResizeObserver(() => {
                measurePdfViewport();
            });

            resizeObserver.observe(pdfContainerRef.current);
            return () => resizeObserver.disconnect();
        }

        window.addEventListener('resize', measurePdfViewport);
        return () => window.removeEventListener('resize', measurePdfViewport);
    }, [isOpen, fileInfo.kind]);

    if (!file) return null;

    const isPlaceholderUrl = !file.url || file.url.startsWith('file-ref://');

    const officeEmbedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url || '')}`;
    const zoomIn = () => setScale((prev) => clamp(prev + 0.2, 0.6, 3));
    const zoomOut = () => setScale((prev) => clamp(prev - 0.2, 0.6, 3));

    const fileTypeLabel =
        fileInfo.extension ||
        fileInfo.mimeType?.split('/')[1] ||
        'file';

    const renderIcon = () => {
        if (fileInfo.kind === 'image') return <ImageIcon className="w-5 h-5 text-purple-300" />;
        if (fileInfo.kind === 'pdf') return <FileText className="w-5 h-5 text-red-300" />;
        if (fileInfo.kind === 'text') return <FileCode className="w-5 h-5 text-claude-accent" />;
        if (fileInfo.kind === 'video') return <Video className="w-5 h-5 text-sky-300" />;
        if (fileInfo.kind === 'audio') return <Music className="w-5 h-5 text-amber-300" />;
        return <FileIcon className="w-5 h-5 text-zinc-300" />;
    };

    const renderActions = ({ showPaging = false } = {}) => (
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {(fileInfo.kind === 'image' || fileInfo.kind === 'pdf') && (
                <>
                    <button
                        onClick={zoomOut}
                        className="p-2.5 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 transition-colors"
                        aria-label="Zoom out"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono uppercase tracking-wider text-white/75 w-[52px] text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <button
                        onClick={zoomIn}
                        className="p-2.5 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 transition-colors"
                        aria-label="Zoom in"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                </>
            )}

            {showPaging && numPages > 1 && (
                <>
                    <button
                        onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                        disabled={pageNumber <= 1}
                        className="p-2.5 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 disabled:opacity-40 transition-colors"
                        aria-label="Previous page"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono uppercase tracking-wider text-white/80">
                        {pageNumber}/{numPages}
                    </span>
                    <button
                        onClick={() => setPageNumber((prev) => Math.min(numPages, prev + 1))}
                        disabled={pageNumber >= numPages}
                        className="p-2.5 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 disabled:opacity-40 transition-colors"
                        aria-label="Next page"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </>
            )}

            {!isPlaceholderUrl && (
                <a
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Open in new tab"
                >
                    <ExternalLink className="w-4 h-4" />
                </a>
            )}

            {!isPlaceholderUrl && (
                <a
                    href={file.url}
                    download
                    className="p-2.5 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 transition-colors"
                    aria-label="Download file"
                >
                    <Download className="w-4 h-4" />
                </a>
            )}

            <button
                onClick={onClose}
                className="p-2.5 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close viewer"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );

    const renderContent = () => {
        // Placeholder URLs (file-ref://) have no actual storage backend — show metadata card
        if (isPlaceholderUrl) {
            return (
                <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
                    <div className="w-20 h-20 rounded-3xl glass-panel flex items-center justify-center mb-4">
                        {renderIcon()}
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2 break-all">{file.name || 'Unknown File'}</h3>
                    <p className="text-xs uppercase tracking-wider text-white/55 mb-4">{fileTypeLabel}</p>
                    {file.uploaded_by_name && (
                        <p className="text-white/60 text-sm mb-2">Uploaded by {file.uploaded_by_name}</p>
                    )}
                    <div className="max-w-sm glass-panel border border-white/10 rounded-xl px-5 py-4 mt-2">
                        <p className="text-white/70 text-sm leading-relaxed">
                            File preview is not available yet. File storage will be supported in a future update.
                        </p>
                    </div>
                </div>
            );
        }

        if (fileInfo.kind === 'image') {
            return (
                <div className="h-full w-full overflow-auto custom-scrollbar p-3 sm:p-6 flex items-center justify-center">
                    <img
                        src={file.url}
                        alt={file.name || 'Image preview'}
                        className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
                        style={{ transform: `scale(${scale})`, transformOrigin: 'center center' }}
                    />
                </div>
            );
        }

        if (fileInfo.kind === 'pdf') {
            return (
                <div
                    ref={pdfContainerRef}
                    data-testid="file-viewer-pdf-container"
                    className="h-full w-full overflow-auto custom-scrollbar p-3 sm:p-6"
                >
                    <div
                        ref={pdfViewportRef}
                        data-testid="file-viewer-pdf-viewport"
                        className="min-h-full w-full flex items-start justify-center"
                    >
                        {PdfComponents ? (
                            <PdfComponents.Document
                                file={file.url}
                                onLoadSuccess={({ numPages: loadedPages }) => setNumPages(loadedPages)}
                                loading={<div className="text-white/80 text-sm">Loading PDF...</div>}
                                error={<div className="text-red-300 text-sm">Unable to display PDF preview.</div>}
                            >
                                <PdfComponents.Page
                                    pageNumber={pageNumber}
                                    width={pdfRenderWidth}
                                    onLoadSuccess={(page) => {
                                        setPdfPageMetrics((current) => {
                                            if (
                                                current?.pageNumber === page.pageNumber &&
                                                current?.originalWidth === page.originalWidth &&
                                                current?.originalHeight === page.originalHeight
                                            ) {
                                                return current;
                                            }

                                            return {
                                                pageNumber: page.pageNumber,
                                                originalWidth: page.originalWidth,
                                                originalHeight: page.originalHeight
                                            };
                                        });
                                    }}
                                    renderTextLayer
                                    renderAnnotationLayer
                                    className="shadow-2xl rounded-sm"
                                />
                            </PdfComponents.Document>
                        ) : (
                            <div className="text-white/80 text-sm">Loading PDF viewer...</div>
                        )}
                    </div>
                </div>
            );
        }

        if (fileInfo.kind === 'docx') {
            return (
                <div className="h-full w-full overflow-auto bg-white custom-scrollbar p-3 sm:p-6">
                    {isDocxLoading && <div className="text-sm text-zinc-700 mb-3">Loading DOCX preview...</div>}
                    {docxError ? (
                        <div className="max-w-lg mx-auto mt-8 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm">
                            <p>{docxError}</p>
                            <a href={file.url} target="_blank" rel="noreferrer" className="underline font-medium inline-block mt-2">
                                Open document in new tab
                            </a>
                        </div>
                    ) : (
                        <div className="mx-auto max-w-5xl bg-white rounded-lg shadow-lg p-3 sm:p-6">
                            <iframe
                                ref={docxIframeRef}
                                sandbox="allow-same-origin"
                                title="DOCX preview"
                                className="w-full min-h-[360px] border-0 rounded"
                                style={{ height: '70vh' }}
                            />
                        </div>
                    )}
                </div>
            );
        }

        if (fileInfo.kind === 'office') {
            return (
                <div className="h-full w-full p-2 sm:p-4">
                    <iframe
                        title={`Preview ${file.name || 'document'}`}
                        src={officeEmbedUrl}
                        className="w-full h-full rounded-xl border border-white/10 bg-white"
                    />
                </div>
            );
        }

        if (fileInfo.kind === 'video') {
            return (
                <div className="h-full w-full flex items-center justify-center p-3 sm:p-6">
                    <video src={file.url} controls className="max-w-full max-h-full rounded-xl shadow-2xl bg-black" />
                </div>
            );
        }

        if (fileInfo.kind === 'audio') {
            return (
                <div className="h-full w-full flex items-center justify-center p-6">
                    <div className="glass-panel border border-white/10 rounded-2xl px-6 py-5 w-full max-w-xl">
                        <p className="text-white/80 text-sm mb-4">Audio Preview</p>
                        <audio src={file.url} controls className="w-full" />
                    </div>
                </div>
            );
        }

        if (fileInfo.kind === 'text') {
            return (
                <div className="h-full w-full overflow-auto custom-scrollbar p-3 sm:p-6">
                    <div className="mx-auto max-w-6xl rounded-xl border border-white/10 bg-[#0f172a] text-slate-100 p-4 sm:p-6 min-h-[360px]">
                        {isTextLoading && <p className="text-sm text-slate-300">Loading text preview...</p>}
                        {textError && <p className="text-sm text-red-300">{textError}</p>}
                        {!isTextLoading && !textError && (
                            <pre className="whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed font-mono">
                                {textContent || 'File is empty.'}
                            </pre>
                        )}
                    </div>
                </div>
            );
        }

        return (
            <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-20 h-20 rounded-3xl glass-panel flex items-center justify-center mb-4">
                    <FileIcon className="w-10 h-10 text-white/70" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 break-all">{file.name}</h3>
                <p className="text-white/60 mb-6 max-w-sm text-sm">This file type does not have an in-app preview yet.</p>
                <div className="flex items-center gap-3">
                    <a
                        href={file.url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-5 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                    >
                        Open File
                    </a>
                    <a
                        href={file.url}
                        download
                        className="px-5 py-3 rounded-xl bg-white text-black hover:bg-zinc-200 transition-colors"
                    >
                        Download
                    </a>
                </div>
            </div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md"
                    onClick={onClose}
                >
                    <div
                        className="absolute inset-0 flex flex-col"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="shrink-0 px-3 sm:px-4 pt-[max(env(safe-area-inset-top),0.5rem)] pb-3 border-b border-white/10 bg-black/40 backdrop-blur-md">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 rounded-xl bg-white/5 shrink-0">{renderIcon()}</div>
                                    <div className="min-w-0">
                                        <p className="text-white font-semibold truncate">{file.name || 'File'}</p>
                                        <p className="text-xs uppercase tracking-wider text-white/55">{fileTypeLabel}</p>
                                    </div>
                                </div>

                                {renderActions({ showPaging: fileInfo.kind === 'pdf' })}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">{renderContent()}</div>
                    </div>
                </div>
            )}
        </AnimatePresence>
    );
}
