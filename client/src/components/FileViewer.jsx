import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText, ImageIcon, File as FileIcon } from 'lucide-react';
import { Document, Page, pdfjs } from 'react-pdf';
import { renderAsync } from 'docx-preview';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function FileViewer({ file, isOpen, onClose }) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const docxContainerRef = useRef(null);
    const [docxError, setDocxError] = useState(null);

    // Reset state when file changes
    useEffect(() => {
        setPageNumber(1);
        setScale(1.0);
        setDocxError(null);
    }, [file]);

    // Handle DOCX rendering
    useEffect(() => {
        if (isOpen && file?.type === 'docx' && file?.url && docxContainerRef.current) {
            const renderDocx = async () => {
                try {
                    const response = await fetch(file.url);
                    const arrayBuffer = await response.arrayBuffer();
                    await renderAsync(arrayBuffer, docxContainerRef.current, docxContainerRef.current, {
                        className: "docx-preview",
                        inWrapper: false
                    });
                } catch (err) {
                    console.error("DOCX rendering error:", err);
                    setDocxError("Failed to render DOCX file.");
                }
            };
            renderDocx();
        }
    }, [isOpen, file]);

    if (!file) return null;

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
    };

    const isImage = (f) => f.type?.startsWith('image') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(f.extension?.toLowerCase());
    const isPdf = (f) => f.type === 'application/pdf' || f.extension?.toLowerCase() === 'pdf';
    const isDocx = (f) => f.extension?.toLowerCase() === 'docx';

    const renderContent = () => {
        if (isImage(file)) {
            return (
                <div className="relative w-full h-full flex items-center justify-center p-4">
                    <motion.img
                        src={file.url}
                        alt={file.name}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        style={{ scale }}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                    />
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 glass-panel px-4 py-2 rounded-full border border-white/10">
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-2 hover:bg-white/10 rounded-full text-white">
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <span className="text-white text-sm font-medium w-12 text-center">{Math.round(scale * 100)}%</span>
                        <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-2 hover:bg-white/10 rounded-full text-white">
                            <ZoomIn className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            );
        }

        if (isPdf(file)) {
            return (
                <div className="w-full h-full flex flex-col items-center bg-zinc-800/50 backdrop-blur-xl overflow-auto custom-scrollbar p-8 pt-20">
                    <Document
                        file={file.url}
                        onLoadSuccess={onDocumentLoadSuccess}
                        className="flex flex-col items-center"
                        loading={<div className="text-white">Loading PDF...</div>}
                    >
                        <Page
                            pageNumber={pageNumber}
                            scale={scale}
                            renderTextLayer={true}
                            renderAnnotationLayer={true}
                            className="shadow-2xl rounded-sm"
                        />
                    </Document>

                    {numPages > 1 && (
                        <div className="mt-8 flex items-center gap-6 glass-panel px-6 py-3 rounded-full border border-white/10">
                            <button
                                onClick={() => setPageNumber(p => Math.max(1, p - 1))}
                                disabled={pageNumber <= 1}
                                className="p-2 hover:bg-white/10 disabled:opacity-30 rounded-full text-white transition-opacity"
                            >
                                <ChevronLeft className="w-6 h-6" />
                            </button>
                            <span className="text-white font-medium">
                                Page {pageNumber} / {numPages}
                            </span>
                            <button
                                onClick={() => setPageNumber(p => Math.min(numPages, p + 1))}
                                disabled={pageNumber >= numPages}
                                className="p-2 hover:bg-white/10 disabled:opacity-30 rounded-full text-white transition-opacity"
                            >
                                <ChevronRight className="w-6 h-6" />
                            </button>
                        </div>
                    )}

                    <div className="fixed bottom-6 right-6 flex flex-col gap-2">
                        <button onClick={() => setScale(s => Math.max(0.5, s - 0.25))} className="p-3 glass-panel border border-white/10 rounded-full text-white hover:bg-white/10">
                            <ZoomOut className="w-5 h-5" />
                        </button>
                        <button onClick={() => setScale(s => Math.min(3, s + 0.25))} className="p-3 glass-panel border border-white/10 rounded-full text-white hover:bg-white/10">
                            <ZoomIn className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            );
        }

        if (isDocx(file)) {
            return (
                <div className="w-full h-full flex flex-col items-center overflow-auto bg-white p-8 sm:p-12 pt-24 custom-scrollbar">
                    {docxError ? (
                        <div className="text-red-500 bg-red-500/10 p-4 rounded-xl border border-red-500/20 max-w-md text-center">
                            {docxError}
                            <button
                                onClick={() => window.open(file.url, '_blank')}
                                className="block mt-4 text-blue-500 hover:underline"
                            >
                                Open in new tab instead
                            </button>
                        </div>
                    ) : (
                        <div
                            ref={docxContainerRef}
                            className="docx-render-container w-full max-w-4xl bg-white shadow-xl rounded-sm min-h-[500px]"
                        />
                    )}
                </div>
            );
        }

        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="w-24 h-24 rounded-3xl glass-panel flex items-center justify-center mb-6">
                    <FileIcon className="w-12 h-12 text-claude-secondary" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">{file.name}</h3>
                <p className="text-white/60 mb-8 max-w-xs">Previewing this file type is not supported yet.</p>
                <a
                    href={file.url}
                    download
                    className="flex items-center gap-2 px-8 py-4 bg-white text-black rounded-2xl font-bold hover:bg-zinc-200 transition-colors"
                >
                    <Download className="w-5 h-5" />
                    Download File
                </a>
            </div>
        );
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-md"
                    onClick={onClose}
                >
                    {/* Header */}
                    <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between pointer-events-none">
                        <div className="flex items-center gap-3 glass-panel px-4 py-2 rounded-2xl border border-white/10 pointer-events-auto max-w-[70%]">
                            <div className="p-2 bg-white/5 rounded-xl">
                                {isImage(file) ? <ImageIcon className="w-5 h-5 text-purple-400" /> :
                                    isPdf(file) ? <FileText className="w-5 h-5 text-red-400" /> :
                                        isDocx(file) ? <FileText className="w-5 h-5 text-blue-400" /> :
                                            <FileIcon className="w-5 h-5 text-gray-400" />}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-white font-medium truncate">{file.name}</p>
                                <p className="text-white/40 text-xs uppercase letter-spacing-wider">
                                    {file.extension || (file.type?.split('/')[1]) || 'FILE'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pointer-events-auto">
                            <a
                                href={file.url}
                                download
                                className="p-3 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 transition-colors"
                                onClick={e => e.stopPropagation()}
                            >
                                <Download className="w-6 h-6" />
                            </a>
                            <button
                                onClick={onClose}
                                className="p-3 glass-panel border border-white/10 text-white rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        className="flex-1 w-full relative overflow-hidden flex items-center justify-center p-0"
                        onClick={e => e.stopPropagation()}
                    >
                        {renderContent()}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
