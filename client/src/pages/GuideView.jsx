import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ChevronLeft, Check, Loader2, Layers, ClipboardCheck, Trash2, Share2,
    Eye, ArrowLeft, ArrowRight, RotateCcw, Sparkles, Target
} from 'lucide-react';
import { api } from '../api';
import { useToast } from '../hooks/useToast';
import TiptapEditor from '../components/editor/TiptapEditor';
import ConfirmModal from '../components/ConfirmModal';
import PricingModal from '../components/ui/PricingModal';
import ShareToFriendModal from '../components/ShareToFriendModal';
import {
    buildShareMessageContent,
    buildSharedPreviewText,
    cloneRichTextDoc,
    extractTextFromDoc,
    serializeSharedPayload,
} from '../utils/sharedResources';
import {
    STUDY_GUIDE_CONFIDENCE_OPTIONS,
    getGuideProgress,
    getGuideStudySourceText,
    isActiveRecallGuide,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides';

const EMPTY_STUDY_STATE = {
    current_section_id: null,
    section_states: {},
    last_reviewed_at: null,
};

const getSectionIndex = (sections, sectionId) => {
    const matchIndex = sections.findIndex((section) => section.id === sectionId);
    return matchIndex >= 0 ? matchIndex : 0;
};

const formatLastReviewed = (value) => {
    if (!value) return 'Not started';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not started';
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

function ConfidenceButton({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`rounded-2xl border px-3 py-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all ${
                active
                    ? 'border-claude-accent bg-claude-accent/10 text-claude-accent'
                    : 'border-claude-border bg-claude-surface text-claude-secondary hover:border-claude-accent/30 hover:text-claude-accent'
            }`}
        >
            {label}
        </button>
    );
}

export default function GuideView() {
    const { id } = useParams();
    const navigate = useNavigate();
    const toast = useToast();

    const [title, setTitle] = useState('');
    const [content, setContent] = useState(null);
    const [guideData, setGuideData] = useState(null);
    const [studyState, setStudyState] = useState(EMPTY_STUDY_STATE);
    const [formatVersion, setFormatVersion] = useState(1);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(true);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [showPricingModal, setShowPricingModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [friends, setFriends] = useState([]);
    const [loadingFriends, setLoadingFriends] = useState(false);
    const [sharingTo, setSharingTo] = useState(null);
    const [generating, setGenerating] = useState(null);

    const toastRef = useRef(toast);
    const saveTimerRef = useRef(null);
    const contentRef = useRef(null);
    const titleRef = useRef('');
    const guideDataRef = useRef(null);
    const studyStateRef = useRef(EMPTY_STUDY_STATE);
    const formatVersionRef = useRef(1);
    const guideRef = useRef(null);
    const activeSaveRef = useRef(Promise.resolve(null));

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    useEffect(() => {
        const load = async () => {
            try {
                const guide = await api.getStudyGuide(id);
                const normalizedData = normalizeGuideData(guide.guide_data);
                const normalizedState = normalizedData
                    ? normalizeGuideStudyState(normalizedData, guide.study_state)
                    : EMPTY_STUDY_STATE;
                const resolvedFormatVersion = Number(guide.format_version) || 1;

                setTitle(guide.title || '');
                setContent(guide.content || {});
                setGuideData(normalizedData);
                setStudyState(normalizedState);
                setFormatVersion(resolvedFormatVersion);

                titleRef.current = guide.title || '';
                contentRef.current = guide.content || {};
                guideDataRef.current = normalizedData;
                studyStateRef.current = normalizedState;
                formatVersionRef.current = resolvedFormatVersion;
                guideRef.current = guide;
            } catch {
                toastRef.current.error('Failed to load guide');
                navigate('/guides');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id, navigate]);

    const activeRecallGuide = useMemo(
        () => isActiveRecallGuide({ format_version: formatVersion, guide_data: guideData }),
        [formatVersion, guideData],
    );
    const normalizedGuideData = useMemo(() => normalizeGuideData(guideData), [guideData]);
    const normalizedStudyState = useMemo(
        () => normalizeGuideStudyState(normalizedGuideData, studyState),
        [normalizedGuideData, studyState],
    );
    const progress = useMemo(
        () => getGuideProgress(normalizedGuideData, normalizedStudyState),
        [normalizedGuideData, normalizedStudyState],
    );
    const sections = normalizedGuideData?.sections || [];
    const activeSectionIndex = getSectionIndex(sections, normalizedStudyState.current_section_id);
    const activeSection = sections[activeSectionIndex] || null;
    const activeSectionState = activeSection
        ? normalizedStudyState.section_states[activeSection.id] || { revealed: false, confidence: null, completed: false, note: '' }
        : null;

    const extractLegacyText = useCallback(
        (doc) => extractTextFromDoc(doc).replace(/\s+/g, ' ').trim(),
        [],
    );

    const saveGuide = useCallback(async () => {
        setSaving(true);
        try {
            const payload = {
                title: titleRef.current || 'Untitled Guide',
            };

            if (isActiveRecallGuide({ format_version: formatVersionRef.current, guide_data: guideDataRef.current })) {
                payload.study_state = normalizeGuideStudyState(guideDataRef.current, studyStateRef.current);
            } else {
                payload.content = cloneRichTextDoc(contentRef.current);
            }

            const updatedGuide = await api.updateStudyGuide(id, payload);
            guideRef.current = updatedGuide;

            const normalizedData = normalizeGuideData(updatedGuide.guide_data ?? guideDataRef.current);
            const normalizedState = normalizedData
                ? normalizeGuideStudyState(normalizedData, updatedGuide.study_state ?? studyStateRef.current)
                : studyStateRef.current;

            setGuideData(normalizedData);
            setStudyState(normalizedState);
            setContent(updatedGuide.content || contentRef.current || {});
            setFormatVersion(Number(updatedGuide.format_version) || formatVersionRef.current);

            guideDataRef.current = normalizedData;
            studyStateRef.current = normalizedState;
            contentRef.current = updatedGuide.content || contentRef.current || {};
            formatVersionRef.current = Number(updatedGuide.format_version) || formatVersionRef.current;

            setSaved(true);
            return updatedGuide;
        } catch {
            toast.error('Failed to save');
            throw new Error('Failed to save');
        } finally {
            setSaving(false);
        }
    }, [id, toast]);

    const commitSave = useCallback(() => {
        saveTimerRef.current = null;
        const pendingSave = saveGuide();
        activeSaveRef.current = pendingSave;
        return pendingSave;
    }, [saveGuide]);

    const scheduleSave = useCallback(({ immediate = false } = {}) => {
        setSaved(false);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

        if (immediate) {
            commitSave().catch(() => {});
            return;
        }

        saveTimerRef.current = setTimeout(() => {
            commitSave().catch(() => {});
        }, 800);
    }, [commitSave]);

    const handleTitleChange = (e) => {
        setTitle(e.target.value);
        titleRef.current = e.target.value;
        scheduleSave();
    };

    const handleLegacyContentUpdate = useCallback((json) => {
        setContent(json);
        contentRef.current = json;
        scheduleSave();
    }, [scheduleSave]);

    const updateStudyState = useCallback((updater, { immediate = false } = {}) => {
        if (!guideDataRef.current) return;

        const currentState = normalizeGuideStudyState(guideDataRef.current, studyStateRef.current);
        const nextCandidate = typeof updater === 'function' ? updater(currentState) : updater;
        const nextState = normalizeGuideStudyState(guideDataRef.current, nextCandidate);

        setStudyState(nextState);
        studyStateRef.current = nextState;
        scheduleSave({ immediate });
    }, [scheduleSave]);

    const flushPendingSave = useCallback(async () => {
        if (saveTimerRef.current) {
            return commitSave();
        }

        if (saving) {
            return activeSaveRef.current;
        }

        if (!saved) {
            return commitSave();
        }

        return guideRef.current;
    }, [commitSave, saved, saving]);

    const handleShareGuide = async () => {
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

    const handleSendGuideToFriend = async (friendId) => {
        if (sharingTo) return;
        setSharingTo(friendId);
        try {
            await flushPendingSave();
            const contentSnapshot = cloneRichTextDoc(contentRef.current);

            await api.sendMessage(
                friendId,
                buildShareMessageContent('guide', titleRef.current || 'Untitled Guide'),
                'guide',
                serializeSharedPayload({
                    kind: 'guide',
                    sourceId: id,
                    title: titleRef.current || 'Untitled Guide',
                    previewText: buildSharedPreviewText(contentSnapshot),
                })
            );

            toast.success('Guide shared successfully!');
            setShowShareModal(false);
        } catch (err) {
            toast.error(err?.message || 'Failed to share guide');
        } finally {
            setSharingTo(null);
        }
    };

    const handleGenerateFlashcards = async () => {
        const guidePayload = {
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        };
        const text = getGuideStudySourceText(guidePayload);
        if (!text.trim()) {
            toast.error('Guide is empty');
            return;
        }

        setGenerating('flashcards');
        try {
            const stream = await api.generateAiDeckStream(
                text,
                null,
                `${titleRef.current || 'Guide'} - AI`,
                guideRef.current?.class_id,
                null,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
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
        }
    };

    const handleGenerateExam = async () => {
        const guidePayload = {
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        };
        const text = getGuideStudySourceText(guidePayload);
        if (!text.trim()) {
            toast.error('Guide is empty');
            return;
        }

        setGenerating('exam');
        try {
            const stream = await api.generateAiExamStream(
                text,
                null,
                `${titleRef.current || 'Guide'} Exam`,
                'guide',
                id,
                guideRef.current?.class_id,
                null,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
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
        }
    };

    const handleRegenerateWorkbook = async () => {
        const text = extractLegacyText(contentRef.current);
        if (!text.trim()) {
            toast.error('Guide is empty');
            return;
        }

        setGenerating('guide');
        try {
            const stream = await api.generateAiGuideStream(
                text,
                null,
                `${titleRef.current || 'Guide'} Recall Workbook`,
                guideRef.current?.note_id || null,
                guideRef.current?.class_id || null,
                null,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
                    toast.success('Recall workbook generated!');
                    navigate(`/guide/${event.data.guide_id}`);
                    return;
                }
            }
        } catch (err) {
            if (err.status === 429) setShowPricingModal(true);
            else toast.error(err.message || 'Failed to generate workbook');
        } finally {
            setGenerating(null);
        }
    };

    const handleDelete = async () => {
        try {
            await api.deleteStudyGuide(id);
            toast.success('Guide deleted');
            navigate('/guides');
        } catch (err) {
            toast.error(err?.message || 'Failed to delete');
        }
    };

    const handleRevealAnswer = () => {
        if (!activeSection) return;
        updateStudyState((current) => ({
            ...current,
            last_reviewed_at: new Date().toISOString(),
            section_states: {
                ...current.section_states,
                [activeSection.id]: {
                    ...current.section_states[activeSection.id],
                    revealed: true,
                },
            },
        }), { immediate: true });
    };

    const handleConfidenceChange = (value) => {
        if (!activeSection) return;
        updateStudyState((current) => ({
            ...current,
            last_reviewed_at: new Date().toISOString(),
            section_states: {
                ...current.section_states,
                [activeSection.id]: {
                    ...current.section_states[activeSection.id],
                    revealed: true,
                    confidence: value,
                    completed: true,
                },
            },
        }), { immediate: true });
    };

    const handleSectionNoteChange = (e) => {
        if (!activeSection) return;
        const nextNote = e.target.value;
        updateStudyState((current) => ({
            ...current,
            section_states: {
                ...current.section_states,
                [activeSection.id]: {
                    ...current.section_states[activeSection.id],
                    note: nextNote,
                },
            },
        }));
    };

    const handleSelectSection = (sectionId) => {
        updateStudyState((current) => ({
            ...current,
            current_section_id: sectionId,
            last_reviewed_at: new Date().toISOString(),
        }), { immediate: true });
    };

    const handleStepNavigation = (direction) => {
        if (!activeSection) return;
        const nextIndex = activeSectionIndex + direction;
        if (nextIndex < 0 || nextIndex >= sections.length) return;
        handleSelectSection(sections[nextIndex].id);
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
        </div>
    );

    if (!activeRecallGuide) {
        return (
            <div className="relative min-h-screen pb-8">
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
                <ConfirmModal
                    isOpen={deleteConfirm}
                    title="Delete this guide?"
                    message="This study guide will be permanently deleted."
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(false)}
                />
                <ShareToFriendModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    friends={friends}
                    loading={loadingFriends}
                    sendingTo={sharingTo}
                    onSend={handleSendGuideToFriend}
                    resourceLabel="Guide"
                    resourceTitle={title || 'Untitled Guide'}
                />

                <div className="sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 pt-3 pb-2">
                    <div className="flex items-center justify-between max-w-3xl mx-auto mb-2">
                        <button onClick={() => navigate('/guides')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Guides</span>
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
                            <button onClick={handleShareGuide} className="p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action" aria-label="Share guide">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={handleRegenerateWorkbook}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'guide' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            <span>{generating === 'guide' ? 'Building workbook' : 'Regenerate workbook'}</span>
                        </button>

                        <button
                            onClick={handleGenerateFlashcards}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                            <span>Flashcards</span>
                        </button>

                        <button
                            onClick={handleGenerateExam}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                            <span>Mock Exam</span>
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 pt-6">
                    <div className="mb-4 rounded-2xl border border-claude-accent/20 bg-claude-accent/5 p-4 text-sm text-claude-secondary">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent mb-2">Legacy Guide</p>
                        <p>This guide still uses the classic document editor. Regenerate it as a recall workbook to get section checkpoints, confidence tracking, and resume progress.</p>
                    </div>

                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        placeholder="Untitled Guide"
                        className="w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none mb-2 tracking-tight leading-tight"
                    />

                    <TiptapEditor
                        content={content}
                        onUpdate={handleLegacyContentUpdate}
                        editable={true}
                        placeholder="Your study guide content..."
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="relative min-h-screen pb-8">
            <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
            <ConfirmModal
                isOpen={deleteConfirm}
                title="Delete this guide?"
                message="This study guide will be permanently deleted."
                onConfirm={handleDelete}
                onCancel={() => setDeleteConfirm(false)}
            />
            <ShareToFriendModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                friends={friends}
                loading={loadingFriends}
                sendingTo={sharingTo}
                onSend={handleSendGuideToFriend}
                resourceLabel="Guide"
                resourceTitle={title || 'Untitled Guide'}
            />

            <div className="sticky top-0 z-30 bg-claude-bg/85 backdrop-blur-md border-b border-claude-border/10 px-4 pt-3 pb-3">
                <div className="flex items-start justify-between max-w-4xl mx-auto gap-4">
                    <div className="min-w-0">
                        <button onClick={() => navigate('/guides')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Guides</span>
                        </button>
                        <div className="mt-2">
                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Active Recall Workbook</p>
                            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-claude-secondary">
                                <span className="inline-flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 text-claude-accent" />
                                    {progress.completedCount}/{progress.totalSections} complete
                                </span>
                                <span>{progress.completionPercent}% finished</span>
                                <span>Last reviewed: {formatLastReviewed(normalizedStudyState.last_reviewed_at)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center gap-1.5">
                            {saving ? (
                                <Loader2 className="w-3.5 h-3.5 text-claude-secondary animate-spin" />
                            ) : saved ? (
                                <Check className="w-3.5 h-3.5 text-claude-accent" />
                            ) : null}
                            <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary hidden sm:inline">
                                {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                            </span>
                        </div>
                        <button onClick={handleShareGuide} className="p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action" aria-label="Share guide">
                            <Share2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto mt-4">
                    <div className="h-2 rounded-full bg-claude-border/25 overflow-hidden">
                        <div
                            className="h-full rounded-full bg-claude-accent transition-all duration-300"
                            style={{ width: `${progress.completionPercent}%` }}
                        />
                    </div>

                    <div className="mt-4 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={handleGenerateFlashcards}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                            <span>Flashcards</span>
                        </button>

                        <button
                            onClick={handleGenerateExam}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-3 min-h-[36px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                            <span>Mock Exam</span>
                        </button>
                    </div>

                    <div className="mt-4 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                        {sections.map((section, index) => {
                            const sectionState = normalizedStudyState.section_states[section.id] || {};
                            const isCurrent = normalizedStudyState.current_section_id === section.id;
                            const isComplete = sectionState.completed;
                            return (
                                <button
                                    key={section.id}
                                    type="button"
                                    onClick={() => handleSelectSection(section.id)}
                                    className={`shrink-0 rounded-full border px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] transition-all ${
                                        isCurrent
                                            ? 'border-claude-accent bg-claude-accent/10 text-claude-accent'
                                            : isComplete
                                                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                                                : 'border-claude-border bg-claude-surface text-claude-secondary hover:border-claude-accent/20 hover:text-claude-accent'
                                    }`}
                                >
                                    {index + 1}. {section.title}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 pt-6">
                <input
                    type="text"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder="Untitled Guide"
                    className="w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none mb-5 tracking-tight leading-tight"
                />

                <div className="rounded-[28px] border border-claude-border bg-claude-surface/80 p-5 sm:p-6">
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Overview</p>
                    <p className="mt-3 text-sm sm:text-base text-claude-text leading-relaxed">{normalizedGuideData?.overview}</p>
                </div>

                {activeSection && activeSectionState && (
                    <div className="mt-6 rounded-[30px] border border-claude-border bg-claude-surface/85 p-5 sm:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.08)]">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Section {activeSectionIndex + 1} of {sections.length}</p>
                                <h2 className="mt-2 text-2xl sm:text-3xl font-serif italic font-bold text-claude-text">{activeSection.title}</h2>
                            </div>
                            <div className="rounded-full border border-claude-border bg-claude-bg/60 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                {activeSectionState.completed ? 'Completed' : activeSectionState.revealed ? 'Revealed' : 'Recall first'}
                            </div>
                        </div>

                        <div className="mt-6 rounded-3xl border border-claude-accent/20 bg-claude-accent/5 p-4 sm:p-5">
                            <div className="flex items-center gap-2 text-claude-accent">
                                <Sparkles className="w-4 h-4" />
                                <p className="text-[10px] font-mono uppercase tracking-[0.18em]">Recall First</p>
                            </div>
                            <p className="mt-3 text-base sm:text-lg leading-relaxed text-claude-text">{activeSection.recall_prompt}</p>
                        </div>

                        {!activeSectionState.revealed ? (
                            <button
                                type="button"
                                onClick={handleRevealAnswer}
                                className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15"
                            >
                                <Eye className="w-4 h-4" />
                                Reveal Answer
                            </button>
                        ) : (
                            <div className="mt-6 space-y-5">
                                {activeSection.answer_points.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Answer Points</p>
                                        <ul className="mt-3 space-y-2">
                                            {activeSection.answer_points.map((point) => (
                                                <li key={point} className="flex gap-3 text-sm sm:text-base text-claude-text">
                                                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-claude-accent shrink-0" />
                                                    <span>{point}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {activeSection.key_terms.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Key Terms</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                            {activeSection.key_terms.map((term) => (
                                                <span key={term} className="rounded-full border border-claude-border bg-claude-bg/60 px-3 py-2 text-xs text-claude-text">
                                                    {term}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeSection.mini_quiz.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Mini Quiz</p>
                                        <div className="mt-3 space-y-3">
                                            {activeSection.mini_quiz.map((item) => (
                                                <div key={`${activeSection.id}-${item.prompt}`} className="rounded-2xl border border-claude-border bg-claude-bg/60 p-4">
                                                    <p className="text-sm text-claude-text font-medium">{item.prompt}</p>
                                                    {item.answer && <p className="mt-2 text-sm text-claude-secondary">{item.answer}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {activeSection.common_traps.length > 0 && (
                                    <div>
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Common Traps</p>
                                        <ul className="mt-3 space-y-2">
                                            {activeSection.common_traps.map((trap) => (
                                                <li key={trap} className="text-sm text-claude-secondary">{trap}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mt-6">
                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">How did that feel?</p>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                {STUDY_GUIDE_CONFIDENCE_OPTIONS.map((option) => (
                                    <ConfidenceButton
                                        key={option.value}
                                        active={activeSectionState.confidence === option.value}
                                        label={option.label}
                                        onClick={() => handleConfidenceChange(option.value)}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="mt-6">
                            <label htmlFor="section-note" className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Personal Note</label>
                            <textarea
                                id="section-note"
                                value={activeSectionState.note}
                                onChange={handleSectionNoteChange}
                                rows={4}
                                placeholder="Add a quick memory hook, mistake to avoid, or what to revisit later..."
                                className="mt-3 w-full rounded-3xl border border-claude-border bg-claude-bg/70 p-4 text-sm text-claude-text placeholder:text-claude-secondary/50 outline-none focus:border-claude-accent/30 resize-none"
                            />
                        </div>

                        <div className="mt-6 flex items-center justify-between gap-3">
                            <button
                                type="button"
                                onClick={() => handleStepNavigation(-1)}
                                disabled={activeSectionIndex === 0}
                                className="inline-flex items-center gap-2 rounded-2xl border border-claude-border px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-claude-accent disabled:opacity-40"
                            >
                                <ArrowLeft className="w-4 h-4" />
                                Previous
                            </button>

                            <button
                                type="button"
                                onClick={() => handleStepNavigation(1)}
                                disabled={activeSectionIndex === sections.length - 1}
                                className="inline-flex items-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 disabled:opacity-40"
                            >
                                {activeSectionIndex === sections.length - 1 ? 'Last section' : 'Next section'}
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
