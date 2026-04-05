import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    X, Check, Loader2, ChevronDown, Calendar, Sparkles,
    FileText, Layers, BookOpen, ClipboardCheck, ArrowRight, Play
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import PricingModal from '../components/ui/PricingModal';

const CONTENT_TYPES = [
    {
        id: 'notes',
        label: 'Notes',
        description: 'Structured notes from video',
        icon: FileText,
        color: '#22c55e',
        jobKind: 'youtube_notes',
    },
    {
        id: 'deck',
        label: 'Flashcards',
        description: 'Spaced-repetition deck',
        icon: Layers,
        color: '#6366f1',
        jobKind: 'youtube_deck',
    },
    {
        id: 'guide',
        label: 'Exam Coach',
        description: 'Coach topic map',
        icon: BookOpen,
        color: '#f59e0b',
        jobKind: 'youtube_guide',
    },
    {
        id: 'exam',
        label: 'Mock Exam',
        description: 'Multiple-choice quiz',
        icon: ClipboardCheck,
        color: '#ec4899',
        jobKind: 'youtube_exam',
    },
];

const SOURCE_PHASE_LABELS = {
    accepted: 'Accepted video analysis job',
    processing_media: 'Analyzing YouTube video',
    drafting: 'Building reusable video notes',
    saving: 'Saving reusable source',
    done: 'Reusable source ready',
    error: 'Source analysis failed',
};

const DERIVED_PHASE_LABELS = {
    accepted: 'Queued behind source analysis',
    drafting: 'Generating coach artifact',
    saving: 'Saving generated result',
    done: 'Ready to open',
    error: 'Generation failed',
};

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

const getProgressStatus = (job) => {
    if (!job) return 'pending';
    if (job.status === 'completed') return 'done';
    if (job.status === 'failed' || job.status === 'cancelled') return 'error';
    if (job.status === 'queued') return 'pending';
    return 'generating';
};

const isSourceJobFailure = (job) => job?.status === 'failed' || job?.status === 'cancelled';

const getJobErrorMessage = (job, fallback = 'Failed') => (
    job?.error_payload?.message
    || job?.progress_message
    || fallback
);

const extractNodeText = (node) => {
    if (!node || typeof node !== 'object') return '';
    const texts = [];
    const walk = (currentNode) => {
        if (!currentNode || typeof currentNode !== 'object') return;
        if (typeof currentNode.text === 'string') texts.push(currentNode.text);
        if (Array.isArray(currentNode.content)) currentNode.content.forEach(walk);
    };
    walk(node);
    return texts.join(' ').trim();
};

const buildDerivedPreviewSummary = (item) => {
    const resultPayload = item.resultPayload || {};

    if (Array.isArray(resultPayload.preview_items) && resultPayload.preview_items.length > 0) {
        const latestItem = resultPayload.preview_items[resultPayload.preview_items.length - 1];
        return latestItem.front || latestItem.question || '';
    }

    if (Array.isArray(resultPayload.preview_sections) && resultPayload.preview_sections.length > 0) {
        const latestSection = resultPayload.preview_sections[resultPayload.preview_sections.length - 1];
        return extractNodeText(latestSection);
    }

    return '';
};

const getDerivedStatusText = (item, sourceJob) => {
    if (item.status === 'done') return 'Complete';
    if (item.status === 'error') return item.error || 'Failed';

    if (item.progressMessage) return item.progressMessage;
    if (item.status === 'pending' && sourceJob && sourceJob.status !== 'completed') {
        return SOURCE_PHASE_LABELS[sourceJob.phase] || sourceJob.progress_message || 'Waiting for source analysis';
    }

    return DERIVED_PHASE_LABELS[item.phase] || 'Waiting...';
};

export default function YouTubeImport() {
    const navigate = useNavigate();
    const toast = useToast();

    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [videoId, setVideoId] = useState(null);
    const [selectedTypes, setSelectedTypes] = useState([]);
    const [selectedClass, setSelectedClass] = useState(null);
    const [customTitle, setCustomTitle] = useState('');
    const [classes, setClasses] = useState([]);
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [aiLimits, setAiLimits] = useState(null);
    const [phase, setPhase] = useState('input');
    const [progress, setProgress] = useState([]);
    const [sourceJob, setSourceJob] = useState(null);
    const [videoTitle, setVideoTitle] = useState('');

    const subscriptionsRef = useRef(new Map());

    const clearSubscriptions = useCallback(() => {
        subscriptionsRef.current.forEach((unsubscribe) => unsubscribe());
        subscriptionsRef.current.clear();
    }, []);

    const subscribeToJob = useCallback((jobId, onUpdate) => {
        if (!jobId || subscriptionsRef.current.has(jobId)) return;
        const unsubscribe = api.subscribeToAiJob(jobId, {
            onUpdate,
            onComplete: onUpdate,
            onError: onUpdate,
        });
        subscriptionsRef.current.set(jobId, unsubscribe);
    }, []);

    useEffect(() => {
        api.getClasses().then(setClasses).catch(() => {});
        api.getAILimits().then(setAiLimits).catch(() => {});
        api.warmupAiFunctions('create-ai-job', 'run-ai-job');
        api.primeEdgeFunctionAuth().catch(() => {});

        return () => clearSubscriptions();
    }, [clearSubscriptions]);

    useEffect(() => {
        if (phase !== 'generating') return;

        const allSettled = progress.length > 0 && progress.every((item) => item.status === 'done' || item.status === 'error');
        if (allSettled) {
            setPhase('done');
            api.getAILimits().then(setAiLimits).catch(() => {});
        }
    }, [phase, progress]);

    const completedResults = useMemo(
        () => progress.filter((item) => item.status === 'done' && item.result),
        [progress],
    );

    const failedResults = useMemo(
        () => progress.filter((item) => item.status === 'error'),
        [progress],
    );

    const handleSourceJobUpdate = useCallback((job) => {
        setSourceJob(job);
        if (!isSourceJobFailure(job)) return;

        const sourceError = getJobErrorMessage(job, 'Source analysis failed');
        setProgress((prev) => prev.map((item) => (
            item.status === 'pending'
                ? {
                    ...item,
                    status: 'error',
                    phase: job?.phase || 'error',
                    progressMessage: sourceError,
                    error: sourceError,
                }
                : item
        )));
    }, []);

    const handleDerivedJobUpdate = useCallback((type, job) => {
        const status = getProgressStatus(job);
        const resultPayload = job?.result_payload || {};
        const errorPayload = job?.error_payload || {};
        const result = job?.status === 'completed' ? resultPayload : null;

        setProgress((prev) => prev.map((item) => (
            item.type !== type
                ? item
                : {
                    ...item,
                    jobId: job?.id || item.jobId,
                    status,
                    phase: job?.phase || item.phase,
                    progressPercent: job?.status === 'completed'
                        ? 100
                        : (job?.progress_percent ?? item.progressPercent ?? 0),
                    progressMessage: job?.progress_message || item.progressMessage,
                    resultPayload,
                    previewSummary: buildDerivedPreviewSummary({ resultPayload }),
                    result: result || item.result,
                    error: status === 'error'
                        ? (errorPayload.message || job?.progress_message || item.error || 'Failed')
                        : null,
                }
        )));

        if (job?.status === 'completed' && selectedTypes.length === 1) {
            const link = getResultLink(type, resultPayload);
            if (link) {
                navigate(link);
            }
        }
    }, [navigate, selectedTypes.length]);

    const handleUrlChange = useCallback((e) => {
        const val = e.target.value;
        setYoutubeUrl(val);
        const nextVideoId = extractVideoId(val);
        setVideoId(nextVideoId);
        setVideoTitle('');
        if (nextVideoId) {
            fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${nextVideoId}&format=json`)
                .then((response) => (response.ok ? response.json() : null))
                .then((data) => { if (data?.title) setVideoTitle(data.title); })
                .catch(() => {});
        }
    }, []);

    const toggleType = useCallback((typeId) => {
        setSelectedTypes((prev) => (
            prev.includes(typeId)
                ? prev.filter((value) => value !== typeId)
                : [...prev, typeId]
        ));
    }, []);

    const handleGenerate = async () => {
        if (!youtubeUrl.trim() || selectedTypes.length === 0) return;

        clearSubscriptions();

        const selectedClassData = classes.find((item) => item.id === selectedClass);
        const effectiveTitle = customTitle.trim() || videoTitle || undefined;
        const sourceTitle = effectiveTitle || 'YouTube Source';
        const initialProgress = selectedTypes.map((type) => ({
            type,
            label: CONTENT_TYPES.find((contentType) => contentType.id === type)?.label,
            status: 'pending',
            phase: 'accepted',
            progressPercent: 0,
            progressMessage: 'Waiting to start',
            result: null,
            resultPayload: {},
            previewSummary: '',
            error: null,
            jobId: null,
        }));

        setPhase('generating');
        setProgress(initialProgress);
        setSourceJob({
            id: 'pending-source-job',
            status: 'queued',
            phase: 'accepted',
            progress_percent: 0,
            progress_message: SOURCE_PHASE_LABELS.accepted,
        });

        try {
            const sourceResponse = await api.createAiJob('youtube_source', {
                youtubeUrl,
                titleSnapshot: sourceTitle,
                className: selectedClassData?.name || null,
            });

            const sourceSnapshot = await api.getAiJob(sourceResponse.jobId).catch(() => ({
                id: sourceResponse.jobId,
                status: sourceResponse.status,
                phase: sourceResponse.phase,
                progress_message: SOURCE_PHASE_LABELS[sourceResponse.phase] || 'Preparing video analysis',
                result_payload: {},
            }));
            setSourceJob(sourceSnapshot);
            subscribeToJob(sourceResponse.jobId, handleSourceJobUpdate);

            let quotaStopped = false;
            for (const type of selectedTypes) {
                if (quotaStopped) {
                    setProgress((prev) => prev.map((item) => (
                        item.type === type
                            ? { ...item, status: 'error', error: 'Quota exceeded' }
                            : item
                    )));
                    continue;
                }

                const contentType = CONTENT_TYPES.find((entry) => entry.id === type);
                if (!contentType) continue;

                try {
                    const jobResponse = await api.createAiJob(contentType.jobKind, {
                        sourceJobId: sourceResponse.jobId,
                        sourceKey: sourceResponse.sourceKey,
                        titleSnapshot: effectiveTitle || undefined,
                        classId: selectedClass || undefined,
                        className: selectedClassData?.name || null,
                    });

                    const jobSnapshot = await api.getAiJob(jobResponse.jobId).catch(() => ({
                        id: jobResponse.jobId,
                        status: jobResponse.status,
                        phase: jobResponse.phase,
                        progress_percent: 0,
                        progress_message: DERIVED_PHASE_LABELS[jobResponse.phase] || 'Queued',
                        result_payload: {},
                    }));

                    handleDerivedJobUpdate(type, jobSnapshot);
                    subscribeToJob(jobResponse.jobId, (job) => handleDerivedJobUpdate(type, job));
                } catch (error) {
                    if (error.status === 429) {
                        quotaStopped = true;
                        setShowPricingModal(true);
                    }

                    setProgress((prev) => prev.map((item) => (
                        item.type === type
                            ? {
                                ...item,
                                status: 'error',
                                error: error.message || 'Generation failed',
                            }
                            : item
                    )));
                }
            }
        } catch (error) {
            setPhase('input');
            setSourceJob(null);
            if (error.status === 429) {
                setShowPricingModal(true);
            } else {
                toast.error(error.message || 'Failed to start YouTube import');
            }
        }
    };

    const handleReset = () => {
        clearSubscriptions();
        setPhase('input');
        setProgress([]);
        setSourceJob(null);
        setYoutubeUrl('');
        setVideoId(null);
        setSelectedTypes([]);
        setCustomTitle('');
        api.getAILimits().then(setAiLimits).catch(() => {});
    };

    const selectedClassData = classes.find((cls) => cls.id === selectedClass);
    const allFailed = completedResults.length === 0 && failedResults.length > 0;
    const finalSummary = allFailed
        ? (isSourceJobFailure(sourceJob)
            ? getJobErrorMessage(sourceJob, 'No items were generated from this video.')
            : 'No items were generated from this video.')
        : `${completedResults.length} item${completedResults.length !== 1 ? 's' : ''} generated from video`;

    return (
        <div className="min-h-full flex flex-col safe-area-top">
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

                {phase === 'input' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col space-y-4 flex-1"
                    >
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
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                                    </div>
                                    <div className="px-5 py-3 flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                                            Video detected - ready to analyze
                                        </p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div>
                            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-secondary mb-3 px-1">
                                What to generate
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                {CONTENT_TYPES.map((ct) => {
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

                        <input
                            type="text"
                            value={customTitle}
                            onChange={(e) => setCustomTitle(e.target.value)}
                            placeholder="Custom title (optional)"
                            className="w-full px-4 py-4 glass-item rounded-2xl border border-claude-border/50 focus:border-claude-accent/50 outline-none transition-colors font-display font-bold text-base text-botanical-parchment placeholder:text-claude-secondary/40 bg-transparent"
                        />

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

                        {selectedTypes.length > 0 && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                className="font-mono text-[10px] uppercase tracking-[0.14em] text-claude-secondary text-center"
                            >
                                Uses {selectedTypes.length} AI generation{selectedTypes.length > 1 ? 's' : ''}
                            </motion.p>
                        )}

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

                {phase === 'generating' && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className="flex flex-col space-y-4 flex-1"
                    >
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
                                            {sourceJob?.progress_message || SOURCE_PHASE_LABELS[sourceJob?.phase] || 'Analyzing video content...'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {sourceJob && (
                            <div className="glass-panel-premium rounded-[1.75rem] p-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                                            Source Analysis
                                        </p>
                                        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-botanical-parchment mt-1">
                                            {sourceJob.progress_message || SOURCE_PHASE_LABELS[sourceJob.phase] || 'Preparing'}
                                        </p>
                                    </div>
                                    <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-claude-secondary">
                                        {sourceJob.status === 'completed'
                                            ? 'Ready'
                                            : `${sourceJob.progress_percent ?? 0}%`}
                                    </span>
                                </div>
                                <div className="mt-3 h-1.5 w-full bg-claude-border/30 rounded-full overflow-hidden">
                                    <motion.div
                                        className="h-full rounded-full bg-red-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: sourceJob.status === 'completed' ? '100%' : `${sourceJob.progress_percent ?? 0}%` }}
                                        transition={{ duration: 0.4, ease: 'easeOut' }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="glass-panel-premium rounded-[1.75rem] p-5 space-y-3">
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                                Generating study materials
                            </p>

                            {progress.map((item, idx) => {
                                const ct = CONTENT_TYPES.find((contentType) => contentType.id === item.type);
                                const Icon = ct?.icon || Sparkles;
                                return (
                                    <motion.div
                                        key={item.type}
                                        initial={{ opacity: 0, x: -8 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.06 }}
                                        className="glass-item rounded-2xl px-4 py-3.5"
                                    >
                                        <div className="flex items-center gap-3">
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
                                                    {getDerivedStatusText(item, sourceJob)}
                                                </p>
                                                {(item.status === 'generating' || item.status === 'done') && (
                                                    <div className="mt-2 h-1.5 w-full bg-claude-border/30 rounded-full overflow-hidden">
                                                        <motion.div
                                                            className="h-full rounded-full"
                                                            style={{ backgroundColor: ct?.color }}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: item.status === 'done' ? '100%' : `${item.progressPercent || 0}%` }}
                                                            transition={{ duration: 0.4, ease: 'easeOut' }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <AnimatePresence>
                                            {item.previewSummary && item.status === 'generating' && (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 8 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, y: 8 }}
                                                    className="mt-3 rounded-xl border border-claude-border/40 bg-claude-surface/60 px-3 py-2"
                                                >
                                                    <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-claude-secondary mb-1">
                                                        Live preview
                                                    </p>
                                                    <p className="text-xs text-botanical-parchment line-clamp-3">
                                                        {item.previewSummary}
                                                    </p>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {phase === 'done' && (
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                        className="flex flex-col space-y-4 flex-1"
                    >
                        <div className="glass-panel-premium rounded-[1.75rem] p-6 text-center">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20, delay: 0.1 }}
                                className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 ${
                                    allFailed
                                        ? 'bg-red-500/10 border border-red-500/30'
                                        : 'bg-claude-accent/15 border border-claude-accent/30'
                                }`}
                            >
                                {allFailed ? (
                                    <X className="w-7 h-7 text-red-400" />
                                ) : (
                                    <Check className="w-7 h-7 text-claude-accent" />
                                )}
                            </motion.div>
                            <h2 className="font-display text-2xl font-bold text-botanical-parchment mb-1">
                                {allFailed ? 'Generation Failed' : completedResults.length > 0 ? 'Done!' : 'Generation Complete'}
                            </h2>
                            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-claude-secondary">
                                {finalSummary}
                            </p>
                        </div>

                        <div className="space-y-3">
                            {progress.map((item, idx) => {
                                const ct = CONTENT_TYPES.find((contentType) => contentType.id === item.type);
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

            <PickerSheet
                open={showClassPicker}
                items={classes}
                selectedId={selectedClass}
                onClose={() => setShowClassPicker(false)}
                onSelect={setSelectedClass}
            />

            {showPricingModal && (
                <PricingModal onClose={() => setShowPricingModal(false)} />
            )}
        </div>
    );
}
