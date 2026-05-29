import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Sparkles, Folder, Calendar, Hash, ChevronDown, Check,
    Upload, FileText, Loader2, Layers, Wand2
} from 'lucide-react';
import { api } from '../api';
import { deckTitleSchema } from '../schemas/forms';
import { useToast } from '../hooks/useToast';
import PricingModal from '../components/ui/PricingModal';
import { createArrayStreamParser } from '../utils/streamingJsonParser';

const MODES = [
    { id: 'manual', label: 'Quick Deck', icon: Layers },
    { id: 'ai', label: 'Generate from Notes', icon: Sparkles },
];

function PickerSheet({ open, title, icon: Icon, items, selectedId, noneLabel, onClose, onSelect, renderItem }) {
    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.button
                        type="button"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-40 bg-black/50"
                        aria-label={`Close ${title}`}
                    />
                    <motion.div
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-claude-border bg-claude-bg/95 px-4 pb-8 pt-4 shadow-2xl md:left-1/2 md:max-w-lg md:-translate-x-1/2 md:rounded-[2rem]"
                    >
                        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-claude-border" />
                        <div className="mb-4 flex items-center gap-3">
                            <div className="rounded-2xl border border-claude-border bg-claude-surface p-3 text-claude-secondary">
                                <Icon className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-display text-lg font-bold text-botanical-parchment">{title}</p>
                                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary">Choose one option</p>
                            </div>
                        </div>
                        <div className="max-h-[60dvh] space-y-2 overflow-auto pb-safe">
                            <button
                                type="button"
                                onClick={() => {
                                    onSelect(null);
                                    onClose();
                                }}
                                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] ${selectedId == null ? 'border-claude-accent/30 bg-claude-accent/10 text-botanical-parchment' : 'border-claude-border bg-claude-surface text-claude-secondary'}`}
                            >
                                <Icon className="h-5 w-5" />
                                <span className="flex-1">{noneLabel}</span>
                                {selectedId == null && <Check className="h-4 w-4 text-claude-accent" />}
                            </button>
                            {items.map((item) => {
                                const isSelected = selectedId === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => {
                                            onSelect(item.id);
                                            onClose();
                                        }}
                                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] ${isSelected ? 'border-claude-accent/30 bg-claude-accent/10 text-botanical-parchment' : 'border-claude-border bg-claude-surface text-claude-secondary'}`}
                                    >
                                        {renderItem(item)}
                                        {isSelected && <Check className="ml-auto h-4 w-4 text-claude-accent" />}
                                    </button>
                                );
                            })}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default function CreateDeck() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [mode, setMode] = useState('manual');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedClass, setSelectedClass] = useState(null);
    const [selectedTags, setSelectedTags] = useState([]);
    const [folders, setFolders] = useState([]);
    const [classes, setClasses] = useState([]);
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showFolderPicker, setShowFolderPicker] = useState(false);
    const [showClassPicker, setShowClassPicker] = useState(false);

    // AI state
    const [aiLimits, setAiLimits] = useState(null);
    const [aiNotes, setAiNotes] = useState('');
    const fileInputRef = useRef(null);
    const [aiFile, setAiFile] = useState(null);
    const [aiFilePreview, setAiFilePreview] = useState('');
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [streamingCards, setStreamingCards] = useState([]);
    const [streamPhase, setStreamPhase] = useState('idle'); // 'idle' | 'streaming' | 'saving' | 'done'
    const streamAbortRef = useRef(null);
    const toast = useToast();

    useEffect(() => {
        if (searchParams.get('focus') === 'syllabus') {
            setMode('ai');
        }
    }, [searchParams]);

    useEffect(() => {
        Promise.all([api.getFolders(), api.getClasses(), api.getTags(), api.getAILimits()])
            .then(([foldersData, classesData, tagsData, limitsData]) => {
                setFolders(foldersData);
                setClasses(classesData);
                setTags(tagsData);
                setAiLimits(limitsData);
            });
        api.warmupAiFunctions('generate-deck');
    }, []);

    const toggleTag = (tagId) => {
        setSelectedTags(prev =>
            prev.includes(tagId)
                ? prev.filter(id => id !== tagId)
                : [...prev, tagId]
        );
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('File must be under 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setAiFile({
                data: reader.result.split(',')[1],
                mimeType: file.type
            });
            setAiFilePreview(file.name);
        };
        reader.readAsDataURL(file);
    };

    const removeFile = () => {
        setAiFile(null);
        setAiFilePreview('');
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleManualSubmit = async (e) => {
        e.preventDefault();
        const result = deckTitleSchema.safeParse(title.trim());
        if (!result.success) {
            toast.error(result.error.errors[0]?.message || 'Invalid deck title');
            return;
        }
        setLoading(true);
        try {
            const newDeck = await api.createDeck(result.data, description, selectedFolder, selectedTags, selectedClass);
            toast.success('Deck created!');
            navigate(`/deck/${newDeck.id}`);
        } catch {
            toast.error('Failed to create deck');
        } finally {
            setLoading(false);
        }
    };

    const handleAIGenerate = async (e) => {
        e.preventDefault();
        const titleResult = deckTitleSchema.safeParse(title.trim());
        if (!titleResult.success) {
            toast.error(titleResult.error.errors[0]?.message || 'Give your deck a name first');
            return;
        }
        if (!aiFile && !aiNotes.trim()) {
            toast.error('Upload a file or paste your notes');
            return;
        }

        setIsGeneratingAI(true);
        setStreamingCards([]);
        setStreamPhase('streaming');

        try {
            const selectedClassData = classes.find(c => c.id === selectedClass);
            const stream = await api.generateAiDeckStream(
                aiNotes,
                aiFile,
                titleResult.data,
                selectedClass,
                selectedClassData?.name || null,
                selectedClassData?.subject || null
            );
            streamAbortRef.current = stream.abort;

            const parser = createArrayStreamParser((card) => {
                setStreamingCards(prev => [...prev, { front: card.front, back: card.back }]);
            });

            for await (const event of stream.chunks()) {
                if (event.type === 'chunk') {
                    parser.feed(event.data.text);
                } else if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    err.body = event.data;
                    throw err;
                } else if (event.type === 'done') {
                    setStreamPhase('done');
                    toast.success(`Generated ${event.data.card_count} flashcards!`);
                    navigate(`/deck/${event.data.deck_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) {
                setShowPricingModal(true);
            } else {
                toast.error(err.message || 'Failed to generate flashcards');
            }
            setStreamPhase('idle');
            setStreamingCards([]);
        } finally {
            setIsGeneratingAI(false);
            streamAbortRef.current = null;
        }
    };

    const selectedFolderData = folders.find(f => f.id === selectedFolder);
    const selectedClassData = classes.find(c => c.id === selectedClass);

    return (
        <div className="min-h-full flex flex-col safe-area-top">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-claude-bg/95 md:backdrop-blur-md border-b border-claude-border/50">
                <div className="flex items-center justify-between py-3">
                    <Link to="/" className="touch-target text-claude-secondary active:text-claude-text -ml-2">
                        <X className="w-6 h-6" />
                    </Link>
                    <h1 className="font-display font-bold text-lg">New Deck</h1>
                    <div className="w-10" />
                </div>

                {/* Mode Toggle — Segmented Control */}
                <div className="pb-3">
                    <div className="relative flex glass-panel rounded-xl p-1 gap-1">
                        {MODES.map(m => {
                            const Icon = m.icon;
                            const isActive = mode === m.id;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMode(m.id)}
                                    className={`relative flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition-[transform,opacity,color,background-color,border-color,box-shadow] duration-200 tap-action z-10
                                        ${isActive ? 'text-[#162a31]' : 'text-claude-secondary'}`}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="font-mono text-[11px] uppercase tracking-widest font-bold">{m.label}</span>
                                </button>
                            );
                        })}
                        {/* Sliding indicator */}
                        <motion.div
                            layout
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            className="absolute top-1 bottom-1 rounded-lg"
                            style={{
                                left: mode === 'manual' ? '4px' : '50%',
                                width: 'calc(50% - 6px)',
                                background: 'var(--accent-color)',
                                boxShadow: '0 2px 12px rgba(222,185,106,0.25)',
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Form */}
            <form
                onSubmit={mode === 'manual' ? handleManualSubmit : handleAIGenerate}
                className="flex-1 flex flex-col py-6"
            >
                <div className="mb-5 rounded-[1.75rem] border border-claude-border bg-claude-surface px-4 py-4 shadow-sm">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary">Deck Setup</p>
                            <h2 className="mt-1 font-display text-2xl font-bold text-botanical-parchment">
                                {title.trim() || (mode === 'manual' ? 'Start a quick deck' : 'Generate a deck from notes')}
                            </h2>
                        </div>
                        <div className="rounded-2xl border border-claude-border bg-claude-bg p-3 text-claude-accent">
                            {mode === 'manual' ? <Layers className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                        </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <span className="rounded-full border border-claude-border bg-claude-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                            {mode === 'manual' ? 'Build manually' : 'Guided workflow'}
                        </span>
                        <span className="rounded-full border border-claude-border bg-claude-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                            {selectedClassData?.name || 'No class linked'}
                        </span>
                        <span className="rounded-full border border-claude-border bg-claude-bg px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                            {selectedFolderData?.name || 'Library root'}
                        </span>
                    </div>
                </div>
                <AnimatePresence mode="wait">
                    {mode === 'manual' ? (
                        <motion.div
                            key="manual"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 space-y-5"
                        >
                            {/* Title */}
                            <div>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-4 py-4 glass-panel rounded-2xl focus:border-claude-accent outline-none transition-colors text-lg font-display font-bold placeholder:text-claude-secondary/50"
                                    placeholder="Deck name"
                                    required
                                    autoFocus
                                />
                            </div>

                            {/* Description */}
                            <div>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    className="w-full px-4 py-4 glass-panel rounded-2xl focus:border-claude-accent outline-none transition-colors min-h-[96px] resize-none text-sm"
                                    placeholder="Add a description (optional)"
                                />
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => { setShowFolderPicker(true); setShowClassPicker(false); }}
                                    className="rounded-2xl border border-claude-border bg-claude-surface px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.99]"
                                >
                                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">Folder</p>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <Folder className="w-5 h-5" style={{ color: selectedFolderData?.color || 'var(--secondary-text-color)' }} />
                                            <span className={selectedFolderData ? 'text-botanical-parchment' : 'text-claude-secondary'}>
                                                {selectedFolderData?.name || 'Library root'}
                                            </span>
                                        </div>
                                        <ChevronDown className="w-5 h-5 text-claude-secondary" />
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setShowClassPicker(true); setShowFolderPicker(false); }}
                                    className="rounded-2xl border border-claude-border bg-claude-surface px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.99]"
                                >
                                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">Class</p>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-claude-secondary" style={{ color: selectedClassData?.color || 'var(--secondary-text-color)' }} />
                                            <span className={selectedClassData ? 'text-botanical-parchment' : 'text-claude-secondary'}>
                                                {selectedClassData?.name || 'Not linked'}
                                            </span>
                                        </div>
                                        <ChevronDown className="w-5 h-5 text-claude-secondary" />
                                    </div>
                                </button>
                            </div>

                            {/* Tags */}
                            {tags.length > 0 && (
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">Tags</label>
                                    <div className="flex flex-wrap gap-2">
                                        {tags.map(tag => (
                                            <button
                                                key={tag.id}
                                                type="button"
                                                onClick={() => toggleTag(tag.id)}
                                                className={`px-4 py-2.5 rounded-full flex items-center gap-2 text-sm font-medium transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-95 ${selectedTags.includes(tag.id)
                                                    ? 'text-white shadow-md'
                                                    : 'glass-panel'
                                                    }`}
                                                style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : {}}
                                            >
                                                <Hash className="w-3.5 h-3.5" style={!selectedTags.includes(tag.id) ? { color: tag.color } : {}} />
                                                {tag.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="ai"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                            className="flex-1 space-y-5"
                        >
                            {/* AI Limits Badge */}
                            {aiLimits && (
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono uppercase tracking-widest font-bold"
                                        style={{
                                            background: aiLimits.remaining > 0
                                                ? 'rgba(122,158,114,0.15)'
                                                : 'rgba(239,68,68,0.15)',
                                            color: aiLimits.remaining > 0
                                                ? '#7a9e72'
                                                : '#ef4444',
                                            border: `1px solid ${aiLimits.remaining > 0 ? 'rgba(122,158,114,0.3)' : 'rgba(239,68,68,0.3)'}`
                                        }}
                                    >
                                        <Wand2 className="w-3 h-3" />
                                        {aiLimits.remaining}/{aiLimits.max} study generations
                                    </div>
                                </div>
                            )}

                            {/* Notes / Source Material */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                    Notes or Source Material
                                </label>
                                <textarea
                                    value={aiNotes}
                                    onChange={e => setAiNotes(e.target.value)}
                                    className="w-full px-4 py-4 glass-panel rounded-2xl focus:border-claude-accent outline-none transition-colors min-h-[120px] resize-none text-sm"
                                    placeholder="Paste your notes, lecture content, or key concepts here..."
                                />
                            </div>

                            {/* File Upload */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-claude-secondary mb-2">
                                    Or Upload a File
                                </label>
                                {aiFilePreview ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="flex items-center justify-between glass-panel rounded-xl p-3.5"
                                    >
                                        <div className="flex items-center gap-3 truncate">
                                            <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center"
                                                style={{ background: 'rgba(222,185,106,0.12)', border: '1px solid rgba(222,185,106,0.2)' }}
                                            >
                                                <FileText className="w-5 h-5 text-claude-accent" />
                                            </div>
                                            <div className="truncate">
                                                <span className="font-mono text-xs text-botanical-parchment truncate block">{aiFilePreview}</span>
                                                <span className="font-mono text-[10px] text-claude-secondary uppercase tracking-widest">Ready for analysis</span>
                                            </div>
                                        </div>
                                        <button type="button" onClick={removeFile} className="p-2 text-red-400 hover:text-red-300 shrink-0">
                                            <X className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                ) : (
                                    <label className="flex items-center justify-center w-full py-8 glass-panel border border-dashed border-claude-border/60 rounded-xl cursor-pointer hover:border-claude-accent/40 transition-[transform,opacity,color,background-color,border-color,box-shadow] group">
                                        <div className="flex flex-col items-center gap-2 text-claude-secondary group-hover:text-claude-accent transition-colors">
                                            <Upload className="w-6 h-6" />
                                            <span className="font-mono text-[11px] uppercase tracking-widest font-bold">
                                                PDF, Doc, Image — up to 5MB
                                            </span>
                                        </div>
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            className="hidden"
                                            accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                )}
                            </div>

                            {streamPhase === 'idle' && (
                                <button
                                    type="button"
                                    onClick={() => { setShowClassPicker(true); setShowFolderPicker(false); }}
                                    className="rounded-2xl border border-claude-border bg-claude-surface px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.99]"
                                >
                                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">Linked Class</p>
                                    <div className="mt-2 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <Calendar className="w-5 h-5 text-claude-secondary" style={{ color: selectedClassData?.color || 'var(--secondary-text-color)' }} />
                                            <span className={selectedClassData ? 'text-botanical-parchment' : 'text-claude-secondary'}>
                                                {selectedClassData?.name || 'Not linked'}
                                            </span>
                                        </div>
                                        <ChevronDown className="w-5 h-5 text-claude-secondary" />
                                    </div>
                                </button>
                            )}

                            {/* Streaming Preview */}
                            {streamPhase === 'streaming' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="space-y-3"
                                >
                                    <div className="flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-claude-accent" />
                                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent font-bold">
                                            {streamingCards.length} card{streamingCards.length !== 1 ? 's' : ''} generated...
                                        </span>
                                    </div>
                                    <div className="space-y-2 max-h-[40vh] overflow-auto">
                                        <AnimatePresence>
                                            {streamingCards.map((card, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 12 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                                                    className="rounded-2xl border border-claude-border bg-claude-surface p-4"
                                                >
                                                    <p className="text-sm font-semibold text-botanical-parchment">{card.front}</p>
                                                    <p className="mt-1 text-sm text-claude-secondary">{card.back}</p>
                                                </motion.div>
                                            ))}
                                        </AnimatePresence>
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Footer Button */}
                <div className="sticky bottom-0 pt-4 mt-6 pb-4 bg-gradient-to-t from-claude-bg via-claude-bg">
                    {mode === 'manual' ? (
                        <button
                            type="submit"
                            disabled={loading || !title.trim()}
                            className="w-full claude-button-primary text-lg disabled:opacity-50 disabled:active:scale-100"
                        >
                            {loading ? 'Creating...' : 'Create Deck'}
                        </button>
                    ) : (
                        <button
                            type="submit"
                            disabled={isGeneratingAI || !title.trim() || (!aiFile && !aiNotes.trim())}
                            className="w-full claude-button-primary text-lg disabled:opacity-50 disabled:active:scale-100 gap-2"
                        >
                            {isGeneratingAI ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-5 h-5" />
                                    Generate Flashcards
                                </>
                            )}
                        </button>
                    )}
                </div>
            </form>


            <PickerSheet
                open={showFolderPicker}
                title="Choose Folder"
                icon={Folder}
                items={folders}
                selectedId={selectedFolder}
                noneLabel="Library root"
                onClose={() => setShowFolderPicker(false)}
                onSelect={setSelectedFolder}
                renderItem={(folder) => (
                    <>
                        <Folder className="h-5 w-5" style={{ color: folder.color }} />
                        <span>{folder.name}</span>
                    </>
                )}
            />

            <PickerSheet
                open={showClassPicker}
                title="Link a Class"
                icon={Calendar}
                items={classes}
                selectedId={selectedClass}
                noneLabel="No linked class"
                onClose={() => setShowClassPicker(false)}
                onSelect={setSelectedClass}
                renderItem={(cls) => (
                    <>
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: cls.color || '#7a9e72' }} />
                        <span>{cls.name}</span>
                    </>
                )}
            />

            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
        </div>
    );
}
