import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
    ChevronLeft, Check, Loader2, Layers, BookOpen, ClipboardCheck, Trash2, X, ChevronDown,
    Mic, Sparkles, AlertCircle, Lock, Share2
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import useAudioRecorder from '../hooks/useAudioRecorder';
import TiptapEditor from '../components/editor/TiptapEditor';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import { createArrayStreamParser } from '../utils/streamingJsonParser';
import ShareToFriendModal from '../components/ShareToFriendModal';
import {
    buildShareMessageContent,
    buildSharedPreviewText,
    cloneRichTextDoc,
    extractTextFromDoc,
    serializeSharedPayload,
} from '../utils/sharedResources';

const ACTIVE_AI_JOB_STATUSES = ['queued', 'running', 'streaming', 'saving'];

const ENHANCEMENT_PHASE_LABELS = {
    accepted: 'Accepted AI job',
    uploading_audio: 'Uploading lecture audio',
    fetching_audio: 'Fetching lecture audio',
    processing_media: 'Preparing lecture audio',
    drafting: 'Drafting enhanced notes',
    enriching: 'Enriching with key concepts and questions',
    saving: 'Saving enhanced notes',
    done: 'Enhanced notes ready',
    error: 'Enhancement failed',
};

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

const createDocFromSections = (sections) => ({
    type: 'doc',
    content: Array.isArray(sections) ? sections : [],
});

const isEnhancementJobActive = (job) => ACTIVE_AI_JOB_STATUSES.includes(job?.status);

const getJobPreviewDoc = (job) => {
    const payload = job?.result_payload || {};
    if (payload.preview_doc) return payload.preview_doc;
    if (payload.final_doc) return payload.final_doc;
    if (Array.isArray(payload.preview_sections) && payload.preview_sections.length > 0) {
        return createDocFromSections(payload.preview_sections);
    }
    return null;
};

const getJobFinalDoc = (job) => {
    const payload = job?.result_payload || {};
    if (payload.final_doc) return payload.final_doc;
    return getJobPreviewDoc(job);
};

const getEnhancementStatusText = (job) => (
    job?.progress_message
    || ENHANCEMENT_PHASE_LABELS[job?.phase]
    || 'Enhancing notes'
);

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
    const [showShareModal, setShowShareModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [sharingTo, setSharingTo] = useState(null);

    const [generating, setGenerating] = useState(null);
    const [streamingCards, setStreamingCards] = useState([]);
    const [generatingStatus, setGeneratingStatus] = useState('');

    const [showEnhanceBanner, setShowEnhanceBanner] = useState(false);
    const [enhancing, setEnhancing] = useState(false);
    const [enhanceError, setEnhanceError] = useState(null);
    const [audioPath, setAudioPath] = useState(null);
    const [activeEnhancementJob, setActiveEnhancementJob] = useState(null);
    const [enhancementPreviewDoc, setEnhancementPreviewDoc] = useState(null);

    const toastRef = useRef(toast);
    const saveTimerRef = useRef(null);
    const contentRef = useRef(content);
    const titleRef = useRef(title);
    const activeSaveRef = useRef(Promise.resolve(null));
    const enhancementUnsubscribeRef = useRef(null);
    const handledJobStatesRef = useRef(new Set());
    const enhancementMetricsRef = useRef({
        clickAt: null,
        ackMs: null,
        firstPhaseMs: null,
        firstPreviewMs: null,
    });

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    const recorder = useAudioRecorder(noteId);

    const clearEnhancementSubscription = useCallback(() => {
        if (enhancementUnsubscribeRef.current) {
            enhancementUnsubscribeRef.current();
            enhancementUnsubscribeRef.current = null;
        }
    }, []);

    const extractText = useCallback((doc) => {
        return extractTextFromDoc(doc).replace(/\s+/g, ' ').trim();
    }, []);

    const logEnhancementMetrics = useCallback((job) => {
        const payload = job?.result_payload || {};
        const serverMetrics = payload.metrics || {};
        const clientMetrics = enhancementMetricsRef.current;
        if (clientMetrics.clickAt == null) return;

        console.info('[ai-latency]', {
            ai_job_kind: 'note_enhancement',
            ai_ack_ms: clientMetrics.ackMs,
            ai_first_phase_ms: clientMetrics.firstPhaseMs,
            ai_first_preview_ms: clientMetrics.firstPreviewMs,
            ai_done_ms: Math.round(performance.now() - clientMetrics.clickAt),
            ai_model_stage: serverMetrics.ai_model_stage || null,
            ai_failure_phase: job?.status === 'failed' ? job?.phase || null : null,
        });
    }, []);

    const handleEnhancementJobUpdate = useCallback((job) => {
        setActiveEnhancementJob(job || null);
        const previewDoc = getJobPreviewDoc(job);
        setEnhancementPreviewDoc(previewDoc);

        if (!job) {
            setEnhancing(false);
            return;
        }

        const metrics = enhancementMetricsRef.current;
        if (metrics.clickAt != null && metrics.firstPhaseMs == null && job.phase && job.phase !== 'accepted') {
            metrics.firstPhaseMs = Math.round(performance.now() - metrics.clickAt);
        }
        if (metrics.clickAt != null && metrics.firstPreviewMs == null && previewDoc) {
            metrics.firstPreviewMs = Math.round(performance.now() - metrics.clickAt);
        }

        if (isEnhancementJobActive(job)) {
            setEnhancing(true);
            setShowEnhanceBanner(false);
            setEnhanceError(null);
            if (job.phase === 'uploading_audio') {
                recorder.setProcessingState('uploading');
            } else {
                recorder.setProcessingState('processing');
            }
            return;
        }

        const handledKey = `${job.id}:${job.status}`;
        if (handledJobStatesRef.current.has(handledKey)) {
            return;
        }
        handledJobStatesRef.current.add(handledKey);

        if (job.status === 'completed') {
            const finalDoc = getJobFinalDoc(job);
            if (finalDoc) {
                setContent(finalDoc);
                contentRef.current = finalDoc;
            }
            setSaved(true);
            setEnhancing(false);
            setEnhanceError(null);
            setShowEnhanceBanner(false);
            setEnhancementPreviewDoc(null);
            setActiveEnhancementJob(null);
            setAudioPath(null);
            recorder.setProcessingState('complete');
            clearEnhancementSubscription();
            logEnhancementMetrics(job);
            toast.success('Notes enhanced with AI');
            return;
        }

        if (job.status === 'failed' || job.status === 'cancelled') {
            setEnhancing(false);
            setEnhancementPreviewDoc(null);
            setActiveEnhancementJob(null);
            recorder.setProcessingState('error');
            clearEnhancementSubscription();
            logEnhancementMetrics(job);
            setEnhanceError(
                job?.error_payload?.message
                || job?.progress_message
                || 'Enhancement failed',
            );
        }
    }, [clearEnhancementSubscription, logEnhancementMetrics, recorder, toast]);

    const subscribeToEnhancementJob = useCallback((jobId) => {
        clearEnhancementSubscription();
        enhancementUnsubscribeRef.current = api.subscribeToAiJob(jobId, {
            onUpdate: handleEnhancementJobUpdate,
            onComplete: handleEnhancementJobUpdate,
            onError: handleEnhancementJobUpdate,
        });
    }, [clearEnhancementSubscription, handleEnhancementJobUpdate]);

    useEffect(() => {
        api.warmupAiFunctions(
            'generate-deck',
            'generate-guide',
            'generate-exam',
            'enhance-notes',
            'create-ai-job',
            'run-ai-job',
        );
        api.primeEdgeFunctionAuth().catch(() => {});
    }, []);

    useEffect(() => {
        const load = async () => {
            try {
                const classesData = await api.getClasses().catch(() => []);
                setClasses(classesData);

                if (!isNew) {
                    const note = await api.getNote(id);
                    const initialContent = note.enhanced_content || note.content || {};

                    setTitle(note.title || '');
                    setContent(initialContent);
                    setClassId(note.class_id || null);
                    setAudioPath(note.audio_url || null);
                    titleRef.current = note.title || '';
                    contentRef.current = initialContent;
                }
            } catch {
                toastRef.current.error('Failed to load note');
                navigate('/notes');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, isNew, navigate]);

    useEffect(() => {
        if (recorder.state === 'stopped' && !isEnhancementJobActive(activeEnhancementJob)) {
            setShowEnhanceBanner(true);
        }
    }, [activeEnhancementJob, recorder.state]);

    useEffect(() => {
        if (!noteId) return undefined;

        let cancelled = false;

        const restoreEnhancementJob = async () => {
            try {
                const [job] = await api.listAiJobs({
                    kind: 'note_enhancement',
                    targetType: 'note',
                    targetId: noteId,
                    statuses: ACTIVE_AI_JOB_STATUSES,
                    limit: 1,
                });

                if (cancelled) return;

                if (job) {
                    handleEnhancementJobUpdate(job);
                    subscribeToEnhancementJob(job.id);
                }
            } catch (error) {
                console.warn('[NoteEditor] Failed to restore enhancement job', error?.message || error);
            }
        };

        restoreEnhancementJob();

        return () => {
            cancelled = true;
            clearEnhancementSubscription();
        };
    }, [clearEnhancementSubscription, handleEnhancementJobUpdate, noteId, subscribeToEnhancementJob]);

    const saveNote = useCallback(async () => {
        if (!noteId && !isNew) return;

        setSaving(true);
        try {
            if (!noteId) {
                const contentSnapshot = cloneRichTextDoc(contentRef.current || {});
                const newNote = await api.createNote(
                    titleRef.current || 'Untitled',
                    contentSnapshot,
                    classId,
                );
                setNoteId(newNote.id);
                window.history.replaceState(null, '', `/note/${newNote.id}`);
                setSaved(true);
                return newNote;
            } else {
                const contentSnapshot = cloneRichTextDoc(contentRef.current);
                const updatedNote = await api.updateNote(noteId, {
                    title: titleRef.current || 'Untitled',
                    content: contentSnapshot,
                    class_id: classId,
                });
                setSaved(true);
                return updatedNote;
            }
        } catch {
            toast.error('Failed to save');
            throw new Error('Failed to save');
        } finally {
            setSaving(false);
        }
    }, [classId, isNew, noteId, toast]);

    const commitSave = useCallback(() => {
        saveTimerRef.current = null;
        const pendingSave = saveNote();
        activeSaveRef.current = pendingSave;
        return pendingSave;
    }, [saveNote]);

    const debounceSave = useCallback(() => {
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => {
            commitSave().catch(() => {});
        }, 800);
    }, [commitSave]);

    const handleTitleChange = (e) => {
        const val = e.target.value;
        setTitle(val);
        titleRef.current = val;
        debounceSave();
    };

    const handleContentUpdate = useCallback((json) => {
        setContent(json);
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
                // Ignore class save failures here.
            }
        }
    };

    const flushPendingSave = useCallback(async () => {
        if (saveTimerRef.current) {
            return commitSave();
        }

        if (saving) {
            return activeSaveRef.current;
        }

        if (!saved || !noteId) {
            return commitSave();
        }

        return { id: noteId };
    }, [commitSave, noteId, saved, saving]);

    const handleShareNote = async () => {
        setShowShareModal(true);
        setLoadingFriends(true);
        try {
            const friendsData = await api.getFriends();
            setFriends(friendsData);
        } catch (err) {
            toast.error(err?.message || 'Failed to load friends');
        } finally {
            setLoadingFriends(false);
        }
    };

    const handleSendNoteToFriend = async (friendId) => {
        if (sharingTo) return;
        setSharingTo(friendId);

        try {
            const savedNote = await flushPendingSave();
            const sharedNoteId = savedNote?.id || noteId;
            const contentSnapshot = cloneRichTextDoc(contentRef.current);

            await api.sendMessage(
                friendId,
                buildShareMessageContent('note', titleRef.current || 'Untitled'),
                'note',
                serializeSharedPayload({
                    kind: 'note',
                    sourceId: sharedNoteId,
                    title: titleRef.current || 'Untitled',
                    previewText: buildSharedPreviewText(contentSnapshot),
                })
            );

            toast.success('Note shared successfully!');
            setShowShareModal(false);
        } catch (err) {
            toast.error(err?.message || 'Failed to share note');
        } finally {
            setSharingTo(null);
        }
    };

    const handleMicToggle = async () => {
        if (recorder.state === 'recording') {
            recorder.stop();
            return;
        }

        if (recorder.state !== 'idle' && recorder.state !== 'error') {
            return;
        }

        if (!noteId) {
            setSaving(true);
            try {
                const newNote = await api.createNote(
                    titleRef.current || 'Untitled',
                    contentRef.current || {},
                    classId,
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
    };

    const handleEnhance = async () => {
        const blob = recorder.getBlob();
        if (!blob || !noteId) return;

        setEnhancing(true);
        setEnhanceError(null);
        setShowEnhanceBanner(false);
        recorder.setProcessingState('uploading');
        enhancementMetricsRef.current = {
            clickAt: performance.now(),
            ackMs: null,
            firstPhaseMs: null,
            firstPreviewMs: null,
        };

        setActiveEnhancementJob({
            id: 'pending-note-enhancement',
            status: 'queued',
            phase: 'uploading_audio',
            progress_percent: 2,
            progress_message: ENHANCEMENT_PHASE_LABELS.uploading_audio,
            result_payload: {},
        });
        setEnhancementPreviewDoc(null);

        try {
            const uploadResult = await api.uploadNoteAudio(noteId, blob);
            const storagePath = uploadResult.path;
            setAudioPath(storagePath);

            const userNotesSnapshot = extractText(contentRef.current).trim() || null;
            const selectedClassName = classes.find((c) => c.id === classId)?.name || null;

            const jobResponse = await api.createAiJob('note_enhancement', {
                noteId,
                audioPath: storagePath,
                userNotesSnapshot,
                titleSnapshot: titleRef.current || 'Untitled',
                className: selectedClassName,
            });

            enhancementMetricsRef.current.ackMs = Math.round(
                performance.now() - enhancementMetricsRef.current.clickAt,
            );

            const job = await api.getAiJob(jobResponse.jobId).catch(() => ({
                id: jobResponse.jobId,
                status: jobResponse.status,
                phase: jobResponse.phase,
                progress_message: getEnhancementStatusText(jobResponse),
                result_payload: {},
            }));

            handleEnhancementJobUpdate(job);
            subscribeToEnhancementJob(jobResponse.jobId);
        } catch (err) {
            clearEnhancementSubscription();
            setActiveEnhancementJob(null);
            setEnhancementPreviewDoc(null);
            setEnhancing(false);
            recorder.setProcessingState('error');
            if (err.status === 429) {
                setShowPricingModal(true);
            } else {
                setEnhanceError(err.message || 'Enhancement failed');
            }
        }
    };

    const handleGenerateFlashcards = async () => {
        const text = extractText(contentRef.current);
        if (!text.trim()) {
            toast.error('Note is empty');
            return;
        }

        setGenerating('flashcards');
        setStreamingCards([]);
        try {
            const selectedClassName = classes.find((c) => c.id === classId)?.name || null;
            const stream = await api.generateAiDeckStream(
                text,
                null,
                `${titleRef.current || 'Note'} - AI`,
                classId,
                selectedClassName,
            );

            const parser = createArrayStreamParser((card) => {
                setStreamingCards((prev) => [...prev, card]);
            });

            for await (const event of stream.chunks()) {
                if (event.type === 'chunk') {
                    parser.feed(event.data.text);
                } else if (event.type === 'error') {
                    const error = new Error(event.data.message);
                    error.status = event.data.status;
                    error.canWatchAd = event.data.canWatchAd;
                    throw error;
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
        if (!text.trim()) {
            toast.error('Note is empty');
            return;
        }

        setGenerating('guide');
        setGeneratingStatus('Drafting workbook');
        try {
            const selectedClassName = classes.find((c) => c.id === classId)?.name || null;
            const stream = await api.generateAiGuideStream(
                text,
                null,
                `${titleRef.current || 'Note'} Recall Workbook`,
                noteId,
                classId,
                selectedClassName,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'chunk') {
                    if (event.data.text.includes('"mini_quiz"')) {
                        setGeneratingStatus('Adding checkpoints');
                    } else if (event.data.text.includes('"common_traps"')) {
                        setGeneratingStatus('Polishing review cues');
                    }
                } else if (event.type === 'error') {
                    const error = new Error(event.data.message);
                    error.status = event.data.status;
                    error.canWatchAd = event.data.canWatchAd;
                    throw error;
                } else if (event.type === 'done') {
                    toast.success('Recall workbook generated!');
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
        if (!text.trim()) {
            toast.error('Note is empty');
            return;
        }

        setGenerating('exam');
        setStreamingCards([]);
        try {
            const selectedClassName = classes.find((c) => c.id === classId)?.name || null;
            const stream = await api.generateAiExamStream(
                text,
                null,
                `${titleRef.current || 'Note'} Exam`,
                'notes',
                noteId,
                classId,
                selectedClassName,
            );

            const parser = createArrayStreamParser((question) => {
                setStreamingCards((prev) => [...prev, question]);
            });

            for await (const event of stream.chunks()) {
                if (event.type === 'chunk') {
                    parser.feed(event.data.text);
                } else if (event.type === 'error') {
                    const error = new Error(event.data.message);
                    error.status = event.data.status;
                    error.canWatchAd = event.data.canWatchAd;
                    throw error;
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
        if (!noteId) {
            navigate('/notes');
            return;
        }
        try {
            await api.deleteNote(noteId);
            toast.success('Note deleted');
            navigate('/notes');
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
            </div>
        );
    }

    const selectedClass = classes.find((c) => c.id === classId);
    const isRecording = recorder.state === 'recording';
    const enhancementLocked = isEnhancementJobActive(activeEnhancementJob);
    const micDisabled = enhancing || enhancementLocked || !!generating || recorder.state === 'uploading' || recorder.state === 'processing';
    const generationDisabled = enhancementLocked || !!generating;
    const enhancementStatusText = getEnhancementStatusText(activeEnhancementJob);

    const micLabel = isRecording
        ? `Stop recording (${formatDuration(recorder.duration)})`
        : recorder.state === 'uploading' ? 'Uploading audio'
        : recorder.state === 'processing' ? enhancementStatusText
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
                <ShareToFriendModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    friends={friends}
                    loading={loadingFriends}
                    sendingTo={sharingTo}
                    onSend={handleSendNoteToFriend}
                    resourceLabel="Note"
                    resourceTitle={title || 'Untitled'}
                />

                <div className="sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 pt-3 pb-2">
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
                            <button onClick={handleShareNote} className="p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action" aria-label="Share note">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

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

                        <button
                            onClick={handleGenerateFlashcards}
                            disabled={generationDisabled}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                            <span>{generating === 'flashcards' && streamingCards.length > 0 ? `${streamingCards.length} cards` : 'Flashcards'}</span>
                        </button>

                        <button
                            onClick={handleGenerateGuide}
                            disabled={generationDisabled}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'guide' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BookOpen className="w-3.5 h-3.5" />}
                            <span>{generating === 'guide' && generatingStatus ? generatingStatus : 'Recall Guide'}</span>
                        </button>

                        <button
                            onClick={handleGenerateExam}
                            disabled={generationDisabled}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                            <span>{generating === 'exam' && streamingCards.length > 0 ? `${streamingCards.length} questions` : 'Mock Exam'}</span>
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 pt-6">
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

                    <AnimatePresence>
                        {showEnhanceBanner && !enhancementLocked && (
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
                                            : 'Lecture captured - enhance your notes with AI'}
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

                    <AnimatePresence>
                        {enhancementLocked && activeEnhancementJob && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="mb-4 p-3 rounded-xl glass-panel border border-claude-accent/20 flex items-center justify-between gap-3"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <Loader2 className="w-4 h-4 text-claude-accent animate-spin shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-mono text-claude-text truncate">{enhancementStatusText}</p>
                                        <p className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary">
                                            {activeEnhancementJob.progress_percent != null ? `${activeEnhancementJob.progress_percent}% complete` : 'Preparing preview'}
                                        </p>
                                    </div>
                                </div>
                                <div className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-widest text-claude-secondary shrink-0">
                                    <Lock className="w-3 h-3" />
                                    Editor locked
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
                                        {enhanceError}
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

                    <AnimatePresence>
                        {enhancementPreviewDoc && enhancementLocked && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                className="mb-5 rounded-2xl border border-claude-accent/20 bg-claude-surface/60 overflow-hidden"
                            >
                                <div className="px-4 py-3 border-b border-claude-border/20 flex items-center justify-between gap-3">
                                    <div>
                                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent">AI Enhancement Preview</p>
                                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-claude-secondary mt-1">
                                            Sections appear as they are completed
                                        </p>
                                    </div>
                                    <span className="font-mono text-[9px] uppercase tracking-widest text-claude-secondary shrink-0">
                                        {enhancementStatusText}
                                    </span>
                                </div>
                                <div className="px-4 py-4">
                                    <TiptapEditor
                                        content={enhancementPreviewDoc}
                                        editable={false}
                                        placeholder=""
                                    />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <div className="mb-4 relative">
                        <button
                            onClick={() => setShowClassPicker(!showClassPicker)}
                            disabled={enhancementLocked}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent transition-colors tap-action disabled:opacity-50"
                            style={selectedClass ? { borderColor: selectedClass.color + '40', color: selectedClass.color, backgroundColor: selectedClass.color + '10' } : {}}
                        >
                            {selectedClass ? selectedClass.name : 'No class'}
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        <AnimatePresence>
                            {showClassPicker && !enhancementLocked && (
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
                                        {classes.map((cls) => (
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

                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled"
                        readOnly={enhancementLocked}
                        className="w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none mb-2 tracking-tight leading-tight disabled:opacity-60"
                    />

                    <TiptapEditor
                        content={content}
                        onUpdate={handleContentUpdate}
                        editable={!enhancementLocked}
                        placeholder={enhancementLocked ? 'AI enhancement in progress...' : 'Start writing, or type / for commands...'}
                    />
                </div>
            </div>

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
                        {streamingCards.slice(-3).map((card, index) => (
                            <motion.div
                                key={index}
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
