import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ChevronLeft, Check, Loader2, Layers, BookOpen, ClipboardCheck, Trash2, X, ChevronDown,
    Mic, Sparkles, AlertCircle
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import useAudioRecorder from '../hooks/useAudioRecorder';
import TiptapEditor from '../components/editor/TiptapEditor';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import { createArrayStreamParser } from '../utils/streamingJsonParser';

function formatDuration(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function WaveformBars() {
    return (
        <div className="waveform-bars" aria-hidden="true">
            <div className="waveform-bar" />
            <div className="waveform-bar" />
            <div className="waveform-bar" />
        </div>
    );
}

export default function NoteEditor() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToast();
    const isNew = id === 'new';

    const [noteId, setNoteId] = useState(isNew ? null : id);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState(null);
    const [classId, setClassId] = useState(searchParams.get('classId') || null);
    const [classes, setClasses] = useState([]);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);

    // AI generation states
    const [generating, setGenerating] = useState(null); // 'flashcards' | 'guide' | 'exam' | null
    const [streamingCards, setStreamingCards] = useState([]);
    const [generatingStatus, setGeneratingStatus] = useState('');

    // Audio & enhancement states
    const [showEnhanceBanner, setShowEnhanceBanner] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [enhanceError, setEnhanceError] = useState(null);
    const [audioPath, setAudioPath] = useState(null);

    const saveTimerRef = useRef(null);
    const contentRef = useRef(content);
    const titleRef = useRef(title);

    const recorder = useAudioRecorder(noteId);

    // Warmup AI edge functions on mount
    useEffect(() => {
        api.warmupAiFunctions('generate-deck', 'generate-guide', 'generate-exam', 'enhance-notes');
    }, []);

    // Load note data
    useEffect(() => {
        const load = async () => {
            try {
                const classesData = await api.getClasses().catch(() => []);
                setClasses(classesData);

                if (!isNew) {
                    const note = await api.getNote(id);
                    setTitle(note.title || '');
                    setContent(note.content || {});
                    setClassId(note.class_id || null);
                    setAudioPath(note.audio_url || null);
                    titleRef.current = note.title || '';
                    contentRef.current = note.content || {};

                    if (note.enhanced_content) {
                        setContent(note.enhanced_content);
                        contentRef.current = note.enhanced_content;
                    }
                }
            } catch (err) {
                toast.error('Failed to load note');
                navigate('/notes');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isNew, navigate, toast]);

    // Show enhance banner when recording stops
    useEffect(() => {
        if (recorder.state === 'stopped') {
            setShowEnhanceBanner(true);
        }
    }, [recorder.state]);

    // Auto-save with debounce
    const saveNote = useCallback(async () => {
        if (!noteId && !isNew) return;

        setSaving(true);
        try {
            if (!noteId) {
                // Create new note
                const newNote = await api.createNote(
                    titleRef.current || 'Untitled',
                    contentRef.current || {},
                    classId
                );
                setNoteId(newNote.id);
                window.history.replaceState(null, '', `/note/${newNote.id}`);
            } else {
                await api.updateNote(noteId, {
                    title: titleRef.current || 'Untitled',
                    content: contentRef.current,
                    class_id: classId,
                });
            }
            setSaved(true);
        } catch (err) {
            toast.error('Failed to save');
        } finally {
            setSaving(false);
        }
    }, [noteId, isNew, classId, toast]);

    const debounceSave = useCallback(() => {
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(saveNote, 800);
    }, [saveNote]);

    const handleTitleChange = (e) => {
        const val = e.target.value;
        setTitle(val);
        titleRef.current = val;
        debounceSave();
    };

    const handleContentUpdate = useCallback((json) => {
        contentRef.current = json;
        debounceSave();
    }, [debounceSave]);

    const handleClassChange = async (newClassId) => {
        setClassId(newClassId);
        setShowClassPicker(false);
        if (noteId) {
            try {
                await api.updateNote(noteId, { class_id: newClassId });
            } catch {
                // Silent fail for class change
            }
        }
    };

    // Extract plain text from Tiptap JSON for AI generation
    const extractText = (doc) => {
        if (!doc || !doc.content) return '';
        const texts = [];
        const walk = (nodes) => {
            for (const node of nodes) {
                if (node.text) texts.push(node.text);
                if (node.content) walk(node.content);
            }
        };
        walk(doc.content);
        return texts.join('\n');
    };

    // ─── Audio recording ───

    const handleMicToggle = async () => {
        if (recorder.state === 'recording') {
            recorder.stop();
        } else if (recorder.state === 'idle' || recorder.state === 'error') {
            // Ensure note is saved before recording (need a noteId for storage path)
            if (!noteId) {
                setSaving(true);
                try {
                    const newNote = await api.createNote(
                        titleRef.current || 'Untitled',
                        contentRef.current || {},
                        classId
                    );
                    setNoteId(newNote.id);
                    window.history.replaceState(null, '', `/note/${newNote.id}`);
                    setSaved(true);
                } catch {
                    toast.error('Save note before recording');
                    setSaving(false);
                    return;
                }
                setSaving(false);
            }
            recorder.start();
        }
    };

    const handleEnhance = async () => {
        const blob = recorder.getBlob();
        if (!blob || !noteId) return;

        setEnhancing(true);
        setEnhanceError(null);
        recorder.setProcessingState('uploading');

        try {
            const uploadResult = await api.uploadNoteAudio(noteId, blob);
            const storagePath = uploadResult.path;
            setAudioPath(storagePath);

            recorder.setProcessingState('processing');

            const userNotes = extractText(contentRef.current).trim() || null;
            const selectedClassName = classes.find(c => c.id === classId)?.name || null;
            const stream = await api.enhanceNoteWithAudioStream(
                noteId, storagePath, userNotes,
                titleRef.current || 'Untitled', selectedClassName
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    err.canWatchAd = event.data.canWatchAd;
                    throw err;
                } else if (event.type === 'done') {
                    setContent(event.data.enhanced_content);
                    contentRef.current = event.data.enhanced_content;
                    await api.updateNote(noteId, { content: event.data.enhanced_content });
                    setShowEnhanceBanner(false);
                    setAudioPath(null);
                    recorder.setProcessingState('complete');
                    toast.success('Notes enhanced with AI');
                    return;
                }
            }
        } catch (err) {
            recorder.setProcessingState('error');
            if (err.status === 429) {
                setShowPricingModal(true);
            } else {
                setEnhanceError(err.message || 'Enhancement failed');
            }
        } finally {
            setEnhancing(false);
        }
    };

    // ─── AI generation handlers (all streaming) ───

    const handleGenerateFlashcards = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Note is empty'); return; }

        setGenerating('flashcards');
        setStreamingCards([]);
        try {
            const selectedClassName = classes.find(c => c.id === classId)?.name || null;
            const stream = await api.generateAiDeckStream(
                text, null, `${titleRef.current || 'Note'} - AI`, classId, selectedClassName
            );

            const parser = createArrayStreamParser((card) => {
                setStreamingCards(prev => [...prev, card]);
            });

            for await (const event of stream.chunks()) {
                if (event.type === 'chunk') parser.feed(event.data.text);
                else if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    err.canWatchAd = event.data.canWatchAd;
                    throw err;
                } else if (event.type === 'done') {
                    toast.success(`Generated ${event.data.card_count} flashcards!`);
                    navigate(`/deck/${event.data.deck_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate flashcards');
        } finally {
            setGenerating(null);
            setStreamingCards([]);
        }
    };

    const handleGenerateGuide = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Note is empty'); return; }

        setGenerating('guide');
        setGeneratingStatus('');
        try {
            const selectedClassName = classes.find(c => c.id === classId)?.name || null;
            const stream = await api.generateAiGuideStream(
                text, null, `${titleRef.current || 'Note'} Guide`, noteId, classId, selectedClassName
            );

            let sectionCount = 0;
            for await (const event of stream.chunks()) {
                if (event.type === 'chunk') {
                    // Count sections from headings in streamed text
                    const headingMatches = event.data.text.match(/"level":\s*1/g);
                    if (headingMatches) {
                        sectionCount += headingMatches.length;
                        setGeneratingStatus(`${sectionCount} section${sectionCount !== 1 ? 's' : ''}`);
                    }
                } else if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    err.canWatchAd = event.data.canWatchAd;
                    throw err;
                } else if (event.type === 'done') {
                    toast.success('Study guide generated!');
                    navigate(`/guide/${event.data.guide_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate guide');
        } finally {
            setGenerating(null);
            setGeneratingStatus('');
        }
    };

    const handleGenerateExam = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) { toast.error('Note is empty'); return; }

        setGenerating('exam');
        setStreamingCards([]);
        try {
            const selectedClassName = classes.find(c => c.id === classId)?.name || null;
            const stream = await api.generateAiExamStream(
                text, null, `${titleRef.current || 'Note'} Exam`, 'notes', noteId, classId, selectedClassName
            );

            const parser = createArrayStreamParser((question) => {
                setStreamingCards(prev => [...prev, question]);
            });

            for await (const event of stream.chunks()) {
                if (event.type === 'chunk') parser.feed(event.data.text);
                else if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    err.canWatchAd = event.data.canWatchAd;
                    throw err;
                } else if (event.type === 'done') {
                    toast.success(`Generated ${event.data.question_count} questions!`);
                    navigate(`/exam/${event.data.exam_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate exam');
        } finally {
            setGenerating(null);
            setStreamingCards([]);
        }
    };

    const handleDelete = async () => {
        if (!noteId) { navigate('/notes'); return; }
        try {
            await api.deleteNote(noteId);
            toast.success('Note deleted');
            navigate('/notes');
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
        </div>
    );

    const selectedClass = classes.find(c => c.id === classId);
    const isRecording = recorder.state === 'recording';
    const micDisabled = enhancing || !!generating || recorder.state === 'uploading' || recorder.state === 'processing';

    const micLabel = isRecording
        ? `Stop recording (${formatDuration(recorder.duration)})`
        : recorder.state === 'uploading' ? 'Uploading audio'
        : recorder.state === 'processing' ? 'Enhancing notes'
        : 'Record lecture';

    return (
        <>
        <div className="relative min-h-screen pb-8">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm}
                title="Delete this note?"
                message="This note will be permanently deleted."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(false)}
            />

            {/* Header */}
            <div className="sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 pt-3 pb-2">
                {/* Top row: nav + save + delete */}
                <div className="flex items-center justify-between max-w-3xl mx-auto mb-2">
                    <button onClick={() => navigate('/notes')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Notes</span>
                    </button>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            {saving ? (
                                <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                            ) : saved ? (
                                <Check className="w-3.5 h-3.5 text-claude-accent" />
                            ) : null}
                            <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary">
                                {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                            </span>
                        </div>
                        <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* AI Actions row */}
                <div className="max-w-3xl mx-auto flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                    <button
                        onClick={handleMicToggle}
                        disabled={micDisabled}
                        aria-label={micLabel}
                        className={`inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border transition-all tap-action shrink-0 disabled:opacity-50 ${
                            isRecording
                                ? 'text-claude-accent border-claude-accent/40 bg-claude-accent/10'
                                : 'border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30'
                        }`}
                    >
                        {isRecording ? (
                            <><WaveformBars /><span className="tabular-nums">{formatDuration(recorder.duration)}</span></>
                        ) : recorder.state === 'uploading' || recorder.state === 'processing' ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Processing</span></>
                        ) : (
                            <><Mic className="w-3.5 h-3.5" /><span>Audio</span></>
                        )}
                    </button>

                    <div className="w-px h-4 bg-claude-border/30 shrink-0 mx-0.5" />

                    <button
                        onClick={handleGenerateFlashcards}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                        <span>{generating === 'flashcards' && streamingCards.length > 0 ? `${streamingCards.length} cards` : 'Flashcards'}</span>
                    </button>

                    <button
                        onClick={handleGenerateGuide}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'guide' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                        <span>{generating === 'guide' && generatingStatus ? generatingStatus : 'Study Guide'}</span>
                    </button>

                    <button
                        onClick={handleGenerateExam}
                        disabled={!!generating}
                        className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                    >
                        {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                        <span>{generating === 'exam' && streamingCards.length > 0 ? `${streamingCards.length} questions` : 'Mock Exam'}</span>
                    </button>
                </div>
            </div>

            {/* Editor Area */}
            <div className="max-w-3xl mx-auto px-4 pt-6">
                {/* Recovery banner */}
                <AnimatePresence>
                    {recorder.hasRecoveryData && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-4 p-3 rounded-xl glass-panel border border-claude-border flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-2 text-claude-secondary">
                                <AlertCircle className="w-4 h-4 text-claude-accent shrink-0" />
                                <span className="text-[11px] font-mono">Unfinished recording found</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={async () => {
                                        await recorder.recoverAudio();
                                        setShowEnhanceBanner(true);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-claude-accent/10 text-claude-accent hover:bg-claude-accent/20 transition-colors tap-action"
                                >
                                    Recover
                                </button>
                                <button
                                    onClick={() => recorder.discardRecovery()}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider text-claude-secondary hover:text-red-400 transition-colors tap-action"
                                >
                                    Discard
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Enhancement banner */}
                <AnimatePresence>
                    {showEnhanceBanner && !enhancedContent && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-4 p-3 rounded-xl glass-panel border border-claude-accent/20 flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-claude-accent shrink-0" />
                                <span className="text-[11px] font-mono text-claude-text">
                                    {recorder.duration < 10
                                        ? 'Recording may be too short for reliable notes'
                                        : 'Lecture captured \u2014 Enhance your notes with AI'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleEnhance}
                                    disabled={enhancing}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider bg-claude-accent text-claude-bg hover:bg-claude-accent/90 transition-colors tap-action disabled:opacity-50"
                                >
                                    {enhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    Enhance
                                </button>
                                <button
                                    onClick={() => setShowEnhanceBanner(false)}
                                    className="p-1 text-claude-secondary hover:text-claude-text transition-colors tap-action"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Enhancement error banner */}
                <AnimatePresence>
                    {enhanceError && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-4 p-3 rounded-xl glass-panel border border-red-400/20 flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                                <span className="text-[11px] font-mono text-claude-text">
                                    Enhancement failed. Your notes are saved.
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleEnhance}
                                    disabled={enhancing}
                                    className="px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider text-claude-accent hover:bg-claude-accent/10 transition-colors tap-action"
                                >
                                    Retry
                                </button>
                                <button
                                    onClick={() => setEnhanceError(null)}
                                    className="p-1 text-claude-secondary hover:text-claude-text transition-colors tap-action"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Class picker */}
                <div className="mb-4 relative">
                    <button
                        onClick={() => setShowClassPicker(!showClassPicker)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent transition-colors tap-action"
                        style={selectedClass ? { borderColor: selectedClass.color + '40', color: selectedClass.color, backgroundColor: selectedClass.color + '10' } : {}}
                    >
                        {selectedClass ? selectedClass.name : 'No class'}
                        <ChevronDown className="w-3 h-3" />
                    </button>

                    <AnimatePresence>
                        {showClassPicker && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowClassPicker(false)} />
                                <motion.div
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    className="absolute left-0 top-full mt-2 w-56 glass-panel border border-claude-border rounded-xl z-20 p-1.5 shadow-[0_8px_32px_rgba(0,0,0,0.4)]"
                                >
                                    <button
                                        onClick={() => handleClassChange(null)}
                                        className={`w-full p-2.5 rounded-lg text-left text-[11px] font-mono uppercase tracking-wider transition-colors ${!classId ? 'bg-claude-accent/10 text-claude-accent' : 'text-claude-secondary hover:bg-claude-surface'}`}
                                    >
                                        No class
                                    </button>
                                    {classes.map(cls => (
                                        <button
                                            key={cls.id}
                                            onClick={() => handleClassChange(cls.id)}
                                            className={`w-full p-2.5 rounded-lg text-left text-[11px] font-mono uppercase tracking-wider transition-colors flex items-center gap-2 ${classId === cls.id ? 'bg-claude-accent/10 text-claude-accent' : 'text-claude-secondary hover:bg-claude-surface'}`}
                                        >
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cls.color }} />
                                            {cls.name}
                                        </button>
                                    ))}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>
                </div>

                {/* Title */}
                <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="Untitled"
                    className="w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none mb-2 tracking-tight leading-tight"
                />

                {/* Tiptap Editor */}
                <TiptapEditor
                    content={content}
                    onUpdate={handleContentUpdate}
                    editable={true}
                    placeholder="Start writing, or type / for commands..."
                />
            </div>

        </div>

        {/* Streaming card preview during flashcard generation */}
        <AnimatePresence>
            {generating === 'flashcards' && streamingCards.length > 0 && (
                <motion.div
                    initial={{ y: 40, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 40, opacity: 0 }}
                    className="fixed bottom-0 left-0 right-0 max-h-[40vh] overflow-auto bg-claude-bg/95 backdrop-blur-md border-t border-claude-border/20 p-4 space-y-2 z-40"
                >
                    <p className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary mb-2">
                        {streamingCards.length} card{streamingCards.length !== 1 ? 's' : ''} generated
                    </p>
                    {streamingCards.slice(-3).map((card, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="glass-panel border border-claude-border rounded-xl p-3"
                        >
                            <p className="text-xs font-semibold text-claude-text">{card.front}</p>
                            <p className="text-xs text-claude-secondary mt-1">{card.back}</p>
                        </motion.div>
                    ))}
                </motion.div>
            )}
        </AnimatePresence>
        </>
    );
}
