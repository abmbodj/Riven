import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
    AlertTriangle, ArrowLeft, ArrowRight, Check, ChevronLeft, ClipboardCheck,
    ChevronDown, Eye, Layers, Loader2, Menu, Play, RotateCcw, Share2, Sparkles, Trash2, X
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
    serializeSharedPayload,
} from '../utils/sharedResources';
import {
    STUDY_GUIDE_CONFIDENCE_OPTIONS,
    STUDY_GUIDE_FORMAT_VERSION,
    getGuideProgress,
    getGuideStudySourceText,
    normalizeGuideData,
    normalizeGuideStudyState,
} from '../utils/studyGuides';

const EMPTY_STUDY_STATE = {
    current_section_id: null,
    section_states: {},
    last_reviewed_at: null,
};

const DEFAULT_SECTION_STATE = {
    revealed: false,
    confidence: null,
    completed: false,
    note: '',
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

const MOBILE_MEDIA_QUERY = '(max-width: 767px)';

const getMatches = (query) => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
};

function MobileBottomSheet({ open, title, subtitle, onClose, children, testId }) {
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
                        data-testid={testId}
                        initial={{ y: '100%' }}
                        animate={{ y: 0 }}
                        exit={{ y: '100%' }}
                        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
                        className="fixed inset-x-0 bottom-0 z-50 rounded-t-[2rem] border-t border-claude-border bg-claude-bg/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)] pt-4 shadow-2xl"
                    >
                        <div className="mx-auto mb-4 h-1.5 w-14 rounded-full bg-claude-border" />
                        <div className="mb-4 flex items-start justify-between gap-4">
                            <div>
                                <p className="font-serif text-xl font-bold italic text-claude-text">{title}</p>
                                {subtitle ? (
                                    <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">
                                        {subtitle}
                                    </p>
                                ) : null}
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="touch-target rounded-full p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action"
                                aria-label={`Close ${title}`}
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="max-h-[68dvh] overflow-auto pb-safe">
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

function DisclosureCard({ label, summary, open, onToggle, children, testId }) {
    return (
        <div data-testid={testId} className="rounded-[24px] border border-claude-border bg-claude-surface/80">
            <button
                type="button"
                onClick={onToggle}
                className="flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-4 text-left"
            >
                <div>
                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">{label}</p>
                    {summary ? <p className="mt-1 text-sm text-claude-secondary">{summary}</p> : null}
                </div>
                <ChevronDown className={`h-4 w-4 shrink-0 text-claude-secondary transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open ? <div className="border-t border-claude-border px-4 py-4">{children}</div> : null}
        </div>
    );
}

function ConfidenceButton({ active, label, onClick }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex min-h-[44px] w-full items-center justify-center rounded-2xl border px-3 py-3 text-[10px] font-mono uppercase tracking-[0.16em] transition-all ${
                active
                    ? 'border-claude-accent bg-claude-accent/10 text-claude-accent'
                    : 'border-claude-border bg-claude-surface text-claude-secondary hover:border-claude-accent/30 hover:text-claude-accent'
            }`}
        >
            {label}
        </button>
    );
}

function SessionMetric({ label, value, accent = false }) {
    return (
        <div className={`min-h-[84px] rounded-2xl border px-4 py-4 ${accent ? 'border-claude-accent/20 bg-claude-accent/5' : 'border-claude-border bg-claude-surface/70'}`}>
            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">{label}</p>
            <p className={`mt-2 text-sm sm:text-base ${accent ? 'text-claude-accent' : 'text-claude-text'}`}>{value}</p>
        </div>
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
    const [transitioningWorkbook, setTransitioningWorkbook] = useState(false);
    const [isMobileLayout, setIsMobileLayout] = useState(() => getMatches(MOBILE_MEDIA_QUERY));
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    const [showMobileSections, setShowMobileSections] = useState(false);
    const [showMobileGuideInfo, setShowMobileGuideInfo] = useState(false);
    const [showMobileMoreDetails, setShowMobileMoreDetails] = useState(false);
    const [showMobileNoteEditor, setShowMobileNoteEditor] = useState(false);

    const toastRef = useRef(toast);
    const saveTimerRef = useRef(null);
    const contentRef = useRef(null);
    const titleRef = useRef('');
    const guideDataRef = useRef(null);
    const studyStateRef = useRef(EMPTY_STUDY_STATE);
    const formatVersionRef = useRef(1);
    const guideRef = useRef(null);
    const activeSaveRef = useRef(Promise.resolve(null));
    const sessionCardRef = useRef(null);

    useEffect(() => {
        toastRef.current = toast;
    }, [toast]);

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;

        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
        const handleChange = (event) => {
            setIsMobileLayout(event.matches);
        };

        setIsMobileLayout(mediaQuery.matches);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }

        mediaQuery.addListener(handleChange);
        return () => mediaQuery.removeListener(handleChange);
    }, []);

    const resetGuideState = useCallback(() => {
        if (saveTimerRef.current) {
            clearTimeout(saveTimerRef.current);
            saveTimerRef.current = null;
        }

        setTitle('');
        setContent(null);
        setGuideData(null);
        setStudyState(EMPTY_STUDY_STATE);
        setFormatVersion(1);
        setSaved(true);
        setSaving(false);

        titleRef.current = '';
        contentRef.current = null;
        guideDataRef.current = null;
        studyStateRef.current = EMPTY_STUDY_STATE;
        formatVersionRef.current = 1;
        guideRef.current = null;
        activeSaveRef.current = Promise.resolve(null);
    }, []);

    const loadGuide = useCallback(async (guideId, { navigateOnError = true } = {}) => {
        setLoading(true);
        resetGuideState();

        try {
            const guide = await api.getStudyGuide(guideId);
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

            return guide;
        } catch (error) {
            if (navigateOnError) {
                toastRef.current.error('Failed to load guide');
                navigate('/guides');
            }
            throw error;
        } finally {
            setLoading(false);
            setTransitioningWorkbook(false);
        }
    }, [navigate, resetGuideState]);

    useEffect(() => {
        loadGuide(id).catch(() => {});
    }, [id, loadGuide]);

    const normalizedGuideData = useMemo(() => normalizeGuideData(guideData), [guideData]);
    const normalizedStudyState = useMemo(
        () => normalizeGuideStudyState(normalizedGuideData, studyState),
        [normalizedGuideData, studyState],
    );
    const workbookGuide = Number(formatVersion) >= STUDY_GUIDE_FORMAT_VERSION;
    const workbookSchemaIssue = workbookGuide && !normalizedGuideData;
    const legacyGuide = !workbookGuide;
    const progress = useMemo(
        () => getGuideProgress(normalizedGuideData, normalizedStudyState),
        [normalizedGuideData, normalizedStudyState],
    );
    const sections = normalizedGuideData?.sections || [];
    const activeSectionIndex = getSectionIndex(sections, normalizedStudyState.current_section_id);
    const activeSection = sections[activeSectionIndex] || null;
    const activeSectionState = activeSection
        ? normalizedStudyState.section_states[activeSection.id] || DEFAULT_SECTION_STATE
        : null;
    const nextSection = sections.find((section) => section.id === progress.nextSectionId) || activeSection || sections[0] || null;
    const sessionStarted = Boolean(normalizedStudyState.last_reviewed_at) || progress.revealedCount > 0 || progress.completedCount > 0;
    const sessionLabel = sessionStarted ? 'Resume Session' : 'Start Session';
    const sessionMessage = sessionStarted
        ? `Pick up with ${nextSection?.title || 'your next checkpoint'} and keep the review moving.`
        : `Start with ${nextSection?.title || 'Section 1'} and work through one checkpoint at a time.`;
    const workbookActionLabel = legacyGuide ? 'Convert to workbook' : 'Rebuild workbook';
    const activeSectionStatusLabel = activeSectionState?.completed
        ? 'Completed'
        : activeSectionState?.revealed
            ? 'Revealed'
            : 'Recall first';
    const hasMobileMoreDetails = Boolean(
        activeSection?.key_terms?.length
        || activeSection?.mini_quiz?.length
        || activeSection?.common_traps?.length
    );
    const noteDisclosureSummary = activeSectionState?.note?.trim()
        ? 'Your note is saved here.'
        : 'Add a quick memory hook or reminder.';
    const guideInfoSummary = `${progress.completedCount}/${progress.totalSections} checkpoints complete`;
    const canGoPrevious = activeSectionIndex > 0;
    const canGoNext = activeSectionIndex < sections.length - 1;
    const mobileProgressLabel = `${progress.completedCount}/${progress.totalSections} complete`;

    const focusSession = useCallback(() => {
        sessionCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, []);

    useEffect(() => {
        if (!isMobileLayout) {
            setShowMobileMenu(false);
            setShowMobileSections(false);
            setShowMobileGuideInfo(false);
            setShowMobileMoreDetails(false);
            setShowMobileNoteEditor(false);
        }
    }, [isMobileLayout]);

    useEffect(() => {
        setShowMobileSections(false);
        setShowMobileMoreDetails(false);
        setShowMobileNoteEditor(false);
    }, [activeSection?.id]);

    const saveGuide = useCallback(async () => {
        setSaving(true);
        try {
            const payload = {
                title: titleRef.current || 'Untitled Guide',
            };
            const currentFormatVersion = Number(formatVersionRef.current) || 1;
            const normalizedCurrentGuideData = normalizeGuideData(guideDataRef.current);

            if (currentFormatVersion >= STUDY_GUIDE_FORMAT_VERSION && normalizedCurrentGuideData) {
                payload.study_state = normalizeGuideStudyState(normalizedCurrentGuideData, studyStateRef.current);
            } else if (currentFormatVersion < STUDY_GUIDE_FORMAT_VERSION) {
                payload.content = cloneRichTextDoc(contentRef.current);
            }

            const updatedGuide = await api.updateStudyGuide(id, payload);
            const normalizedData = normalizeGuideData(updatedGuide.guide_data ?? guideDataRef.current);
            const normalizedState = normalizedData
                ? normalizeGuideStudyState(normalizedData, updatedGuide.study_state ?? studyStateRef.current)
                : EMPTY_STUDY_STATE;
            const resolvedFormatVersion = Number(updatedGuide.format_version) || currentFormatVersion;

            guideRef.current = updatedGuide;
            setGuideData(normalizedData);
            setStudyState(normalizedState);
            setContent(updatedGuide.content || contentRef.current || {});
            setFormatVersion(resolvedFormatVersion);

            guideDataRef.current = normalizedData;
            studyStateRef.current = normalizedState;
            contentRef.current = updatedGuide.content || contentRef.current || {};
            formatVersionRef.current = resolvedFormatVersion;

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
        const text = getGuideStudySourceText({
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        });

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
        const text = getGuideStudySourceText({
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        });

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
        const text = getGuideStudySourceText({
            format_version: formatVersionRef.current,
            guide_data: guideDataRef.current,
            content: contentRef.current,
        });

        if (!text.trim()) {
            toast.error('Guide is empty');
            return;
        }

        setGenerating('guide');
        setTransitioningWorkbook(true);

        try {
            const stream = await api.generateAiGuideStream(
                text,
                null,
                `${titleRef.current || 'Guide'} Recall Workbook`,
                guideRef.current?.note_id || null,
                guideRef.current?.class_id || null,
                null,
                id,
            );

            for await (const event of stream.chunks()) {
                if (event.type === 'error') {
                    const err = new Error(event.data.message);
                    err.status = event.data.status;
                    throw err;
                }
                if (event.type === 'done') {
                    if (event.data.guide_id === id) {
                        await loadGuide(id, { navigateOnError: false });
                    } else {
                        navigate(`/guide/${event.data.guide_id}`);
                    }
                    toast.success('Recall workbook generated!');
                    return;
                }
            }
        } catch (err) {
            setTransitioningWorkbook(false);
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

    if (transitioningWorkbook) {
        return (
            <div className="min-h-dvh safe-area-top safe-area-bottom bg-claude-bg px-4 py-8 sm:py-16">
                <div className="mx-auto flex max-w-2xl flex-col items-center rounded-[32px] border border-claude-accent/20 bg-claude-surface/85 p-8 text-center shadow-[0_18px_60px_rgba(0,0,0,0.10)]">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full border border-claude-accent/20 bg-claude-accent/10 text-claude-accent">
                        <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                    <p className="mt-6 text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Workbook Upgrade</p>
                    <h1 className="mt-3 text-3xl font-serif font-bold italic text-claude-text">Converting guide into a workbook</h1>
                    <p className="mt-4 max-w-xl text-sm leading-relaxed text-claude-secondary">
                        Rebuilding this guide into a checkpoint-by-checkpoint study session with reveal-first answers,
                        confidence tracking, and resume progress.
                    </p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-claude-accent animate-spin" />
            </div>
        );
    }

    if (workbookSchemaIssue) {
        return (
            <div className="relative min-h-screen safe-area-bottom pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
                <PricingModal isOpen={showPricingModal} onClose={() => setShowPricingModal(false)} />
                <ConfirmModal
                    isOpen={deleteConfirm}
                    title="Delete this guide?"
                    message="This study guide will be permanently deleted."
                    onConfirm={handleDelete}
                    onCancel={() => setDeleteConfirm(false)}
                />

                <div className="safe-area-top sticky top-0 z-30 bg-claude-bg/85 backdrop-blur-md border-b border-claude-border/10 px-4 py-3">
                    <div className="flex items-center justify-between max-w-4xl mx-auto gap-4">
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
                                <span className="text-[9px] font-mono uppercase tracking-widest text-claude-secondary hidden sm:inline">
                                    {saving ? 'Saving' : saved ? 'Saved' : 'Unsaved'}
                                </span>
                            </div>
                            <button onClick={() => setDeleteConfirm(true)} className="p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 pt-8">
                    <div className="rounded-[32px] border border-amber-500/20 bg-amber-500/5 p-6 sm:p-8 shadow-[0_14px_40px_rgba(0,0,0,0.08)]">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-300">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <p className="mt-5 text-[10px] font-mono uppercase tracking-[0.2em] text-amber-300">Workbook Needs Rebuilding</p>
                        <input
                            type="text"
                            value={title}
                            onChange={handleTitleChange}
                            placeholder="Untitled Guide"
                            className="mt-3 w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none tracking-tight leading-tight"
                        />
                        <p className="mt-4 text-sm sm:text-base leading-relaxed text-claude-secondary">
                            This guide is marked as a workbook, but its study sections are missing. Rebuild it to restore
                            the guided review session, checkpoints, and confidence tracking.
                        </p>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                            <button
                                type="button"
                                onClick={handleRegenerateWorkbook}
                                disabled={!!generating}
                                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 disabled:opacity-50 sm:w-auto"
                            >
                                {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                                {generating === 'guide' ? 'Rebuilding workbook' : 'Rebuild workbook'}
                            </button>
                            <button
                                type="button"
                                onClick={() => navigate('/guides')}
                                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-border px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-claude-accent sm:w-auto"
                            >
                                Back to guides
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (legacyGuide) {
        return (
            <div className="relative min-h-screen safe-area-bottom pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
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

                <div className="safe-area-top sticky top-0 z-30 bg-claude-bg/80 backdrop-blur-md border-b border-claude-border/10 px-4 pt-3 pb-2">
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
                            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'guide' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            <span>{generating === 'guide' ? 'Building workbook' : workbookActionLabel}</span>
                        </button>

                        <button
                            onClick={handleGenerateFlashcards}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                            <span>Flashcards</span>
                        </button>

                        <button
                            onClick={handleGenerateExam}
                            disabled={!!generating}
                            className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                        >
                            {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                            <span>Mock Exam</span>
                        </button>
                    </div>
                </div>

                <div className="max-w-3xl mx-auto px-4 pt-6">
                    <div className="mb-4 rounded-2xl border border-claude-accent/20 bg-claude-accent/5 p-4 text-sm text-claude-secondary">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-claude-accent mb-2">Classic Guide</p>
                        <p>
                            This guide is still a document. Convert it into an active-recall workbook to get one-section-at-a-time
                            review, checkpoint reveals, confidence tracking, and resume progress.
                        </p>
                        <button
                            type="button"
                            onClick={handleRegenerateWorkbook}
                            disabled={!!generating}
                            className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 disabled:opacity-50 sm:w-auto"
                        >
                            {generating === 'guide' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                            {generating === 'guide' ? 'Building workbook' : 'Convert guide to workbook'}
                        </button>
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
        <div
            data-testid="guide-screen"
            className={`relative min-h-screen safe-area-bottom ${isMobileLayout ? 'pb-[calc(env(safe-area-inset-bottom,0px)+7.5rem)]' : 'pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]'}`}
        >
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

            {isMobileLayout ? (
                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/92 px-4 py-3 backdrop-blur-md">
                    <div className="mx-auto flex max-w-5xl items-center gap-3">
                        <button
                            type="button"
                            onClick={() => navigate('/guides')}
                            className="touch-target rounded-full p-2 text-claude-secondary transition-colors hover:text-claude-accent tap-action"
                            aria-label="Back to guides"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </button>

                        <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Workbook</p>
                            <p className="truncate text-sm font-medium text-claude-text">{activeSection?.title || title || 'Recall workbook'}</p>
                            <p className="mt-1 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                {mobileProgressLabel}
                                {activeSection ? ` • Section ${activeSectionIndex + 1}/${sections.length}` : ''}
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={() => setShowMobileMenu(true)}
                            className="touch-target rounded-full border border-claude-border bg-claude-surface/80 p-2 text-claude-secondary transition-colors hover:text-claude-accent tap-action"
                            aria-label="More workbook actions"
                        >
                            <Menu className="h-4 w-4" />
                        </button>
                    </div>
                </div>
            ) : (
                <div className="safe-area-top sticky top-0 z-30 border-b border-claude-border/10 bg-claude-bg/85 px-4 py-3 backdrop-blur-md">
                    <div className="flex items-center justify-between max-w-5xl mx-auto gap-4">
                        <button onClick={() => navigate('/guides')} className="flex items-center gap-1 text-claude-secondary hover:text-claude-accent transition-colors tap-action">
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-[10px] font-mono font-bold uppercase tracking-widest hidden sm:inline">Guides</span>
                        </button>

                        <div className="flex items-center gap-2 sm:gap-3">
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
                            <button onClick={handleShareGuide} className="touch-target rounded-full p-2 text-claude-secondary hover:text-claude-accent transition-colors tap-action" aria-label="Share guide">
                                <Share2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteConfirm(true)} className="touch-target rounded-full p-2 text-claude-secondary hover:text-red-400 transition-colors tap-action">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className={`max-w-5xl mx-auto px-4 ${isMobileLayout ? 'pt-4' : 'pt-6'}`}>
                {isMobileLayout ? (
                    <div data-testid="mobile-focus-shell" className="space-y-4">
                        <div className="rounded-[30px] border border-claude-accent/20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_55%),linear-gradient(135deg,rgba(239,68,68,0.12),rgba(15,23,42,0.04))] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.10)]">
                            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Active Recall Workbook</p>
                            <input
                                type="text"
                                value={title}
                                onChange={handleTitleChange}
                                placeholder="Untitled Guide"
                                className="mt-3 w-full bg-transparent text-2xl font-serif font-bold italic tracking-tight text-claude-text placeholder:text-claude-secondary/30 outline-none"
                            />
                            <p className="mt-3 text-sm leading-relaxed text-claude-secondary">
                                {sessionStarted ? 'Continue one checkpoint at a time.' : 'Start with one checkpoint and build recall step by step.'}
                            </p>

                            <button
                                type="button"
                                onClick={focusSession}
                                className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15"
                            >
                                <Play className="w-4 h-4" />
                                {sessionLabel}
                            </button>

                            <div className="mt-4 h-2 overflow-hidden rounded-full bg-claude-border/25">
                                <div
                                    className="h-full rounded-full bg-claude-accent transition-all duration-300"
                                    style={{ width: `${progress.completionPercent}%` }}
                                />
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-3">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-accent">Progress</p>
                                    <p className="mt-2 text-sm text-claude-text">{mobileProgressLabel}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowMobileSections(true)}
                                    className="rounded-2xl border border-claude-border bg-claude-surface/80 px-4 py-3 text-left transition-colors hover:border-claude-accent/20 tap-action"
                                >
                                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Sections</p>
                                    <p className="mt-2 truncate text-sm text-claude-text">{activeSection?.title || 'Open section picker'}</p>
                                </button>
                            </div>

                            <div className="mt-3 rounded-2xl border border-claude-border bg-claude-surface/75 px-4 py-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Next checkpoint</p>
                                        <p className="mt-2 text-sm text-claude-text">{nextSection?.title || 'Ready to begin'}</p>
                                    </div>
                                    <div className="rounded-full border border-claude-border bg-claude-bg/70 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] text-claude-secondary">
                                        {formatLastReviewed(normalizedStudyState.last_reviewed_at)}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {activeSection && activeSectionState ? (
                            <div
                                ref={sessionCardRef}
                                data-testid="mobile-active-section-card"
                                className="rounded-[30px] border border-claude-border bg-claude-surface/90 p-4 shadow-[0_12px_36px_rgba(0,0,0,0.08)]"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Section {activeSectionIndex + 1} of {sections.length}</p>
                                        <h2 className="mt-2 text-2xl font-serif italic font-bold text-claude-text">{activeSection.title}</h2>
                                    </div>
                                    <div className="shrink-0 rounded-full border border-claude-border bg-claude-bg/60 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                        {activeSectionStatusLabel}
                                    </div>
                                </div>

                                <div className="mt-5 rounded-3xl border border-claude-accent/20 bg-claude-accent/5 p-4">
                                    <div className="flex items-center gap-2 text-claude-accent">
                                        <Sparkles className="w-4 h-4" />
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em]">Recall First</p>
                                    </div>
                                    <p className="mt-3 text-base leading-relaxed text-claude-text">{activeSection.recall_prompt}</p>
                                </div>

                                {!activeSectionState.revealed ? (
                                    <button
                                        type="button"
                                        onClick={handleRevealAnswer}
                                        className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15"
                                    >
                                        <Eye className="w-4 h-4" />
                                        Reveal Answer
                                    </button>
                                ) : (
                                    <div className="mt-5 space-y-5">
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Answer Points</p>
                                            {activeSection.answer_points.length > 0 ? (
                                                <ul className="mt-3 space-y-2">
                                                    {activeSection.answer_points.map((point) => (
                                                        <li key={point} className="flex gap-3 text-sm text-claude-text">
                                                            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-claude-accent" />
                                                            <span>{point}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="mt-3 text-sm text-claude-secondary">No answer points were generated for this checkpoint.</p>
                                            )}
                                        </div>

                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">How did that feel?</p>
                                            <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
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

                                        {hasMobileMoreDetails ? (
                                            <DisclosureCard
                                                label="More details"
                                                summary="Key terms, quiz, and common traps."
                                                open={showMobileMoreDetails}
                                                onToggle={() => setShowMobileMoreDetails((value) => !value)}
                                                testId="mobile-more-details"
                                            >
                                                <div className="space-y-5">
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
                                                                        <p className="text-sm font-medium text-claude-text">{item.prompt}</p>
                                                                        {item.answer ? <p className="mt-2 text-sm text-claude-secondary">{item.answer}</p> : null}
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
                                            </DisclosureCard>
                                        ) : null}

                                        <DisclosureCard
                                            label={activeSectionState.note?.trim() ? 'Edit note' : 'Add note'}
                                            summary={noteDisclosureSummary}
                                            open={showMobileNoteEditor}
                                            onToggle={() => setShowMobileNoteEditor((value) => !value)}
                                            testId="mobile-note-disclosure"
                                        >
                                            <label htmlFor="mobile-section-note" className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Personal Note</label>
                                            <textarea
                                                id="mobile-section-note"
                                                aria-label="Personal note"
                                                value={activeSectionState.note}
                                                onChange={handleSectionNoteChange}
                                                rows={4}
                                                placeholder="Add a quick memory hook, mistake to avoid, or what to revisit later..."
                                                className="mt-3 w-full resize-none rounded-3xl border border-claude-border bg-claude-bg/70 p-4 text-sm text-claude-text placeholder:text-claude-secondary/50 outline-none focus:border-claude-accent/30"
                                            />
                                        </DisclosureCard>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="rounded-[30px] border border-claude-border bg-claude-surface/85 p-5 text-sm text-claude-secondary">
                                No study sections are available for this workbook yet.
                            </div>
                        )}

                        <DisclosureCard
                            label="Guide info"
                            summary={guideInfoSummary}
                            open={showMobileGuideInfo}
                            onToggle={() => setShowMobileGuideInfo((value) => !value)}
                            testId="mobile-guide-info"
                        >
                            <div className="space-y-5">
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Overview</p>
                                    <p className="mt-3 text-sm leading-relaxed text-claude-text">{normalizedGuideData?.overview}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Session Flow</p>
                                    <div className="mt-3 space-y-3 text-sm leading-relaxed text-claude-secondary">
                                        <p><span className="text-claude-text">1.</span> Recall the answer before revealing anything.</p>
                                        <p><span className="text-claude-text">2.</span> Compare your recall to the workbook answer points.</p>
                                        <p><span className="text-claude-text">3.</span> Rate confidence, jot a note, and continue to the next checkpoint.</p>
                                    </div>
                                </div>
                            </div>
                        </DisclosureCard>
                    </div>
                ) : (
                    <>
                        <div data-testid="workbook-shell-grid" className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr,0.95fr]">
                            <div className="rounded-[32px] border border-claude-accent/20 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.16),transparent_55%),linear-gradient(135deg,rgba(239,68,68,0.12),rgba(15,23,42,0.04))] p-5 sm:p-7 shadow-[0_18px_60px_rgba(0,0,0,0.10)]">
                                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-claude-accent">Active Recall Workbook</p>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={handleTitleChange}
                                    placeholder="Untitled Guide"
                                    className="mt-3 w-full bg-transparent text-3xl sm:text-4xl font-serif font-bold italic text-claude-text placeholder:text-claude-secondary/30 outline-none tracking-tight leading-tight"
                                />
                                <p className="mt-5 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Study Session</p>
                                <p className="mt-2 text-base sm:text-lg leading-relaxed text-claude-text">{sessionMessage}</p>

                                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                                    <SessionMetric
                                        label="Progress"
                                        value={`${progress.completedCount}/${progress.totalSections}`}
                                        accent
                                    />
                                    <SessionMetric label="Finished" value={`${progress.completionPercent}%`} />
                                    <div className="col-span-2 sm:col-span-1">
                                        <SessionMetric label="Last reviewed" value={formatLastReviewed(normalizedStudyState.last_reviewed_at)} />
                                    </div>
                                </div>

                                <div className="mt-5 h-2 rounded-full bg-claude-border/25 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-claude-accent transition-all duration-300"
                                        style={{ width: `${progress.completionPercent}%` }}
                                    />
                                </div>

                                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                                    <button
                                        type="button"
                                        onClick={focusSession}
                                        className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 sm:w-auto"
                                    >
                                        <Play className="w-4 h-4" />
                                        {sessionLabel}
                                    </button>
                                    <div className="w-full rounded-2xl border border-claude-border bg-claude-surface/70 px-4 py-3 sm:w-auto sm:min-w-[240px]">
                                        <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary">Next checkpoint</p>
                                        <p className="mt-2 text-sm text-claude-text">{nextSection?.title || 'Ready to begin'}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="hidden rounded-[30px] border border-claude-border bg-claude-surface/80 p-5 sm:p-6 xl:block">
                                <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Session Snapshot</p>
                                <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-1">
                                    <SessionMetric
                                        label="Progress"
                                        value={`${progress.completedCount}/${progress.totalSections} checkpoints`}
                                        accent
                                    />
                                    <SessionMetric label="Finished" value={`${progress.completionPercent}% complete`} />
                                    <SessionMetric label="Last reviewed" value={formatLastReviewed(normalizedStudyState.last_reviewed_at)} />
                                    <SessionMetric label="Reveal count" value={`${progress.revealedCount} answered`} />
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 rounded-[28px] border border-claude-border bg-claude-surface/75 p-4 sm:p-5">
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Checkpoint Map</p>
                                    <p className="mt-1 text-sm text-claude-secondary">Use the map to jump between sections without leaving study-session mode.</p>
                                </div>
                                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                                    <button
                                        onClick={handleGenerateFlashcards}
                                        disabled={!!generating}
                                        className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                                    >
                                        {generating === 'flashcards' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                                        <span>Flashcards</span>
                                    </button>
                                    <button
                                        onClick={handleGenerateExam}
                                        disabled={!!generating}
                                        className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider glass-panel border border-claude-border text-claude-secondary hover:text-claude-accent hover:border-claude-accent/30 transition-all tap-action shrink-0 disabled:opacity-50"
                                    >
                                        {generating === 'exam' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ClipboardCheck className="w-3.5 h-3.5" />}
                                        <span>Mock Exam</span>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 h-2 rounded-full bg-claude-border/25 overflow-hidden">
                                <div
                                    className="h-full rounded-full bg-claude-accent transition-all duration-300"
                                    style={{ width: `${progress.completionPercent}%` }}
                                />
                            </div>

                            <div data-testid="checkpoint-chip-row" className="mt-4 flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                                {sections.map((section, index) => {
                                    const sectionState = normalizedStudyState.section_states[section.id] || {};
                                    const isCurrent = normalizedStudyState.current_section_id === section.id;
                                    const isComplete = sectionState.completed;
                                    return (
                                        <button
                                            key={section.id}
                                            type="button"
                                            onClick={() => handleSelectSection(section.id)}
                                            className={`touch-target shrink-0 rounded-full border px-4 py-3 text-[10px] font-mono uppercase tracking-[0.14em] transition-all ${
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

                        <div data-testid="guide-session-layout" className="mt-6 grid grid-cols-1 gap-6 items-start xl:grid-cols-[1.55fr,0.95fr]">
                            {activeSection && activeSectionState && (
                                <div
                                    ref={sessionCardRef}
                                    className="rounded-[30px] border border-claude-border bg-claude-surface/85 p-4 sm:p-6 shadow-[0_12px_36px_rgba(0,0,0,0.08)]"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Section {activeSectionIndex + 1} of {sections.length}</p>
                                            <h2 className="mt-2 text-2xl sm:text-3xl font-serif italic font-bold text-claude-text">{activeSection.title}</h2>
                                        </div>
                                        <div className="rounded-full border border-claude-border bg-claude-bg/60 px-3 py-2 text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">
                                            {activeSectionStatusLabel}
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
                                            className="mt-5 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 sm:w-auto"
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
                                        <div className="mt-3 grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
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

                                    <div className="mt-6 grid grid-cols-2 gap-3">
                                        <button
                                            type="button"
                                            onClick={() => handleStepNavigation(-1)}
                                            disabled={!canGoPrevious}
                                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-border px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-claude-accent disabled:opacity-40"
                                        >
                                            <ArrowLeft className="w-4 h-4" />
                                            Previous
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleStepNavigation(1)}
                                            disabled={!canGoNext}
                                            className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 disabled:opacity-40"
                                        >
                                            {canGoNext ? 'Next section' : 'Last section'}
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                <div className="rounded-[28px] border border-claude-border bg-claude-surface/80 p-5 sm:p-6">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Overview</p>
                                    <p className="mt-3 text-sm sm:text-base text-claude-text leading-relaxed">{normalizedGuideData?.overview}</p>
                                </div>

                                <div className="rounded-[28px] border border-claude-border bg-claude-surface/80 p-5 sm:p-6">
                                    <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent">Session Flow</p>
                                    <div className="mt-4 space-y-3 text-sm text-claude-secondary leading-relaxed">
                                        <p><span className="text-claude-text">1.</span> Recall the answer from memory before revealing anything.</p>
                                        <p><span className="text-claude-text">2.</span> Reveal the checkpoint answer and compare your recall to the target points.</p>
                                        <p><span className="text-claude-text">3.</span> Rate your confidence, leave a quick note, and move to the next section.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {isMobileLayout && activeSection && activeSectionState ? (
                <div
                    data-testid="mobile-bottom-bar"
                    className="fixed inset-x-0 bottom-0 z-20 border-t border-claude-border/20 bg-claude-bg/95 px-4 pt-3 backdrop-blur-md"
                >
                    <div className="mx-auto flex max-w-5xl gap-3 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)]">
                        {!activeSectionState.revealed ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowMobileSections(true)}
                                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-claude-border bg-claude-surface/90 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-claude-accent"
                                >
                                    <Layers className="w-4 h-4" />
                                    Sections
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRevealAnswer}
                                    className="inline-flex min-h-[48px] flex-[1.2] items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15"
                                >
                                    <Eye className="w-4 h-4" />
                                    Reveal Answer
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleStepNavigation(-1)}
                                    disabled={!canGoPrevious}
                                    className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-2xl border border-claude-border bg-claude-surface/90 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-secondary transition-colors hover:text-claude-accent disabled:opacity-40"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    Previous
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleStepNavigation(1)}
                                    disabled={!canGoNext}
                                    className="inline-flex min-h-[48px] flex-[1.2] items-center justify-center gap-2 rounded-2xl border border-claude-accent/30 bg-claude-accent/10 px-4 py-3 text-[10px] font-mono uppercase tracking-[0.18em] text-claude-accent transition-colors hover:bg-claude-accent/15 disabled:opacity-40"
                                >
                                    {canGoNext ? 'Next checkpoint' : 'Last checkpoint'}
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : null}

            {isMobileLayout ? (
                <>
                    <MobileBottomSheet
                        open={showMobileMenu}
                        title="Workbook actions"
                        subtitle="Everything else lives here."
                        onClose={() => setShowMobileMenu(false)}
                        testId="mobile-more-sheet"
                    >
                        <div className="space-y-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleShareGuide();
                                }}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-border bg-claude-surface/80 px-4 py-3 text-left text-sm text-claude-text"
                            >
                                <span>Share</span>
                                <Share2 className="h-4 w-4 text-claude-secondary" />
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleGenerateFlashcards();
                                }}
                                disabled={!!generating}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-border bg-claude-surface/80 px-4 py-3 text-left text-sm text-claude-text disabled:opacity-50"
                            >
                                <span>Flashcards</span>
                                {generating === 'flashcards' ? <Loader2 className="h-4 w-4 animate-spin text-claude-secondary" /> : <Layers className="h-4 w-4 text-claude-secondary" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleGenerateExam();
                                }}
                                disabled={!!generating}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-border bg-claude-surface/80 px-4 py-3 text-left text-sm text-claude-text disabled:opacity-50"
                            >
                                <span>Mock Exam</span>
                                {generating === 'exam' ? <Loader2 className="h-4 w-4 animate-spin text-claude-secondary" /> : <ClipboardCheck className="h-4 w-4 text-claude-secondary" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    handleRegenerateWorkbook();
                                }}
                                disabled={!!generating}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-claude-accent/20 bg-claude-accent/5 px-4 py-3 text-left text-sm text-claude-text disabled:opacity-50"
                            >
                                <span>Rebuild Workbook</span>
                                {generating === 'guide' ? <Loader2 className="h-4 w-4 animate-spin text-claude-accent" /> : <RotateCcw className="h-4 w-4 text-claude-accent" />}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowMobileMenu(false);
                                    setDeleteConfirm(true);
                                }}
                                className="flex min-h-[52px] w-full items-center justify-between rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-left text-sm text-red-200"
                            >
                                <span>Delete</span>
                                <Trash2 className="h-4 w-4 text-red-300" />
                            </button>
                        </div>
                    </MobileBottomSheet>

                    <MobileBottomSheet
                        open={showMobileSections}
                        title="Sections"
                        subtitle={`${progress.completedCount}/${progress.totalSections} complete`}
                        onClose={() => setShowMobileSections(false)}
                        testId="mobile-sections-sheet"
                    >
                        <div className="space-y-2">
                            {sections.map((section, index) => {
                                const sectionState = normalizedStudyState.section_states[section.id] || {};
                                const isCurrent = normalizedStudyState.current_section_id === section.id;
                                const isComplete = sectionState.completed;
                                return (
                                    <button
                                        key={section.id}
                                        type="button"
                                        onClick={() => {
                                            setShowMobileSections(false);
                                            handleSelectSection(section.id);
                                        }}
                                        className={`w-full rounded-[22px] border px-4 py-4 text-left transition-all ${
                                            isCurrent
                                                ? 'border-claude-accent bg-claude-accent/10'
                                                : isComplete
                                                    ? 'border-emerald-500/30 bg-emerald-500/10'
                                                    : 'border-claude-border bg-claude-surface/80'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-claude-secondary">Section {index + 1}</p>
                                                <p className="mt-2 text-sm font-medium text-claude-text">{section.title}</p>
                                            </div>
                                            <div className={`shrink-0 rounded-full px-3 py-2 text-[10px] font-mono uppercase tracking-[0.14em] ${
                                                isCurrent
                                                    ? 'bg-claude-accent/15 text-claude-accent'
                                                    : isComplete
                                                        ? 'bg-emerald-500/15 text-emerald-300'
                                                        : 'bg-claude-bg/60 text-claude-secondary'
                                            }`}>
                                                {isCurrent ? 'Current' : isComplete ? 'Done' : 'Next'}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </MobileBottomSheet>
                </>
            ) : null}
        </div>
    );
}
