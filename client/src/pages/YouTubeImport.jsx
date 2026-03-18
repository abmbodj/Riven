import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Check, Loader2, ChevronDown, Calendar, Sparkles,
    FileText, Layers, BookOpen, ClipboardCheck, ArrowRight, Play
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import PricingModal from '../components/ui/PricingModal';
import { createArrayStreamParser } from '../utils/streamingJsonParser';

const CONTENT_TYPES = [
    {
        id: 'notes',
        label: 'Notes',
        description: 'Structured notes from video',
        icon: FileText,
        color: '#22c55e',
    },
    {
        id: 'deck',
        label: 'Flashcards',
        description: 'Spaced-repetition deck',
        icon: Layers,
        color: '#6366f1',
    },
    {
        id: 'guide',
        label: 'Study Guide',
        description: 'Comprehensive guide',
        icon: BookOpen,
        color: '#f59e0b',
    },
    {
        id: 'exam',
        label: 'Mock Exam',
        description: 'Multiple-choice quiz',
        icon: ClipboardCheck,
        color: '#ec4899',
    },
];

const YoutubeIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
);

function extractVideoId(url) {
    try {
        const u = new URL(url);
        if (u.hostname === 'youtu.be') return u.pathname.slice(1).split('/')[0].split('?')[0];
        if (u.hostname === 'www.youtube.com' || u.hostname === 'youtube.com' || u.hostname === 'm.youtube.com') {
            return u.searchParams.get('v') || null;
        }
        return null;
    } catch {
        return null;
    }
}

function getResultLink(type, result) {
    if (type === 'deck' && result.deck_id) return `/deck/${result.deck_id}`;
    if (type === 'guide' && result.guide_id) return `/guide/${result.guide_id}`;
    if (type === 'exam' && result.exam_id) return `/exam/${result.exam_id}`;
    if (type === 'notes' && result.note_id) return `/note/${result.note_id}`;
    return null;
}

function PickerSheet({ open, items, selectedId, onClose, onSelect }) {
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
                        aria-label="Close class picker"
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
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="font-display text-lg font-bold text-botanical-parchment">Linked Class</p>
                                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary">Choose one option</p>
                            </div>
                        </div>
                        <div className="max-h-[60dvh] space-y-2 overflow-auto pb-safe">
                            <button
                                type="button"
                                onClick={() => { onSelect(null); onClose(); }}
                                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] ${selectedId == null ? 'border-claude-accent/30 bg-claude-accent/10 text-botanical-parchment' : 'border-claude-border bg-claude-surface text-claude-secondary'}`}
                            >
                                <Calendar className="h-5 w-5" />
                                <span className="flex-1">No class</span>
                                {selectedId == null && <Check className="h-4 w-4 text-claude-accent" />}
                            </button>
                            {items.map((cls) => {
                                const isSelected = selectedId === cls.id;
                                return (
                                    <button
                                        key={cls.id}
                                        type="button"
                                        onClick={() => { onSelect(cls.id); onClose(); }}
                                        className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] ${isSelected ? 'border-claude-accent/30 bg-claude-accent/10 text-botanical-parchment' : 'border-claude-border bg-claude-surface text-claude-secondary'}`}
                                    >
                                        <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: cls.color || '#6366f1' }} />
                                        <span className="flex-1 truncate">{cls.name}</span>
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

export default function YouTubeImport() {
    const navigate = useNavigate();
    const toast = useToast();

    // Input state
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [videoId, setVideoId] = useState(null);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [customTitle, setCustomTitle] = useState('');
    const [classes, setClasses] = useState([]);
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [aiLimits, setAiLimits] = useState(null);

    // Phase: 'input' | 'generating' | 'done'
    const [phase, setPhase] = useState('input');
    const [progress, setProgress] = useState([]);
    const [results, setResults] = useState([]);

    useEffect(() => {
        api.getClasses().then(setClasses).catch(() => {});
        api.getAILimits().then(setAiLimits).catch(() => {});
    }, []);

    const [videoTitle, setVideoTitle] = useState('');

    const handleUrlChange = useCallback((e) => {
        const val = e.target.value;
        setYoutubeUrl(val);
        const id = extractVideoId(val);
        setVideoId(id);
        setVideoTitle('');
        if (id) {
            fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`)
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (data?.title) setVideoTitle(data.title); })
                .catch(() => {});
        }
    }, []);

    const toggleType = useCallback((typeId) => {
        setSelectedTypes(prev =>
            prev.includes(typeId)
                ? prev.filter(t => t !== typeId)
                : [...prev, typeId]
        );
    }, []);

    const [streamingPreview, setStreamingPreview] = useState([]); // streamed items for current type
    const streamAbortRef = useRef(null);

    const handleGenerate = async () => {
        if (!youtubeUrl.trim() || selectedTypes.length === 0) return;

        const progressItems = selectedTypes.map(type => ({
            type,
            label: CONTENT_TYPES.find(c => c.id === type)?.label,
            status: 'pending',
            result: null,
            error: null,
        }));
        setProgress(progressItems);
        setPhase('generating');

        const finalResults = [];

        for (let i = 0; i < selectedTypes.length; i++) {
            const type = selectedTypes[i];
            setStreamingPreview([]);

            setProgress(prev => prev.map((item, idx) =>
                idx === i ? { ...item, status: 'generating' } : item
            ));

            try {
                const effectiveTitle = customTitle.trim() || videoTitle || undefined;
                const selectedClassData = classes.find(c => c.id === selectedClass);
                const stream = await api.generateFromYoutubeStream(youtubeUrl, type, {
                    title: effectiveTitle,
                    classId: selectedClass || undefined,
                    deckName: effectiveTitle,
                    className: selectedClassData?.name || undefined,
                });
                streamAbortRef.current = stream.abort;

                // For array types (deck, exam), parse items progressively
                const isArrayType = type === 'deck' || type === 'exam';
                const parser = isArrayType ? createArrayStreamParser((item) => {
                    setStreamingPreview(prev => [...prev, item]);
                }) : null;

                let streamText = '';
                let result = null;

                for await (const event of stream.chunks()) {
                    if (event.type === 'chunk') {
                        if (parser) {
                            parser.feed(event.data.text);
                        } else {
                            streamText += event.data.text;
                        }
                    } else if (event.type === 'error') {
                        const err = new Error(event.data.message);
                        err.status = event.data.status;
                        err.body = event.data;
                        throw err;
                    } else if (event.type === 'done') {
                        result = event.data;
                    }
                }

                if (result) {
                    setProgress(prev => prev.map((item, idx) =>
                        idx === i ? { ...item, status: 'done', result } : item
                    ));
                    finalResults.push({ type, result });
                }
            } catch (err) {
                if (err.status === 429) {
                    setProgress(prev => prev.map((item, idx) => {
                        if (idx === i) return { ...item, status: 'error', error: err.message };
                        if (idx > i) return { ...item, status: 'error', error: 'Quota exceeded' };
                        return item;
                    }));
                    setShowPricingModal(true);
                    break;
                }
                setProgress(prev => prev.map((item, idx) =>
                    idx === i ? { ...item, status: 'error', error: err.message || 'Generation failed' } : item
                ));
            } finally {
                streamAbortRef.current = null;
            }
        }

        setResults(finalResults);
        setStreamingPreview([]);

        // Auto-redirect if exactly one item was generated successfully
        if (finalResults.length === 1) {
            const link = getResultLink(finalResults[0].type, finalResults[0].result);
            if (link) {
                navigate(link);
                return;
            }
        }

        setPhase('done');
    };

    const handleReset = () => {
        setPhase('input');
        setProgress([]);
        setResults([]);
        setYoutubeUrl('');
        setVideoId(null);
        setSelectedTypes([]);
        setCustomTitle('');
        api.getAILimits().then(setAiLimits).catch(() => {});
    };

    const selectedClassData = classes.find(c => c.id === selectedClass);

    // ─── RENDER ───────────────────────────────────────

    return (
        <div className="min-h-full flex flex-col safe-area-top">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-claude-bg/95 backdrop-blur-md border-b border-claude-border/50">
                <div className="flex items-center justify-between px-4 py-3">
                    <Link to="/decks" className="touch-target flex items-center justify-center text-claude-secondary -ml-2 w-10 h-10" aria-label="Close">
                        <X className="w-6 h-6" />
                    </Link>
                    <h1 className="font-display font-bold text-lg flex items-center gap-2.5 text-botanical-parchment">
                        <YoutubeIcon className="w-5 h-5 text-red-500" />
                        YouTube Import
                    </h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="flex-1 flex flex-col px-4 py-5 space-y-4 max-w-2xl w-full mx-auto">

                {/* AI Limits Badge */}
                {aiLimits && phase === 'input' && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-2"
                    >
                        <Sparkles className="w-3.5 h-3.5 text-claude-accent" />
                        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                            {aiLimits.remaining}/{aiLimits.max} generations remaining
                        </span>
                    </motion.div>
                )}

                {/* ═══ INPUT PHASE ═══ */}
                {phase === 'input' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col space-y-4 flex-1"
                    >
                        {/* URL Input Card */}
                        <div className="glass-panel-premium rounded-[1.75rem] p-5">
                            <label htmlFor="youtube-url" className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary block mb-2">
                                YouTube URL
                            </label>
                            <input
                                id="youtube-url"
                                type="url"
                                value={youtubeUrl}
                                onChange={handleUrlChange}
                                placeholder="https://www.youtube.com/watch?v=..."
                                className="w-full px-4 py-4 glass-item rounded-2xl border border-claude-border/50 focus:border-claude-accent/50 outline-none transition-colors font-mono text-sm text-botanical-parchment placeholder:text-claude-secondary/40 bg-transparent"
                                autoFocus
                            />
                        </div>

                        {/* Video Thumbnail Preview */}
                        <AnimatePresence>
                            {videoId && (
                                <motion.div
                                    initial={{ opacity: 0, y: 12, scale: 0.97 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: -8, scale: 0.97 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                                    className="glass-panel-premium rounded-[1.75rem] overflow-hidden"
                                >
                                    <div className="relative aspect-video bg-claude-surface overflow-hidden">
                                        <img
                                            src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                            alt="Video thumbnail"
                                            className="w-full h-full object-cover"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-14 h-14 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10">
                                                <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                                            </div>
                                        </div>
                                        {/* Vignette overlay */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                                    </div>
                                    <div className="px-5 py-3 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                                            Video detected — ready to analyze
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Content Type Multi-Select */}
                        <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary mb-3 px-1">
                                What to generate
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {CONTENT_TYPES.map(ct => {
                                    const Icon = ct.icon;
                                    const isSelected = selectedTypes.includes(ct.id);
                                    return (
                                        <motion.button
                                            key={ct.id}
                                            type="button"
                                            onClick={() => toggleType(ct.id)}
                                            whileTap={{ scale: 0.97 }}
                                            className={`glass-item rounded-2xl px-4 py-4 text-left transition-[border-color,background-color,opacity] duration-200 relative overflow-hidden touch-target cursor-pointer ${isSelected ? '' : 'opacity-60'}`}
                                            style={isSelected ? {
                                                borderColor: `${ct.color}40`,
                                                backgroundColor: `${ct.color}08`,
                                            } : {}}
                                        >
                                            <div className="flex items-center justify-between mb-2.5">
                                                <div
                                                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                                                    style={{ background: `${ct.color}15`, color: ct.color }}
                                                >
                                                    <Icon className="w-4.5 h-4.5" />
                                                </div>
                                                <AnimatePresence>
                                                    {isSelected && (
                                                        <motion.div
                                                            initial={{ scale: 0, opacity: 0 }}
                                                            animate={{ scale: 1, opacity: 1 }}
                                                            exit={{ scale: 0, opacity: 0 }}
                                                            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                                                            className="w-5.5 h-5.5 rounded-full flex items-center justify-center"
                                                            style={{ background: ct.color }}
                                                        >
                                                            <Check className="w-3 h-3 text-white" />
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-botanical-parchment">
                                                {ct.label}
                                            </p>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-claude-secondary mt-0.5">
                                                {ct.description}
                                            </p>
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Optional Title */}
                        <input
                            type="text"
                            value={customTitle}
                            onChange={e => setCustomTitle(e.target.value)}
                            placeholder="Custom title (optional)"
                            className="w-full px-4 py-4 glass-item rounded-2xl border border-claude-border/50 focus:border-claude-accent/50 outline-none transition-colors font-display font-bold text-base text-botanical-parchment placeholder:text-claude-secondary/40 bg-transparent"
                        />

                        {/* Class Picker */}
                        <button
                            type="button"
                            onClick={() => setShowClassPicker(true)}
                            className="rounded-2xl border border-claude-border bg-claude-surface/50 px-4 py-4 text-left transition-[transform,opacity,color,background-color,border-color,box-shadow] active:scale-[0.99] cursor-pointer touch-target"
                        >
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">Linked Class</p>
                            <div className="mt-1.5 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    {selectedClassData ? (
                                        <div className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: selectedClassData.color || '#6366f1' }} />
                                    ) : (
                                        <Calendar className="w-5 h-5 text-claude-secondary" />
                                    )}
                                    <span className={selectedClassData ? 'text-botanical-parchment text-sm' : 'text-claude-secondary text-sm'}>
                                        {selectedClassData?.name || 'Not linked'}
                                    </span>
                                </div>
                                <ChevronDown className="w-4 h-4 text-claude-secondary/60" />
                            </div>
                        </button>

                        {/* Quota Cost Hint */}
                        {selectedTypes.length > 0 && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="font-mono text-[10px] uppercase tracking-[0.14em] text-claude-secondary text-center"
                            >
                                Uses {selectedTypes.length} AI generation{selectedTypes.length > 1 ? 's' : ''}
                            </motion.p>
                        )}

                        {/* Generate Button */}
                        <div className="sticky bottom-0 pt-3 pb-4 mt-auto bg-gradient-to-t from-claude-bg via-claude-bg/95 to-transparent">
                            <button
                                type="button"
                                onClick={handleGenerate}
                                disabled={!videoId || selectedTypes.length === 0}
                                className="w-full claude-button-primary text-base gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Sparkles className="w-5 h-5" />
                                Generate {selectedTypes.length > 0
                                    ? `${selectedTypes.length} Item${selectedTypes.length > 1 ? 's' : ''}`
                                    : 'Materials'}
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ═══ GENERATING PHASE ═══ */}
                {phase === 'generating' && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className="flex flex-col space-y-4 flex-1"
                    >
                        {/* Thumbnail stays visible */}
                        {videoId && (
                            <div className="glass-panel-premium rounded-[1.75rem] overflow-hidden">
                                <div className="relative aspect-video bg-claude-surface overflow-hidden">
                                    <img
                                        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                                        alt="Video thumbnail"
                                        className="w-full h-full object-cover opacity-60"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                                    <div className="absolute bottom-4 left-5 right-5">
                                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/70">
                                            Analyzing video content...
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Progress List */}
                        <div className="glass-panel-premium rounded-[1.75rem] p-5 space-y-3">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                                Generating study materials
                            </p>

                            {progress.map((item, idx) => {
                                const ct = CONTENT_TYPES.find(c => c.id === item.type);
                                const Icon = ct?.icon || Sparkles;
                                return (
                                    <motion.div
                                        key={item.type}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.06 }}
                                        className="glass-item rounded-2xl px-4 py-3.5 flex items-center gap-3"
                                    >
                                        <div
                                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                            style={{ background: `${ct?.color}15`, color: ct?.color }}
                                        >
                                            {item.status === 'generating' ? (
                                                <Loader2 className="w-4.5 h-4.5 animate-spin" />
                                            ) : item.status === 'done' ? (
                                                <Check className="w-4.5 h-4.5" />
                                            ) : item.status === 'error' ? (
                                                <X className="w-4.5 h-4.5 text-red-400" />
                                            ) : (
                                                <Icon className="w-4.5 h-4.5 opacity-30" />
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-botanical-parchment">
                                                {item.label}
                                            </p>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-claude-secondary mt-0.5">
                                                {item.status === 'generating'
                                                    ? (streamingPreview.length > 0
                                                        ? `${streamingPreview.length} item${streamingPreview.length !== 1 ? 's' : ''} so far...`
                                                        : 'Analyzing video...')
                                                    : item.status === 'done' ? 'Complete'
                                                    : item.status === 'error' ? (item.error || 'Failed')
                                                    : 'Waiting...'}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Streaming Preview */}
                        {streamingPreview.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="space-y-2 max-h-[30vh] overflow-auto"
                            >
                                <AnimatePresence>
                                    {streamingPreview.map((item, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.25 }}
                                            className="rounded-2xl border border-claude-border bg-claude-surface p-3.5"
                                        >
                                            <p className="text-sm font-semibold text-botanical-parchment">
                                                {item.front || item.question || ''}
                                            </p>
                                            {item.back && (
                                                <p className="mt-1 text-xs text-claude-secondary">{item.back}</p>
                                            )}
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* ═══ DONE PHASE ═══ */}
                {phase === 'done' && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className="flex flex-col space-y-4 flex-1"
                    >
                        {/* Success Header */}
                        <div className="glass-panel-premium rounded-[1.75rem] p-6 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                                className="w-14 h-14 rounded-full bg-claude-accent/15 border border-claude-accent/30 flex items-center justify-center mx-auto mb-4"
                            >
                                <Check className="w-7 h-7 text-claude-accent" />
                            </motion.div>
                            <h2 className="font-display text-2xl font-bold text-botanical-parchment mb-1">
                                {results.length > 0 ? 'Done!' : 'Generation Complete'}
                            </h2>
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                                {results.length} item{results.length !== 1 ? 's' : ''} generated from video
                            </p>
                        </div>

                        {/* Result Links */}
                        <div className="space-y-3">
                            {progress.map((item, idx) => {
                                const ct = CONTENT_TYPES.find(c => c.id === item.type);
                                const link = item.result ? getResultLink(item.type, item.result) : null;
                                const Icon = ct?.icon || Sparkles;

                                if (link) {
                                    return (
                                        <motion.div
                                            key={item.type}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: idx * 0.08 }}
                                        >
                                            <Link
                                                to={link}
                                                className="glass-item rounded-2xl px-4 py-4 flex items-center gap-3 tap-action touch-target cursor-pointer hover:border-claude-accent/20 transition-colors"
                                            >
                                                <div
                                                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                                                    style={{ background: `${ct?.color}15`, color: ct?.color }}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-botanical-parchment">
                                                        {ct?.label}
                                                    </p>
                                                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-claude-secondary mt-0.5">
                                                        {item.type === 'deck' && item.result?.card_count
                                                            ? `${item.result.card_count} flashcards`
                                                            : item.type === 'exam' && item.result?.question_count
                                                                ? `${item.result.question_count} questions`
                                                                : 'View now'}
                                                    </p>
                                                </div>
                                                <ArrowRight className="w-4 h-4 text-claude-secondary/40" />
                                            </Link>
                                        </motion.div>
                                    );
                                }

                                return (
                                    <motion.div
                                        key={item.type}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.08 }}
                                        className="glass-item rounded-2xl px-4 py-4 flex items-center gap-3 opacity-50"
                                    >
                                        <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-red-500/10">
                                            <X className="w-5 h-5 text-red-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-botanical-parchment">
                                                {ct?.label}
                                            </p>
                                            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-red-400/80 mt-0.5">
                                                {item.error || 'Failed'}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-3 mt-auto pt-4">
                            <button
                                type="button"
                                onClick={handleReset}
                                className="w-full claude-button-primary text-base gap-2 cursor-pointer"
                            >
                                <YoutubeIcon className="w-5 h-5" />
                                Import Another Video
                            </button>
                            <Link
                                to="/decks"
                                className="w-full rounded-2xl border border-claude-border bg-claude-surface/50 px-6 py-4 text-center font-mono text-xs uppercase tracking-[0.14em] text-claude-secondary block tap-action touch-target"
                            >
                                Back to Dashboard
                            </Link>
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Class Picker Sheet */}
            <PickerSheet
                open={showClassPicker}
                items={classes}
                selectedId={selectedClass}
                onClose={() => setShowClassPicker(false)}
                onSelect={setSelectedClass}
            />

            {/* Pricing Modal */}
            {showPricingModal && (
                <PricingModal onClose={() => setShowPricingModal(false)} />
            )}
        </div>
    );
}
